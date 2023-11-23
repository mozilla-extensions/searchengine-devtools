/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Utils from "./utils.mjs";
import { getLocales, getRegions, validateConfiguration } from "./loader.mjs";

const enginesSelectionElements = [
  "region-select",
  "locale-select",
  "distro-id",
  "experiment-id",
];

export default class EnginesView extends HTMLElement {
  #config = null;
  #initializedPromise = null;

  constructor() {
    super();
    let template = document.getElementById("engines-view-template");
    let templateContent = template.content;

    let shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(templateContent.cloneNode(true));

    this.loadEngines = this.loadEngines.bind(this);
  }

  async connectedCallback() {
    if (!this.isConnected) {
      return;
    }
    for (let element of enginesSelectionElements) {
      this.shadowRoot
        .getElementById(element)
        .addEventListener("change", this.loadEngines);
      this.shadowRoot
        .getElementById(element)
        .addEventListener("keypress", this.handleKeyPress);
    }
    this.loadEngines();
  }

  async disconnectedCallback() {
    for (let element of enginesSelectionElements) {
      this.shadowRoot
        .getElementById(element)
        .removeEventListener("change", this.loadEngines);
      this.shadowRoot
        .getElementById(element)
        .addEventListener("keypress", this.handleKeyPress);
    }
  }

  async initialize() {
    if (this.#initializedPromise) {
      return this.#initializedPromise;
    }

    return (this.#initializedPromise = this.#loadRegionsAndLocales());
  }

  handleKeyPress(event) {
    if (event.keyCode == "13") {
      event.preventDefault();
      this.loadEngines();
    }
  }

  async loadEngines(event, config) {
    if (event) {
      event.preventDefault();
    }
    await this.initialize();

    if (config) {
      if (!validateConfiguration(JSON.parse(config))) {
        this.#config = null;
        throw new Error("Invalid Config");
      }
      this.#config = config;
    }
    if (!this.#config) {
      return;
    }

    let options = {
      configUrl: this.#config,
      locale: this.shadowRoot.getElementById("locale-select").value,
      region: this.shadowRoot.getElementById("region-select").value,
      distroID: this.shadowRoot.getElementById("distro-id").value,
      experiment: this.shadowRoot.getElementById("experiment-id").value,
    };

    let { engines, private: privateDefault } =
      await browser.experiments.searchengines.getEngines(options);

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
    this.shadowRoot.getElementById("engines-table").textContent = "";
    this.shadowRoot.getElementById("engines-table").appendChild(fragment);

    this.shadowRoot.getElementById("private-browsing-engine").innerText =
      privateDefault ? privateDefault : "Unset";
  }

  async #loadRegionsAndLocales() {
    let locales = await getLocales();
    locales.unshift("default");
    Utils.insertOptionList(
      this.shadowRoot.getElementById("locale-select"),
      locales
    );
    this.shadowRoot.getElementById("locale-select").value =
      await browser.experiments.searchengines.getCurrentLocale();

    let regions = await getRegions();
    regions.unshift("default");
    Utils.insertOptionList(
      this.shadowRoot.getElementById("region-select"),
      regions
    );
    this.shadowRoot.getElementById("region-select").value =
      await browser.experiments.searchengines.getCurrentRegion();
  }
}
