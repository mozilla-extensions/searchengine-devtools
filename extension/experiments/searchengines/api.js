/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, XPCOMUtils, Services, Cc, Ci */

let FilterExpressions;
let SearchEngineSelector;
let SearchSuggestionController;
let SearchUtils;
let AppProvidedSearchEngine;

// Support pre and post moz-src URLs. These are in two separate try/catch
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
  ({ SearchEngineSelector } = ChromeUtils.importESModule(
    "resource://gre/modules/SearchEngineSelector.sys.mjs"
  ));
  ({ SearchSuggestionController } = ChromeUtils.importESModule(
    "resource://gre/modules/SearchSuggestionController.sys.mjs"
  ));
  ({ SearchUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/SearchUtils.sys.mjs"
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
  ({ SearchUtils } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/search/SearchUtils.sys.mjs"
  ));
  ({ AppProvidedSearchEngine } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/search/AppProvidedSearchEngine.sys.mjs"
  ));
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

  engineSelector.getEngineConfiguration = async () => {
    let config = JSON.parse(options.configData).data;
    engineSelector._configuration = config;

    engineSelector._configurationOverrides = JSON.parse(
      options.configOverridesData
    ).data;

    return config;
  };

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

  result.engines = SearchUtils.sortEnginesByDefaults({
    engines: result.engines,
    appDefaultEngine: result.engines[0],
    locale: options.locale,
  });

  result.engines = result.engines.map((engine) => {
    let appProvidedEngine = new AppProvidedSearchEngine({ config: engine });

    function getSubmission(type) {
      return appProvidedEngine.getSubmission(
        type == "application/x-trending+json" ? "" : SEARCH_TERMS,
        type
      )?.uri?.spec;
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

  let results = await controller.fetch(
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

  if (reset) {
    Services.prefs.setBoolPref("browser.search.suggest.enabled", false);
  }

  await new Promise((resolve) => Services.tm.dispatchToMainThread(resolve));
  ConsoleAPIStorage.removeLogEventListener(observeConsole);
  return { suggestions: results.remote.map((r) => r.value), error };
}

async function jexlFilterMatches(
  filterExpression,
  applicationId,
  applicationVersion
) {
  return !!(await FilterExpressions.eval(filterExpression, {
    env: { appinfo: { ID: applicationId }, version: applicationVersion },
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
