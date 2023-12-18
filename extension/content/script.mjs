/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import ByEngineView from "./byEngineView.mjs";
import ByEngineViewOld from "./byEngineViewOld.mjs";
import ConfigSelection from "./configSelection.mjs";
import ConfigController from "./configController.mjs";
import CompareView from "./compareView.mjs";
import CompareViewOld from "./compareViewOld.mjs";
import EnginesView from "./enginesView.mjs";
import EnginesViewOld from "./enginesViewOld.mjs";

const searchengines = browser.experiments.searchengines;

if (!searchengines) {
  alert(
    "SearchEngine Devtools needs to be ran on nightly with prefs enabled (https://webextensions-experiments.readthedocs.io/en/latest/faq.html#why-is-my-experiment-undefined-on-beta-and-release)"
  );
}

const $ = document.querySelector.bind(document);

async function main() {
  // Always clear the local storage on load, so that we don't have old data.
  localStorage.clear();

  let configFormat =
    await browser.experiments.searchengines.getCurrentConfigFormat();

  $("#currentConfig").textContent = `Using search-config${
    configFormat == 1 ? "" : "-v2"
  }`;
  $("#currentConfig").setAttribute("format", configFormat);

  customElements.define("config-selection", ConfigSelection);
  customElements.define("config-controller", ConfigController);
  if (configFormat == 1) {
    customElements.define("compare-view", CompareViewOld);
    customElements.define("engines-view", EnginesViewOld);
    customElements.define("by-engine-view", ByEngineViewOld);
  } else {
    customElements.define("compare-view", CompareView);
    customElements.define("engines-view", EnginesView);
    customElements.define("by-engine-view", ByEngineView);
  }

  await initUI();

  let configController = $("#config-controller");
  await configController.setCompareConfigsSelected(
    $("#compare-configs").hasAttribute("selected")
  );
  await configController.update();
  try {
    await setupEnginesView();
  } catch (ex) {
    console.error(ex);
    $("config-controller").updateInvalidMessageDisplay(false);
  }
  document.body.classList.remove("loading");
}

async function initUI() {
  $("#config-controller").addEventListener("change", reloadPage);

  $("#engines-view")
    .shadowRoot.getElementById("engines-table")
    .addEventListener("click", showConfig);

  $("#by-locales").setAttribute("selected", true);
  $("#by-locales-tab").setAttribute("selected", true);

  $("#by-locales").addEventListener("click", changeTabs);
  $("#by-engine").addEventListener("click", changeTabs);
  $("#compare-configs").addEventListener("click", changeTabs);
}

async function changeTabs(event) {
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
  await $("#config-controller").setCompareConfigsSelected(
    $("#compare-configs").hasAttribute("selected")
  );

  await setupTabs(event.target.id);
}

async function showConfig(e) {
  if (e.target.tagName.toLowerCase() != "div") {
    return;
  }
  let id = e.target.dataset.id;
  if (!id) {
    return;
  }
  $("#config-controller").moveConfigToId(id);
}

function reloadPage(event) {
  event.preventDefault();
  localStorage.clear();
  (async () => {
    document.body.classList.add("loading");

    $("#by-engine-view").clear();
    let configController = $("#config-controller");
    await configController.setCompareConfigsSelected(
      $("#compare-configs").hasAttribute("selected")
    );

    let tabId = ["by-engine", "by-locales", "compare-configs"].find((t) =>
      $(`#${t}`).getAttribute("selected")
    );
    await setupTabs(tabId);

    document.body.classList.remove("loading");
  })();
}

async function setupTabs(tabId) {
  try {
    switch (tabId) {
      case "compare-configs":
        await setupDiff();
        break;
      case "by-locales":
        await setupEnginesView();
        break;
      case "by-engine":
        await setupByEngine();
        break;
    }
    $("config-controller").updateInvalidMessageDisplay(true);
  } catch (ex) {
    console.error(ex);
    $("config-controller").updateInvalidMessageDisplay(false);
  }
}

async function setupDiff() {
  let configController = $("#config-controller");
  const oldConfig = JSON.parse(await configController.fetchPrimaryConfig());
  const newConfig = JSON.parse(await configController.fetchSecondaryConfig());
  await $("#compare-view")
    .doDiffCalculation(oldConfig, newConfig)
    .catch(console.error);
}

async function setupByEngine() {
  if ($("#by-engine").hasAttribute("selected")) {
    await $("#by-engine-view").calculateLocaleRegions(
      null,
      JSON.parse(await $("#config-controller").fetchPrimaryConfig())
    );
  }
}

async function setupEnginesView() {
  await $("#engines-view").loadEngines(
    null,
    await $("#config-controller").fetchPrimaryConfig()
  );
}

window.addEventListener("load", main, { once: true });
