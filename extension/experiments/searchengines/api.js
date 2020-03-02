/* global ExtensionAPI */

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
  SearchEngineSelector: "resource://gre/modules/SearchEngineSelector.jsm",
});

async function getCurrentRegion() {
  return Services.prefs.getCharPref("browser.search.region", "default");
}

async function getRegions() {
  return Services.intl.getAvailableLocaleDisplayNames("region");
}

async function getCurrentLocale() {
  return Services.locale.appLocaleAsBCP47;
}

async function getEngines(configUrl, locale, region) {
  let engineSelector = new SearchEngineSelector();
  await engineSelector.init(configUrl);
  return engineSelector.fetchEngineConfiguration(locale, region);
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
