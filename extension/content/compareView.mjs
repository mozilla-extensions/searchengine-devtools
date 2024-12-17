/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global Diff */

import Utils from "./utils.mjs";
import { validateConfiguration } from "./loader.mjs";

export default class CompareView extends HTMLElement {
  #oldConfig = null;
  #newConfig = null;

  constructor() {
    super();
    let template = document.getElementById("compare-view-template");
    let templateContent = template.content;

    let shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(templateContent.cloneNode(true));
    this.displayDiff = this.displayDiff.bind(this);
  }

  connectedCallback() {
    if (!this.isConnected) {
      return;
    }
    this.shadowRoot
      .getElementById("changed-sections")
      .addEventListener("change", this.displayDiff);
  }

  disconnectedCallback() {
    this.shadowRoot
      .getElementById("changed-sections")
      .removeEventListener("change", this.displayDiff);
  }

  async doDiffCalculation(oldConfig, newConfig) {
    this.#oldConfig = oldConfig;
    this.#newConfig = newConfig;

    const { oldConfigMap, newConfigMap, recordIds } =
      await this.#getDataForDiff();

    const shadowRoot = this.shadowRoot;
    const changedSections = shadowRoot.getElementById("changed-sections");
    Utils.removeAllChildren(changedSections);
    Utils.removeAllChildren(shadowRoot.getElementById("diff-display"));

    const fragment = document.createDocumentFragment();
    for (const id of recordIds) {
      const fullDiff = this.#getDiff(
        oldConfigMap.get(id),
        newConfigMap.get(id)
      );

      if (fullDiff.length > 1 || fullDiff[0].added || fullDiff[0].removed) {
        const option = document.createElement("option");
        option.appendChild(document.createTextNode(`${id}`));
        fragment.appendChild(option);
      }
    }
    shadowRoot.getElementById("changed-sections").appendChild(fragment);
  }

  async displayDiff() {
    const { oldConfigMap, newConfigMap } = await this.#getDataForDiff();

    const shadowRoot = this.shadowRoot;
    const id = shadowRoot.getElementById("changed-sections").value;
    const fullDiff = this.#getDiff(oldConfigMap.get(id), newConfigMap.get(id));

    const diffDisplay = shadowRoot.getElementById("diff-display");
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

  /**
   * Returns data required to figure out the differences between the two
   * configurations.
   *
   * @returns {object}
   *   An object containing:
   *   - {Map} [oldConfigMap]
   *   - {Map} [newConfigMap]
   *   - {Set} recordIds
   *   The maps have keys that are either the identifier of the record, or the
   *   record type if there is no identifier. The values are the configuration
   *   records, stripped of unnecessary fields (last_modified, remote settings id,
   *   remote settings schema).
   *   recordIds is a set of either the identifier of the record, or the
   *   record type if there is no identifier.
   */
  async #getDataForDiff() {
    const recordIds = new Set();

    if (
      !(await validateConfiguration(this.#oldConfig)) ||
      !(await validateConfiguration(this.#newConfig))
    ) {
      throw new Error("Configuration is invalid for getDiffData");
    }

    function mapConfig(configData) {
      const map = new Map();
      for (const config of configData) {
        recordIds.add(config.identifier ?? config.recordType);
        const newConfigData = { ...config };
        delete newConfigData.last_modified;
        delete newConfigData.id;
        delete newConfigData.schema;
        map.set(config.identifier ?? config.recordType, newConfigData);
      }
      return map;
    }

    const result = {
      oldConfigMap: mapConfig(this.#oldConfig.data),
      newConfigMap: mapConfig(this.#newConfig.data),
    };

    result.recordIds = [...recordIds.keys()].sort((a, b) => {
      // Put defaultEngines & engineOrders at the top so that it is more
      // obvious we're changing these.
      if (a == "defaultEngines" || a == "engineOrders") {
        return -1;
      }
      if (b == "defaultEngines" || b == "engineOrders") {
        return 1;
      }
      return a.localeCompare(b);
    });

    return result;
  }

  #getDiff(oldObj, newObj) {
    return Diff.diffJson(oldObj || {}, newObj || {});
  }
}
