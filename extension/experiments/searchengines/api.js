/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, XPCOMUtils, Services, Cc, Ci */

let FilterExpressions;
let SearchEngineSelector;
let SearchSuggestionController;
let AppProvidedSearchEngine;
let AppConstants;

// Support pre and post moz-src URLs. These are in separate try/catch
// statements, as we expect them to land at separate times.
try {
  ({ FilterExpressions } = ChromeUtils.importESModule(
    "resource://gre/modules/components-utils/FilterExpressions.sys.mjs"
  ));
} catch {
  ({ FilterExpressions } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/utils/FilterExpressions.sys.mjs"
  ));
}
try {
  ({ AppConstants } = ChromeUtils.importESModule(
    "resource://gre/modules/AppConstants.sys.mjs"
  ));
} catch {
  ({ AppConstants } = ChromeUtils.importESModule(
    "moz-src:///toolkit/modules/AppConstants.sys.mjs"
  ));
}
// These were migrated to moz-src in FF 140, kept for now for backwards
// compatibililty.
try {
  ({ SearchEngineSelector } = ChromeUtils.importESModule(
    "resource://gre/modules/SearchEngineSelector.sys.mjs"
  ));
  ({ SearchSuggestionController } = ChromeUtils.importESModule(
    "resource://gre/modules/SearchSuggestionController.sys.mjs"
  ));
  ({ AppProvidedSearchEngine } = ChromeUtils.importESModule(
    "resource://gre/modules/AppProvidedSearchEngine.sys.mjs"
  ));
} catch {
  ({ SearchEngineSelector } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/search/SearchEngineSelector.sys.mjs"
  ));
  ({ SearchSuggestionController } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/search/SearchSuggestionController.sys.mjs"
  ));
  // This was migrated to ConfigSearchEngine in FF 143, kept for now for
  // backwards compatibililty.
  try {
    ({ AppProvidedSearchEngine } = ChromeUtils.importESModule(
      "moz-src:///toolkit/components/search/AppProvidedSearchEngine.sys.mjs"
    ));
  } catch {
    ({ AppProvidedConfigEngine: AppProvidedSearchEngine } =
      ChromeUtils.importESModule(
        "moz-src:///toolkit/components/search/ConfigSearchEngine.sys.mjs"
      ));
  }
}

// eslint-disable-next-line mozilla/reject-importGlobalProperties
XPCOMUtils.defineLazyGlobalGetters(this, ["fetch"]);

const ConsoleAPIStorage = Cc["@mozilla.org/consoleAPI-storage;1"].getService(
  Ci.nsIConsoleAPIStorage
);

const SEARCH_TERMS = "kitten";

async function getCurrentRegion() {
  return Services.prefs.getCharPref("browser.search.region", "default");
}

async function getRegions() {
  return Services.intl.getAvailableLocaleDisplayNames("region");
}

async function getCurrentLocale() {
  return Services.locale.appLocaleAsBCP47;
}

