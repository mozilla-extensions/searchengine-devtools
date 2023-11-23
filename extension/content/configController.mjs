/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { fetchCached, validateConfiguration } from "./loader.mjs";

const ENGINES_URLS = {
  "prod-main":
    "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/search-config/records?_cachebust=%CACHEBUST%",
  "prod-preview":
    "https://firefox.settings.services.mozilla.com/v1/buckets/main-preview/collections/search-config/records?_cachebust=%CACHEBUST%",
  "stage-main":
    "https://firefox.settings.services.allizom.org/v1/buckets/main/collections/search-config/records?_cachebust=%CACHEBUST%",
  "stage-preview":
    "https://firefox.settings.services.allizom.org/v1/buckets/main-preview/collections/search-config/records?_cachebust=%CACHEBUST%",
};

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

  set compareConfigsSelected(selected) {
    this.#compareConfigsSelected = selected;
    this.update();
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
      if (!validateConfiguration(config)) {
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

  fetchPrimaryConfig() {
    const buttonValue =
      this.shadowRoot.getElementById(`primary-config`).selected;
    if (buttonValue == "local-text") {
      return this.shadowRoot.getElementById("config").value;
    }
    return fetchCached(ENGINES_URLS[buttonValue]);
  }

  fetchSecondaryConfig() {
    const buttonValue =
      this.shadowRoot.getElementById(`compare-config`).selected;
    if (buttonValue == "local-text") {
      return this.shadowRoot.getElementById("config").value;
    }
    return fetchCached(ENGINES_URLS[buttonValue]);
  }

  get selected() {
    return this.shadowRoot.querySelectorAll(
      "input[name='server-radio']:checked"
    )[0].value;
  }

  onChange() {
    console.log("change!");
    console.log(this.getAttribute("select"));
    this.dispatchEvent(new Event("change"));
  }
}
