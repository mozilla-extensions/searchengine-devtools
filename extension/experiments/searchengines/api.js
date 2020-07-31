/* global ExtensionAPI */

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
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
