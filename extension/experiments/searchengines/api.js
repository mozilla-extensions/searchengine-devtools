/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, XPCOMUtils, Services */

ChromeUtils.defineESModuleGetters(this, {
  FilterExpressions:
    "resource://gre/modules/components-utils/FilterExpressions.sys.mjs",
  SearchEngineSelector: "resource://gre/modules/SearchEngineSelector.sys.mjs",
  SearchEngineSelectorOld:
    "resource://gre/modules/SearchEngineSelectorOld.sys.mjs",
  SearchUtils: "resource://gre/modules/SearchUtils.sys.mjs",
  AppProvidedSearchEngine:
    "resource://gre/modules/AppProvidedSearchEngine.sys.mjs",
});

// eslint-disable-next-line mozilla/reject-importGlobalProperties
XPCOMUtils.defineLazyGlobalGetters(this, ["fetch"]);

async function getCurrentRegion() {
  return Services.prefs.getCharPref("browser.search.region", "default");
}

async function getRegions() {
  return Services.intl.getAvailableLocaleDisplayNames("region");
}

async function getCurrentLocale() {
  return Services.locale.appLocaleAsBCP47;
}

async function getCurrentConfigFormat() {
  if ("newSearchConfigEnabled" in SearchUtils) {
    if (SearchUtils.newSearchConfigEnabled) {
      return 2;
    }
    return 1;
  }
  // The preference was introduced in 120, so anything before that should be
  // treated as the original version. If there is no preference after that,
  // we assume that we are on v2.
  return Services.vc.compare(Services.appinfo.version, "120.0") < 0 ? 1 : 2;
}

async function getEngines(options) {
  let engineSelector;
  let useSearchConfigV2 = false;
  if ("newSearchConfigEnabled" in SearchUtils) {
    if (SearchUtils.newSearchConfigEnabled) {
      engineSelector = new SearchEngineSelector();
      useSearchConfigV2 = true;
    } else {
      engineSelector = new SearchEngineSelectorOld();
    }
  } else {
    // If we no longer have the pref, or the preference wasn't there to begin
    // with, then we assume we can load the new SearchEngineSelector.
    engineSelector = new SearchEngineSelector();
  }

  engineSelector.getEngineConfiguration = async () => {
    let config = JSON.parse(options.configData).data;
    if (!useSearchConfigV2) {
      config.sort((a, b) => a.id.localeCompare(b.id));
    }
    engineSelector._configuration = config;

    engineSelector._configurationOverrides = JSON.parse(
      options.configOverridesData
    ).data;

    return config;
  };
  let result = await engineSelector.fetchEngineConfiguration(options);

  if (useSearchConfigV2 && "sortEnginesByDefaults" in SearchUtils) {
    result.engines = SearchUtils.sortEnginesByDefaults({
      engines: result.engines,
      appDefaultEngine: result.engines[0],
      locale: options.locale,
    });
  }

  result.engines = result.engines.map((engine) => {
    let appProvidedEngine = new AppProvidedSearchEngine({ config: engine });

    function getSubmission(type) {
      return appProvidedEngine.getSubmission(
        type == "application/x-trending+json" ? "" : "cute kitten",
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
      },
    };
  });

  return result;
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

var searchengines = class extends ExtensionAPI {
  getAPI() {
    return {
      experiments: {
        searchengines: {
          getCurrentLocale,
          getRegions,
          getCurrentRegion,
          getCurrentConfigFormat,
          getEngines,
          jexlFilterMatches,
        },
      },
    };
  }
};
