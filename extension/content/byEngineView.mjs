/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Utils from "./utils.mjs";
import { getLocales, getRegions, validateConfiguration } from "./loader.mjs";

const calculateLocaleRegionsElements = [
  "engine-id",
  "engine-telemetry-id",
  "locale-by-engine",
  "region-by-engine",
  "application-name",
];

export default class ByEngineView extends HTMLElement {
  #currentCalculation = null;
  #config = null;

  constructor() {
    super();
    let template = document.getElementById("by-engine-view-template");
    let templateContent = template.content;

    let shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(templateContent.cloneNode(true));

    this.calculateLocaleRegions = this.calculateLocaleRegions.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  connectedCallback() {
    if (!this.isConnected) {
      return;
    }

    for (let element of calculateLocaleRegionsElements) {
      this.shadowRoot
        .getElementById(element)
        .addEventListener("change", this.calculateLocaleRegions);
      this.shadowRoot
        .getElementById(element)
        .addEventListener("keypress", this.handleKeyPress);
    }
  }

  disconnectedCallback() {
    for (let element of calculateLocaleRegionsElements) {
      this.shadowRoot
        .getElementById(element)
        .removeEventListener("change", this.calculateLocaleRegions);
      this.shadowRoot
        .getElementById(element)
        .removeEventListener("keypress", this.handleKeyPress);
    }
  }

  async clear() {
    this.shadowRoot.getElementById("locale-region-results").textContent = "";
  }

  handleKeyPress(event) {
    if (event.keyCode == "13") {
      event.preventDefault();
      this.calculateLocaleRegions();
    }
  }

  async calculateLocaleRegions(event, config) {
    if (event) {
      event.preventDefault();
    }
    if (config) {
      this.#config = config;
    }

    const engineId = this.shadowRoot.getElementById("engine-id").value;
    if (!engineId) {
      return;
    }

    if (this.#currentCalculation) {
      this.#currentCalculation.abort = true;
      await this.#currentCalculation.finishPromise;
    }

    if (!(await validateConfiguration(this.#config))) {
      return;
    }

    this.#currentCalculation = {
      abort: false,
    };
    this.#currentCalculation.finishPromise = this.#doLocaleRegionCalculation(
      this.#config,
      engineId,
      this.#currentCalculation
    )
      .then(() => (this.#currentCalculation = null))
      .catch(console.error);
  }

  async #doLocaleRegionCalculation(config, engineId, abortObj) {
    this.shadowRoot.getElementById("by-engine-progress").value = 0;
    this.shadowRoot.getElementById("locale-region-results").textContent = "";

    const telemetryId = this.shadowRoot.getElementById(
      "engine-telemetry-id"
    ).value;

    const appName = this.shadowRoot.getElementById("application-name").value;

    const allLocales = await getLocales();
    const allRegions = await getRegions();

    const byLocale =
      this.shadowRoot.querySelectorAll(
        'input[name="by-engine-radio"]:checked'
      )[0].value == "locale";

    const allBy = byLocale ? allLocales : allRegions;
    const allSub = byLocale ? allRegions : allLocales;

    const byLength = allBy.length;
    // Pre-filter the config for just the engine id to reduce the amount of
    // processing to do.
    const configData = this.#filterConfig(config, engineId);

    let count = 0;
    const results = new Map();

    for (const item of allBy) {
      const itemResults = new Set();
      for (const subItem of allSub) {
        const { engines } = await browser.experiments.searchengines.getEngines({
          configData,
          // No need to apply the overrides for this view.
          configOverridesData: '{"data":[]}',
          locale: byLocale ? item : subItem,
          region: byLocale ? subItem : item,
          distroID: "",
          experiment: "",
          appName,
        });
        for (let engine of engines) {
          if (engine.identifier.startsWith(engineId)) {
            if (telemetryId) {
              if (Utils.calculateTelemetryId(engine) == telemetryId) {
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
      this.shadowRoot.getElementById("by-engine-progress").value = percent;
      this.shadowRoot.getElementById("by-engine-progress").textContent =
        `${percent}%`;
    }

    let fragment = document.createDocumentFragment();
    Utils.addDiv(fragment, byLocale ? "Locales" : "Regions");
    Utils.addDiv(fragment, byLocale ? "Regions" : "Locales");

    for (const [item, subItem] of results) {
      const refined = [...subItem].sort();
      Utils.addDiv(fragment, item);
      if (
        refined.length == allSub.length &&
        refined.every((entry, i) => entry == allSub[i])
      ) {
        Utils.addDiv(fragment, `All ${byLocale ? "Regions" : "Locales"}`);
      } else {
        Utils.addDiv(fragment, [...subItem].join(","));
      }
    }
    this.shadowRoot
      .getElementById("locale-region-results")
      .appendChild(fragment);
  }

  #filterConfig(config, engineId) {
    return JSON.stringify({
      data: config.data.filter((item) => {
        return (
          (item.recordType == "engine" &&
            item.identifier.startsWith(engineId)) ||
          item.recordType == "defaultEngines" ||
          item.recordType == "engineOrders"
        );
      }),
    });
  }
}
