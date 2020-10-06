/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Utils from "./utils.js";

/* global Diff */
const searchengines = browser.experiments.searchengines;

if (!searchengines) {
  alert(
    "SearchEngine Devtools needs to be ran on nightly with prefs enabled (https://webextensions-experiments.readthedocs.io/en/latest/faq.html#why-is-my-experiment-undefined-on-beta-and-release)"
  );
}

const $ = document.querySelector.bind(document);

const ONE_DAY = 1000 * 60 * 24;

const ENGINES_URLS = {
  "prod-main":
    "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/search-config/records?_cachebust=%CACHEBUST%",
  "prod-preview":
    "https://firefox.settings.services.mozilla.com/v1/buckets/main-preview/collections/search-config/records?_cachebust=%CACHEBUST%",
  "stage-main":
    "https://settings.stage.mozaws.net/v1/buckets/main/collections/search-config/records?_cachebust=%CACHEBUST%",
  "stage-preview":
    "https://settings.stage.mozaws.net/v1/buckets/main-preview/collections/search-config/records?_cachebust=%CACHEBUST%",
};

const LOCALES_URL =
  "https://hg.mozilla.org/mozilla-central/raw-file/tip/browser/locales/all-locales";

async function main() {
  await initUI();
  await loadConfiguration();
  await loadEngines();
  document.body.classList.remove("loading");
}

async function loadEngines() {
  let locale = $("#locale-select").value;
  let region = $("#region-select").value;
  let distroID = $("#distro-id").value;
  let experiment = $("#experiment-id").value;
  let { engines, private: privateDefault } = await searchengines.getEngines({
    configUrl: $("#config").value,
    locale,
    region,
    distroID,
    experiment,
  });

  function getTelemetryId(e) {
    // Based on SearchService.getEngineParams().
    let telemetryId = e.telemetryId;
    if (!telemetryId) {
      telemetryId = e.webExtension.id.split("@")[0];
      if (e.webExtension.locale != "default") {
        telemetryId += "-" + e.webExtension.locale;
      }
    }
    return telemetryId;
  }

  // Approximate the default sort order (we can't do exact order as
  // we don't have the display names)
  const collator = new Intl.Collator();
  const defaultEngine = engines[0];
  engines.sort((a, b) => {
    if (a == defaultEngine) {
      return -1;
    }
    if (privateDefault) {
      if (a == privateDefault && b == defaultEngine) {
        return -1;
      }
      if (a == defaultEngine && b == privateDefault) {
        return 1;
      }
    }
    if (a.orderHint == b.orderHint) {
      return collator.compare(a.webExtension.id, b.webExtension.id);
    }
    return b.orderHint - a.orderHint;
  });

  let fragment = document.createDocumentFragment();
  Utils.addDiv(fragment, "Index");
  Utils.addDiv(fragment, "Id");
  Utils.addDiv(fragment, "Locales");
  Utils.addDiv(fragment, "Telemetry Id");
  Utils.addDiv(fragment, "Order Hint");
  Utils.addDiv(fragment, "Params");
  for (let [i, e] of engines.entries()) {
    Utils.addDiv(fragment, i + 1, e.webExtension.id);
    Utils.addDiv(fragment, e.webExtension.id, e.webExtension.id);
    Utils.addDiv(fragment, e.webExtension.locale, e.webExtension.id);
    Utils.addDiv(fragment, getTelemetryId(e), e.webExtension.id);
    Utils.addDiv(fragment, e.orderHint, e.webExtension.id);
    Utils.addDiv(
      fragment,
      e.params ? JSON.stringify(e.params) : "",
      e.webExtension.id,
      "params"
    );
  }
  $("#engines-table").textContent = "";
  $("#engines-table").appendChild(fragment);

  $("#private-browsing-engine").innerText = privateDefault
    ? privateDefault
    : "Unset";
}

async function initUI() {
  let locales = await getLocales();
  locales.unshift("default");
  Utils.insertOptionList($("#locale-select"), locales);
  $("#locale-select").value = await searchengines.getCurrentLocale();

  let regions = await getRegions();
  regions.unshift("default");
  Utils.insertOptionList($("#region-select"), regions);
  $("#region-select").value = await searchengines.getCurrentRegion();

  $("#region-select").addEventListener("change", reloadEngines);
  $("#locale-select").addEventListener("change", reloadEngines);
  $("#distro-id").addEventListener("input", reloadEngines);
  $("#experiment-id").addEventListener("input", reloadEngines);
  $("#engine-id").addEventListener("change", calculateLocaleRegions);
  $("#engine-telemetry-id").addEventListener("change", calculateLocaleRegions);
  $("#locale-by-engine").addEventListener("change", calculateLocaleRegions);
  $("#region-by-engine").addEventListener("change", calculateLocaleRegions);

  $("#reload-page").addEventListener("click", reloadPage);

  $("#engines-table").addEventListener("click", showConfig);

  $("#by-locales").setAttribute("selected", true);
  $("#by-locales-tab").setAttribute("selected", true);

  $("#by-locales").addEventListener("click", changeTabs);
  $("#by-engine").addEventListener("click", changeTabs);
  $("#compare-configs").addEventListener("click", changeTabs);

  $("#changed-sections").addEventListener("change", displayDiff);
}

