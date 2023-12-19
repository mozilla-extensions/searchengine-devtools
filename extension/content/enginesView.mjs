/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Utils from "./utils.mjs";
import { getLocales, getRegions, validateConfiguration } from "./loader.mjs";

const enginesSelectionElements = [
  "region-select",
  "locale-select",
  "application-name",
  "distro-id",
  "experiment-id",
];

export default class EnginesView extends HTMLElement {
  #config = null;
  #attachmentBaseUrl = null;
  #iconConfig = null;
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

    return (this.#initializedPromise = this.#loadSelectElements());
  }

  handleKeyPress(event) {
    if (event.keyCode == "13") {
      event.preventDefault();
      this.loadEngines();
    }
  }

  async loadEngines(event, config, attachmentBaseUrl, iconConfig) {
    if (event) {
      event.preventDefault();
    }
    await this.initialize();

    if (config) {
      if (!(await validateConfiguration(JSON.parse(config)))) {
        this.#config = null;
        this.#iconConfig = null;
        this.#attachmentBaseUrl = null;
        throw new Error("Invalid Config");
      }
      this.#config = config;
      this.#iconConfig = JSON.parse(iconConfig);
      this.#attachmentBaseUrl = attachmentBaseUrl;
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
      appName: this.shadowRoot.getElementById("application-name").value,
    };

    let { engines, private: privateDefault } =
      await browser.experiments.searchengines.getEngines(options);

    let fragment = document.createDocumentFragment();
    Utils.addDiv(fragment, "Default Display Order");
    Utils.addDiv(fragment, "Identifier");
    Utils.addDiv(fragment, "Display Name");
    Utils.addDiv(fragment, "Telemetry Id");
    Utils.addDiv(fragment, "Partner Code");
    Utils.addDiv(fragment, "Classification");
    Utils.addDiv(fragment, "Aliases");
    Utils.addDiv(fragment, "Desktop Icon");
    for (let [i, e] of engines.entries()) {
      if (i == 0) {
        Utils.addDiv(fragment, "1 (Application Default)", e.identifier);
      } else {
        Utils.addDiv(fragment, i + 1, e.identifier);
      }
      Utils.addDiv(fragment, e.identifier, e.identifier);
      Utils.addDiv(fragment, e.name, e.identifier);
      Utils.addDiv(
        fragment,
        "telemetrySuffix" in e
          ? `${e.identifier}-${e.telemetrySuffix}`
          : e.identifier,
        e.identifier
      );
      Utils.addDiv(fragment, e.partnerCode, e.identifier);
      Utils.addDiv(fragment, e.classification, e.identifier);
      Utils.addDiv(fragment, JSON.stringify(e.aliases), e.identifier);
      Utils.addImage(
        fragment,
        this.#attachmentBaseUrl + this.#getIcon(e.identifier),
        e.identifier
      );
    }
    this.shadowRoot.getElementById("engines-table").textContent = "";
    this.shadowRoot.getElementById("engines-table").appendChild(fragment);

    this.shadowRoot.getElementById("private-browsing-engine").innerText =
      privateDefault ? privateDefault : "Unset";
  }

  async #loadSelectElements() {
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

  #getIcon(identifier) {
    let record = this.#iconConfig?.data?.find((r) => {
      return (
        r.imageSize == 16 &&
        r.filter_expression ==
          'env.appinfo.ID == "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}"' &&
        r.engineIdentifiers.some((i) => {
          if (i.endsWith("*")) {
            return identifier.startsWith(i.slice(0, -1));
          }
          return identifier == i;
        })
      );
    });

    return record?.attachment.location;
  }
}
