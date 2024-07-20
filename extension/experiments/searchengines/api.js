/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, XPCOMUtils, Services */

ChromeUtils.defineESModuleGetters(this, {
  SearchEngineSelector: "resource://gre/modules/SearchEngineSelector.sys.mjs",
  SearchEngineSelectorOld:
    "resource://gre/modules/SearchEngineSelectorOld.sys.mjs",
  SearchUtils: "resource://gre/modules/SearchUtils.sys.mjs",
  AppProvidedSearchEngine:
    "resource://gre/modules/AppProvidedSearchEngine.sys.mjs",
});

// eslint-disable-next-line mozilla/reject-importGlobalProperties
XPCOMUtils.defineLazyGlobalGetters(this, ["fetch"]);

async function getEngineUrls(engineConfig) {
  engineConfig.webExtension = { id: "cute kitten" };

  // WebExtensions automatically assign a null value to optional properties,
  // which can cause errors when retrieving the URLs. To prevent these errors,
  // we need to remove any properties that have a null value.
  for (let [key, url] of Object.entries(engineConfig.urls)) {
    if (!url) {
      delete engineConfig.urls[key];
      continue;
    }

    if (!url.searchTermParamName) {
      delete url.searchTermParamName;
      continue;
    }

    for (let property of ["experimentConfig", "searchAccessPoint", "value"]) {
      for (let param of url.params) {
        if (param[property] === null) {
          delete param[property];
        }
      }
    }
  }

  let appProvidedEngine = new AppProvidedSearchEngine({ config: engineConfig });
  let search = appProvidedEngine.getSubmission("cute kitten", "text/html")?.uri
    ?.spec;
  let suggest = appProvidedEngine.getSubmission(
    "cute kitten",
    "application/x-suggestions+json"
  )?.uri?.spec;
  let trending = appProvidedEngine.getSubmission(
    "cute kitten",
    "application/x-trending+json"
  )?.uri?.spec;

  return { search, suggest, trending };
}

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
  return result;
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
          getEngineUrls,
        },
      },
    };
  }
};