function changeTabs(event) {
  event.preventDefault();
  for (const tab of ["by-engine", "by-locales", "compare-configs"]) {
    if (tab == event.target.id) {
      $(`#${tab}`).setAttribute("selected", true);
      $(`#${tab}-tab`).setAttribute("selected", true);
    } else {
      $(`#${tab}`).removeAttribute("selected");
      $(`#${tab}-tab`).removeAttribute("selected");
    }
  }
  if (event.target.id == "compare-configs") {
    $("#compare-with").removeAttribute("hidden");
    doDiffCalculation().catch(console.error);
  } else {
    $("#compare-with").setAttribute("hidden", true);
  }
}

async function loadConfiguration() {
  if (
    $(`input[name="server-radio"]:checked`).value != "local-text" &&
    !(
      $("#compare-configs").hasAttribute("selected") &&
      $(`input[name="config-radio"]:checked`).value == "local-text"
    )
  ) {
    console.log("fetch");
    let config = JSON.parse(await fetchCachedConfig("server-radio"));
    $("#config").value = JSON.stringify(config, null, 2);
  }
}

async function showConfig(e) {
  if (e.target.tagName.toLowerCase() != "div") {
    return;
  }
  let id = e.target.dataset.id;
  if (!id) {
    return;
  }
  let textarea = $("#config");
  let line = textarea.value.split(id)[0].match(/\n/g).length;
  var lineHeight = document.defaultView
    .getComputedStyle(textarea)
    .getPropertyValue("line-height");
  $("#config").scrollTop = line * parseInt(lineHeight, 10);
}

async function reloadEngines(event) {
  event.preventDefault();
  await loadEngines();
}

function filterConfig(config, engineId) {
  const json = JSON.parse(config);
  json.data = json.data.filter((item) => {
    return (
      item.webExtension &&
      item.webExtension.id &&
      item.webExtension.id.startsWith(engineId)
    );
  });
  return JSON.stringify(json);
}

let currentCalculation;

async function calculateLocaleRegions(event) {
  if (event) {
    event.preventDefault();
  }

  const engineId = $("#engine-id").value;
  if (!engineId) {
    return;
  }

  if (currentCalculation) {
    currentCalculation.abort = true;
    await currentCalculation.finishPromise;
  }

  currentCalculation = {
    abort: false,
  };
  currentCalculation.finishPromise = doLocaleRegionCalculation(
    engineId,
    currentCalculation
  )
    .then(() => (currentCalculation = null))
    .catch(console.error);
}

async function doLocaleRegionCalculation(engineId, abortObj) {
  $("#by-engine-progress").value = 0;
  $("#locale-region-results").textContent = "";

  const telemetryId = $("#engine-telemetry-id").value;

  const allLocales = await getLocales();
  const allRegions = await getRegions();

  const byLocale = $('input[name="by-engine-radio"]:checked').value == "locale";

  const allBy = byLocale ? allLocales : allRegions;
  const allSub = byLocale ? allRegions : allLocales;

  const byLength = allBy.length;
  // Pre-filter the config for just the engine id to reduce the amount of
  // processing to do.
  const configUrl = filterConfig($("#config").value, engineId);

  let count = 0;
  const results = new Map();

  for (const item of allBy) {
    const itemResults = new Set();
    for (const subItem of allSub) {
      const { engines } = await searchengines.getEngines({
        configUrl,
        locale: byLocale ? item : subItem,
        region: byLocale ? subItem : item,
        distroID: "",
        experiment: "",
      });
      for (let engine of engines) {
        if (engine.webExtension.id.startsWith(engineId)) {
          if (telemetryId) {
            if (engine.telemetryId == telemetryId) {
              itemResults.add(subItem);
            }
          } else {
            itemResults.add(subItem);
          }
        }
      }
      if (abortObj.abort) {
        return;
      }
    }
    results.set(item, itemResults);
    count++;
    const percent = Math.round((count * 100) / byLength);
    $("#by-engine-progress").value = percent;
    $("#by-engine-progress").textContent = `${percent}%`;
  }

  let fragment = document.createDocumentFragment();
  Utils.addDiv(fragment, byLocale ? "Locales" : "Regions");
  Utils.addDiv(fragment, byLocale ? "Regions" : "Locales");

  for (const [item, subItem] of results) {
    const refined = [...subItem].sort();
    Utils.addDiv(fragment, item);
    if (
      refined.length == allSub.length &&
      refined.every((item, i) => item == allSub[i])
    ) {
      Utils.addDiv(fragment, `All ${byLocale ? "Regions" : "Locales"}`);
    } else {
      Utils.addDiv(fragment, [...subItem].join(","));
    }
  }
  $("#locale-region-results").appendChild(fragment);
}

