/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, XPCOMUtils, Services */

ChromeUtils.defineESModuleGetters(this, {
  SearchEngineSelector: "resource://gre/modules/SearchEngineSelector.sys.mjs",
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

async function getEngines(options) {
  let engineSelector = new SearchEngineSelector();
  engineSelector.getEngineConfiguration = async () => {
    const result = JSON.parse(options.configUrl).data;
    result.sort((a, b) => a.id.localeCompare(b.id));
    engineSelector._configuration = result;
    return result;
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
          getEngines,
        },
      },
    };
  }
};
