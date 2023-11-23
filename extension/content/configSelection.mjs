/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export default class ConfigSelection extends HTMLElement {
  constructor() {
    super();
    let template = document.getElementById("config-selection-template");
    let templateContent = template.content;

    let shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(templateContent.cloneNode(true));

    let select = this.getAttribute("select");
    if (select) {
      this.shadowRoot.getElementById(select).checked = true;
    }

    this.onChange = this.onChange.bind(this);
  }

  connectedCallback() {
    if (!this.isConnected) {
      return;
    }
    for (let selector of this.shadowRoot.querySelectorAll(
      "input[name='server-radio']"
    )) {
      selector.addEventListener("change", this.onChange.bind(this));
    }
  }

  disconnectedCallback() {
    for (let selector of this.shadowRoot.querySelectorAll(
      "input[name='server-radio']"
    )) {
      selector.removeEventListener("change", this.onChange.bind(this));
    }
  }

  get selected() {
    return this.shadowRoot.querySelectorAll(
      "input[name='server-radio']:checked"
    )[0].value;
  }

  onChange() {
    this.dispatchEvent(new Event("change"));
  }
}
