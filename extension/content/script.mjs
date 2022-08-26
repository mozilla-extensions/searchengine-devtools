/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import ByEngineView from "./byEngineView.mjs";
import ConfigSelection from "./configSelection.mjs";
import CompareView from "./compareView.mjs";
import EnginesView from "./enginesView.mjs";
import { fetchCached, validateConfiguration } from "./loader.mjs";

const searchengines = browser.experiments.searchengines;

if (!searchengines) {
  alert(
    "SearchEngine Devtools needs to be ran on nightly with prefs enabled (https://webextensions-experiments.readthedocs.io/en/latest/faq.html#why-is-my-experiment-undefined-on-beta-and-release)"
  );
}

const $ = document.querySelector.bind(document);

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

async function main() {
  // Always clear the local storage on load, so that we don't have old data.
  localStorage.clear();

  customElements.define("config-selection", ConfigSelection);
  customElements.define("compare-view", CompareView);
  customElements.define("engines-view", EnginesView);
  customElements.define("by-engine-view", ByEngineView);
  await initUI();
  await loadConfiguration();
  await setupEnginesView();
  document.body.classList.remove("loading");
}

async function initUI() {
  $("#reload-page").addEventListener("click", reloadPage);

  $("#engines-view")
    .shadowRoot.getElementById("engines-table")
    .addEventListener("click", showConfig);

  $("#by-locales").setAttribute("selected", true);
  $("#by-locales-tab").setAttribute("selected", true);

  $("#by-locales").addEventListener("click", changeTabs);
  $("#by-engine").addEventListener("click", changeTabs);
  $("#compare-configs").addEventListener("click", changeTabs);
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
    $("#compare-config").removeAttribute("hidden");
    setupDiff();
  } else {
    $("#compare-config").setAttribute("hidden", true);
  }
  setupByEngine();
}

async function loadConfiguration() {
  if (
    $("#primary-config").selected != "local-text" &&
    !(
      $("#compare-configs").hasAttribute("selected") &&
      $("#compare-config").selected == "local-text"
    )
  ) {
    let config = JSON.parse(await fetchCachedConfig("primary-config"));
    if (!validateConfiguration(config)) {
      throw new Error("Configuration from server is invalid");
    }
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

function reloadPage(event) {
  event.preventDefault();
  localStorage.clear();
  (async () => {
    document.body.classList.add("loading");
    $("#by-engine-view").clear();
    await loadConfiguration();
    await setupEnginesView();
    await setupDiff();
    await setupByEngine();
    document.body.classList.remove("loading");
  })();
}

async function setupDiff() {
  const oldConfig = JSON.parse(await fetchCachedConfig("primary-config"));
  const newConfig = JSON.parse(await fetchCachedConfig("compare-config"));
  await $("#compare-view")
    .doDiffCalculation(oldConfig, newConfig)
    .catch(console.error);
}

async function setupByEngine() {
  if ($("#by-engine").hasAttribute("selected")) {
    await $("#by-engine-view").calculateLocaleRegions(
      null,
      JSON.parse(await fetchCachedConfig("primary-config"))
    );
  }
}

async function setupEnginesView() {
  await $("#engines-view").loadEngines(
    null,
    await fetchCachedConfig("primary-config")
  );
}

function fetchCachedConfig(configSelectionId, expiry) {
  const buttonValue = $(`#${configSelectionId}`).selected;
  if (buttonValue == "local-text") {
    return $("#config").value;
  }
  return fetchCached(ENGINES_URLS[buttonValue]);
}

window.addEventListener("load", main, { once: true });
