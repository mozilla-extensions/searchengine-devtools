/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global ExtensionAPI, XPCOMUtils, Services */

XPCOMUtils.defineLazyModuleGetters(this, {
  SearchEngineSelector: "resource://gre/modules/SearchEngineSelector.jsm",
});

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
  if (!("init" in engineSelector)) {
    engineSelector.getEngineConfiguration = async () => {
      const result = JSON.parse(options.configUrl).data;
      result.sort((a, b) => a.id.localeCompare(b.id));
      engineSelector._configuration = result;
      return result;
    };
  } else {
    await engineSelector.init(options.configUrl);
  }
  try {
    return await engineSelector.fetchEngineConfiguration(options);
  } catch (ex) {
    // We changed how the parameters worked part way through 81.0a1, so try
    // falling back if the above doesn't work.
    console.warn(
      "Falling back to old call method for fetchEngineConfiguration"
    );
    return engineSelector.fetchEngineConfiguration(
      options.locale,
      options.region,
      options.channel,
      options.distroID
    );
  }
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