function reloadPage(event) {
  event.preventDefault();
  localStorage.clear();
  (async () => {
    document.body.classList.add("loading");
    $("#locale-region-results").textContent = "";
    await loadConfiguration();
    await loadEngines();
    await doDiffCalculation();
    if ($("#by-engine").hasAttribute("selected")) {
      await calculateLocaleRegions();
    }
    document.body.classList.remove("loading");
  })();
}

async function getLocales() {
  let data = await fetchCached(LOCALES_URL);
  let locales = [
    ...data
      .split("\n")
      .filter((e) => e != "")
      .filter((e) => e.match(/^[a-zA-Z-]+$/)),
    "en-US",
  ];
  locales = locales.map((l) => (l == "ja-JP-mac" ? "ja-JP-macos" : l));
  return locales.sort();
}

async function getRegions() {
  return (await searchengines.getRegions()).map((r) => r.toUpperCase());
}

function fetchCachedConfig(radioButtonId, expiry) {
  const buttonValue = $(`input[name="${radioButtonId}"]:checked`).value;
  if (buttonValue == "local-text") {
    return $("#config").value;
  }
  return fetchCached(ENGINES_URLS[buttonValue]);
}

async function fetchCached(url, expiry = ONE_DAY) {
  let cache = JSON.parse(localStorage.getItem(url));
  if (cache && Date.now() - expiry < cache.time) {
    return cache.data;
  }
  url = url.replace(/%CACHEBUST%/, Math.floor(Math.random() * 100000));
  let request = await fetch(url);
  let data = await request.text();
  localStorage.setItem(url, JSON.stringify({ time: Date.now(), data }));
  return data;
}

async function getDiffData() {
  const oldConfig = JSON.parse(await fetchCachedConfig("server-radio"));
  const newConfig = JSON.parse(await fetchCachedConfig("config-radio"));

  const webExtensionIds = new Set();

  function mapConfig(configData) {
    const map = new Map();
    for (const config of configData) {
      webExtensionIds.add(config.webExtension.id);
      const newConfigData = { ...config };
      delete newConfigData.last_modified;
      delete newConfigData.id;
      delete newConfigData.schema;
      map.set(config.webExtension.id, newConfigData);
    }
    return map;
  }

  const result = {
    oldConfigMap: mapConfig(oldConfig.data),
    newConfigMap: mapConfig(newConfig.data),
  };

  result.webExtensionIds = [...webExtensionIds.keys()].sort();

  return result;
}

function getDiff(oldObj, newObj) {
  return Diff.diffJson(oldObj || {}, newObj || {});
}

async function doDiffCalculation() {
  const { oldConfigMap, newConfigMap, webExtensionIds } = await getDiffData();

  const changedSections = $("#changed-sections");
  Utils.removeAllChildren(changedSections);
  Utils.removeAllChildren($("#diff-display"));

  const fragment = document.createDocumentFragment();
  for (const id of webExtensionIds) {
    const fullDiff = getDiff(oldConfigMap.get(id), newConfigMap.get(id));
    if (fullDiff.length > 1 || fullDiff[0].added || fullDiff[0].removed) {
      const option = document.createElement("option");
      option.appendChild(document.createTextNode(`${id}`));
      fragment.appendChild(option);
    }
  }
  $("#changed-sections").appendChild(fragment);
}

async function displayDiff() {
  const { oldConfigMap, newConfigMap } = await getDiffData();

  const id = $("#changed-sections").value;
  const fullDiff = getDiff(oldConfigMap.get(id), newConfigMap.get(id));

  const diffDisplay = $("#diff-display");
  Utils.removeAllChildren(diffDisplay);
  const fragment = document.createDocumentFragment();
  for (const diff of fullDiff) {
    let color = diff.added ? "green" : "grey";
    if (diff.removed) {
      color = "red";
    }
    const div = document.createElement("pre");
    div.appendChild(document.createTextNode(diff.value));
    div.style.color = color;
    fragment.appendChild(div);
  }
  diffDisplay.appendChild(fragment);
}

window.addEventListener("load", main, { once: true });
