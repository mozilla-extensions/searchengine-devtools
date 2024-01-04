/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { fetchCached, validateConfiguration } from "./loader.mjs";

export default class ConfigController extends HTMLElement {
  #compareConfigsSelected = false;

  constructor() {
    super();
    let template = document.getElementById("config-controller-template");
    let templateContent = template.content;

    let shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(templateContent.cloneNode(true));

    shadowRoot
      .getElementById("primary-config")
      .addEventListener("change", this.onChange.bind(this));
    shadowRoot
      .getElementById("compare-config")
      .addEventListener("change", this.onChange.bind(this));
    shadowRoot
      .getElementById("reload-page")
      .addEventListener("click", this.onChange.bind(this));
  }

  async setCompareConfigsSelected(selected) {
    this.#compareConfigsSelected = selected;
    await this.update();
  }

  async update() {
    this.shadowRoot.getElementById("compare-config").hidden =
      !this.#compareConfigsSelected;

    let loadPrimaryConfigFromServer =
      this.shadowRoot.getElementById("primary-config").selected !=
        "local-text" &&
      !(
        this.#compareConfigsSelected &&
        this.shadowRoot.getElementById("compare-config").selected ==
          "local-text"
      );

    this.shadowRoot.getElementById("config").hidden =
      !!loadPrimaryConfigFromServer;
    this.shadowRoot.getElementById("reload-page").hidden =
      !!loadPrimaryConfigFromServer;

    if (loadPrimaryConfigFromServer) {
      let config = JSON.parse(await this.fetchPrimaryConfig());
      try {
        if (!(await validateConfiguration(config))) {
          this.updateInvalidMessageDisplay(false);
          this.shadowRoot.getElementById("config").value = "";
          return;
        }
      } catch (ex) {
        this.updateInvalidMessageDisplay(false);
        this.shadowRoot.getElementById("config").value = "";
        return;
      }
      this.updateInvalidMessageDisplay(true);
      this.shadowRoot.getElementById("config").value = JSON.stringify(
        config,
        null,
        2
      );
    }
  }

  updateInvalidMessageDisplay(valid) {
    if (!valid) {
      this.shadowRoot.getElementById("config-error").removeAttribute("hidden");
      return false;
    }
    this.shadowRoot
      .getElementById("config-error")
      .setAttribute("hidden", "true");
    return true;
  }

  async fetchPrimaryConfig() {
    const buttonValue =
      this.shadowRoot.getElementById(`primary-config`).selected;
    if (buttonValue == "local-text") {
      return this.shadowRoot.getElementById("config").value;
    }
    return fetchCached(await this.#getEngineUrl(buttonValue));
  }

  async fetchSecondaryConfig() {
    const buttonValue =
      this.shadowRoot.getElementById(`compare-config`).selected;
    if (buttonValue == "local-text") {
      return this.shadowRoot.getElementById("config").value;
    }
    return fetchCached(await this.#getEngineUrl(buttonValue));
  }

  async fetchConfigOverrides() {
    const buttonValue =
      this.shadowRoot.getElementById(`primary-config`).selected;
    if (buttonValue == "local-text") {
      return '{"data":[]}';
    }
    return fetchCached(await this.#getEngineUrl(buttonValue, true));
  }

  async getAttachmentBaseUrl() {
    const buttonValue =
      this.shadowRoot.getElementById(`primary-config`).selected;
    if (buttonValue == "local-text") {
      return undefined;
    }

    return buttonValue.startsWith("prod")
      ? "https://firefox-settings-attachments.cdn.mozilla.net/"
      : "https://firefox-settings-attachments.cdn.allizom.org/";
  }

  async fetchIconConfig() {
    const buttonValue =
      this.shadowRoot.getElementById(`primary-config`).selected;
    if (buttonValue == "local-text") {
      return "{}";
    }
    return fetchCached(await this.#getIconsUrl(buttonValue));
  }

  get selected() {
    return this.shadowRoot.querySelectorAll(
      "input[name='server-radio']:checked"
    )[0].value;
  }

  onChange() {
    this.dispatchEvent(new Event("change"));
  }

  moveConfigToId(id) {
    if (this.shadowRoot.getElementById("config").hidden) {
      return;
    }
    let textarea = this.shadowRoot.getElementById("config");
    let line = textarea.value.split(id)[0].match(/\n/g).length;
    var lineHeight = document.defaultView
      .getComputedStyle(textarea)
      .getPropertyValue("line-height");
    textarea.scrollTop = line * parseInt(lineHeight, 10);
  }

  async #getEngineUrl(server, overrides) {
    let url =
      this.#getConfigUrl(server) +
      "collections/search-config" +
      (overrides ? "-overrides" : "");

    if (
      (await browser.experiments.searchengines.getCurrentConfigFormat()) == "2"
    ) {
      url += "-v2";
    }

    return url + "/records?_cachebust=%CACHEBUST%";
  }

  #getIconsUrl(server) {
    return (
      this.#getConfigUrl(server) +
      "collections/search-config-icons/records?_cachebust=%CACHEBUST%"
    );
  }

  #getConfigUrl(server) {
    let url = this.#getBaseUrl(server) + "buckets/main";

    if (server.includes("preview")) {
      url += "-preview";
    }

    return url + "/";
  }

  #getBaseUrl(server) {
    return server.startsWith("prod")
      ? "https://firefox.settings.services.mozilla.com/v1/"
      : "https://firefox.settings.services.allizom.org/v1/";
  }
}
