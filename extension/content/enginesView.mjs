/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Utils from "./utils.mjs";
import {
  getLocales,
  getRegions,
  validateConfiguration,
  validateConfigurationOverrides,
  validateIconConfiguration,
} from "./loader.mjs";

const enginesSelectionElements = [
  "region-select",
  "locale-select",
  "application-name",
  "application-version",
  "update-channel",
  "distro-id",
  "experiment-id",
];

export default class EnginesView extends HTMLElement {
  #config = null;
  #configOverrides = null;
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

  async loadEngines(
    event,
    config,
    configOverrides,
    attachmentBaseUrl,
    iconConfig
  ) {
    if (event) {
      event.preventDefault();
    }
    await this.initialize();

    document.getElementById("engine-urls-table").clear();

    if (config) {
      if (
        !(await validateConfiguration(JSON.parse(config))) ||
        !(await validateConfigurationOverrides(JSON.parse(configOverrides))) ||
        !(await validateIconConfiguration(JSON.parse(iconConfig)))
      ) {
        this.#config = null;
        this.#configOverrides = null;
        this.#iconConfig = null;
        this.#attachmentBaseUrl = null;
        throw new Error("Invalid Config");
      }
      this.#config = config;
      this.#configOverrides = configOverrides;
      this.#iconConfig = JSON.parse(iconConfig);
      this.#attachmentBaseUrl = attachmentBaseUrl;
    }
    if (!this.#config) {
      return;
    }

    let options = {
      configData: this.#config,
      configOverridesData: this.#configOverrides,
      locale: this.shadowRoot.getElementById("locale-select").value,
      region: this.shadowRoot.getElementById("region-select").value,
      distroID: this.shadowRoot.getElementById("distro-id").value,
      experiment: this.shadowRoot.getElementById("experiment-id").value,
      channel: this.shadowRoot.getElementById("update-channel").value,
      appName: this.shadowRoot.getElementById("application-name").value,
      version: this.shadowRoot.getElementById("application-version").value,
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
    Utils.addDiv(fragment, "Desktop Icon (16)");
    Utils.addDiv(fragment, "Desktop Icon (24)");
    for (let [i, e] of engines.entries()) {
      if (i == 0) {
        Utils.addDiv(fragment, "1 (Application Default)", e);
      } else {
        Utils.addDiv(fragment, i + 1, e);
      }
      Utils.addDiv(fragment, e.identifier, e);
      Utils.addDiv(fragment, e.name, e);
      Utils.addDiv(
        fragment,
        "telemetrySuffix" in e
          ? `${e.identifier}-${e.telemetrySuffix}`
          : e.identifier,
        e
      );
      Utils.addDiv(fragment, e.partnerCode, e);
      Utils.addDiv(fragment, e.classification, e);
      Utils.addDiv(fragment, JSON.stringify(e.aliases), e);
      // We should always have a 16x16.
      Utils.addImage(
        fragment,
        this.#attachmentBaseUrl + (await this.#getIcon(e.identifier, 16)),
        16,
        e
      );
      // 24x24 is newer so may not exist.
      let icon24 = await this.#getIcon(e.identifier, 24);
      if (icon24) {
        Utils.addImage(
          fragment,
          this.#attachmentBaseUrl + icon24,
          24,
          e.identifier
        );
      } else {
        Utils.addDiv(fragment, "", e.identifier);
      }
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

  /**
   * Finds an icon in the remote settings records, according to the required
   * size and returns the location.
   *
   * @param {string} engineIdentifier
   *   The engine identifier.
   * @param {number} iconSize
   *   The requested size of the icon.
   * @returns {string}
   *   The location of the icon on the remote settings server.
   */
  async #getIcon(engineIdentifier, iconSize) {
    let browserInfo = await browser.runtime.getBrowserInfo();
    for (let record of this.#iconConfig?.data ?? []) {
      if (
        record.imageSize == iconSize &&
        (await browser.experiments.searchengines.jexlFilterMatches(
          record.filter_expression,
          "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
          browserInfo.version
        )) &&
        record.engineIdentifiers.some((i) => {
          if (i.endsWith("*")) {
            return engineIdentifier.startsWith(i.slice(0, -1));
          }
          return engineIdentifier == i;
        })
      ) {
        return record.attachment.location;
      }
    }
    return null;
  }
}
