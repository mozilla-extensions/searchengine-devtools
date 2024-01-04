/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, XPCOMUtils, Services */

ChromeUtils.defineESModuleGetters(this, {
  SearchEngineSelector: "resource://gre/modules/SearchEngineSelector.sys.mjs",
  SearchEngineSelectorOld:
    "resource://gre/modules/SearchEngineSelectorOld.sys.mjs",
  SearchUtils: "resource://gre/modules/SearchUtils.sys.mjs",
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
  return Services.vc.compare("120.0", Services.appinfo.version, "120") < 1
    ? 1
    : 2;
}

async function getEngines(options) {
  let engineSelector;
  let usingV2 = false;
  if ("newSearchConfigEnabled" in SearchUtils) {
    if (SearchUtils.newSearchConfigEnabled) {
      engineSelector = new SearchEngineSelector();
      usingV2 = true;
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
    if (!usingV2) {
      config.sort((a, b) => a.id.localeCompare(b.id));
    }
    engineSelector._configuration = config;

    engineSelector._configurationOverrides = JSON.parse(
      options.configOverridesData
    ).data;

    return config;
  };
  return engineSelector.fetchEngineConfiguration(options);
}

var searchengines = class extends ExtensionAPI {
  getAPI(context) {
    return {
      experiments: {
        searchengines: {
          getCurrentLocale,
          getRegions,
          getCurrentRegion,
          getCurrentConfigFormat,
          getEngines,
        },
      },
    };
  }
};