async function getEngines(options) {
  let engineSelector = new SearchEngineSelector();

  engineSelector._onConfigurationUpdated({
    data: { current: JSON.parse(options.configData).data },
  });

  engineSelector._onConfigurationOverridesUpdated({
    data: { current: JSON.parse(options.configOverridesData).data },
  });

  // Due to the way the extension APIs work, if these values are not specified,
  // then they are given the `null` value. This in turn defeats the default
  // parameter fallback mechanism for fetchEngineConfiguration as that is
  // expecting `undefined`. Hence remove these here so that the fallback
  // can work properly.
  if (!options.channel) {
    delete options.channel;
  }
  if (!options.version) {
    delete options.version;
  }

  let result;
  try {
    result = await engineSelector.fetchEngineConfiguration(options);
  } catch (ex) {
    // If we are in the "byEngineView", then we may not get any engines returned
    // from the filtered configuration, hence we return an empty list.
    if (
      ex.message == "Could not find any engines in the filtered configuration"
    ) {
      return { engines: [] };
    }
    throw ex;
  }

  result.engines = result.engines.map((engine) => {
    let appProvidedEngine = new AppProvidedSearchEngine({ config: engine });

    function getSubmission(type) {
      let engineUrl =
        // Support running in builds prior to 149.0a1.
        "wrappedJSObject" in appProvidedEngine
          ? appProvidedEngine.wrappedJSObject.getURLOfType(type)
          : appProvidedEngine.getURLOfType(type);
      let searchTerms = SEARCH_TERMS;
      switch (type) {
        case "application/x-trending+json":
          searchTerms = "";
          break;
        case "application/x-visual-search+html":
          searchTerms =
            "https://searchfox.org/mozilla-central/static/icons/search.png";
          break;
      }

      return {
        displayName: engineUrl?.displayName,
        uri: appProvidedEngine.getSubmission(searchTerms, type)?.uri?.spec,
      };
    }

    // Return only what we need for the tables display, preferring the
    // AppProvidedSearchEngine data where appropriate, since that will reflect
    // what the application is actually using.
    return {
      aliases: appProvidedEngine.aliases,
      classification: appProvidedEngine.isGeneralPurposeEngine
        ? "general"
        : "unknown",
      identifier: appProvidedEngine.id,
      name: appProvidedEngine.name,
      partnerCode: engine.partnerCode,
      telemetryId: appProvidedEngine.telemetryId,
      urls: {
        search: getSubmission("text/html"),
        suggest: getSubmission("application/x-suggestions+json"),
        trending: getSubmission("application/x-trending+json"),
        searchForm: appProvidedEngine.searchForm,
        visualSearch: getSubmission("application/x-visual-search+html"),
      },
    };
  });

  return result;
}

async function getSuggestions(url, suggestionsType) {
  let controller = new SearchSuggestionController();
  controller.maxLocalResults = 0;

  let reset;
  if (!Services.prefs.getBoolPref("browser.search.suggest.enabled")) {
    reset = true;
    Services.prefs.setBoolPref("browser.search.suggest.enabled", true);
  }

  let error = undefined;
  function observeConsole(message) {
    if (
      message.level == "error" &&
      message.filename.includes("SearchSuggestionController")
    ) {
      error = ["Error:", ...message.arguments].join(" ");
    }
  }

  ConsoleAPIStorage.addLogEventListener(
    observeConsole,
    Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal)
  );

  let results;
  if (Services.vc.compare(AppConstants.MOZ_APP_VERSION, "144.0a1") >= 0) {
    results = await controller.fetch({
      searchString: suggestionsType == "trending" ? "" : SEARCH_TERMS,
      inPrivateBrowsing: false,
      engine: {
        getSubmission() {
          return { uri: Services.io.newURI(url) };
        },
        supportsResponseType() {
          return true;
        },
      },
      fetchTrending: suggestionsType == "trending",
    });
  } else {
    results = await controller.fetch(
      suggestionsType == "trending" ? "" : SEARCH_TERMS,
      false,
      {
        getSubmission() {
          return { uri: Services.io.newURI(url) };
        },
        supportsResponseType() {
          return true;
        },
      },
      0,
      false,
      false,
      suggestionsType == "trending"
    );
  }

  if (reset) {
    Services.prefs.setBoolPref("browser.search.suggest.enabled", false);
  }

  await new Promise((resolve) => Services.tm.dispatchToMainThread(resolve));
  ConsoleAPIStorage.removeLogEventListener(observeConsole);
  return { suggestions: results.remote.map((r) => r.value), error };
}

async function jexlFilterMatches(filterExpression, applicationOS) {
  if (!filterExpression) {
    return true;
  }
  return !!(await FilterExpressions.eval(filterExpression, {
    env: {
      appinfo: { OS: applicationOS },
    },
  }));
}

/* exported searchengines */
var searchengines = class extends ExtensionAPI {
  getAPI() {
    return {
      experiments: {
        searchengines: {
          getCurrentLocale,
          getRegions,
          getCurrentRegion,
          getEngines,
          getSuggestions,
          jexlFilterMatches,
        },
      },
    };
  }
};
