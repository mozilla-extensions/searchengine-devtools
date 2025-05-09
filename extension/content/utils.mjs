/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class _Utils {
  /**
   * @type {string}
   *   The current browser platform.
   */
  #platform = null;

  addDiv(element, content, data = "", className = "") {
    let div = document.createElement("div");
    div.textContent = content;
    if (data) {
      div.data = data;
    }
    if (className) {
      div.className = className;
    }
    element.appendChild(div);
  }

  addImage(element, src, size, data = "") {
    let div = document.createElement("div");
    if (data) {
      div.data = data;
    }
    if (src) {
      let image = document.createElement("img");
      image.src = src;
      image.setAttribute("size", size);
      div.appendChild(image);
    }
    element.appendChild(div);
  }

  insertOptionList(field, list) {
    let fragment = document.createDocumentFragment();
    for (let item of list) {
      let option = document.createElement("option");
      option.text = item;
      fragment.appendChild(option);
    }
    field.appendChild(fragment);
  }

  removeAllChildren(element) {
    while (element.firstChild) {
      element.firstChild.remove();
    }
  }

  calculateTelemetryId(engineData) {
    return "telemetrySuffix" in engineData
      ? `${engineData.identifier}-${engineData.telemetrySuffix}`
      : engineData.identifier;
  }

  /**
   * Filters search-config-icons, keeping records without a filter expression or
   * with expressions that matches the current platform. Only supports filtering
   * by OS, as that is all we currently require for search-config-icons.
   *
   * @param {object[]} unfilteredConfig
   * @returns object[]
   */
  async filterIconConfig(unfilteredConfig) {
    if (!this.#platform) {
      this.#platform = (await browser.runtime.getPlatformInfo()).os;
    }
    let result = [];
    for (let record of unfilteredConfig.data) {
      if (
        !record.filter_expression ||
        (await browser.experiments.searchengines.jexlFilterMatches(
          record.filter_expression,
          this.#platform
        ))
      ) {
        result.push(record);
      }
    }
    return result;
  }

  /**
   * Finds an icon in the remote settings records, according to the required
   * size and returns the location.
   *
   * @param {object[]} iconConfig
   *   The filtered array of icon records from search-config-icons.
   * @param {string} engineIdentifier
   *   The engine identifier.
   * @param {number} iconSize
   *   The requested size of the icon.
   * @returns {string}
   *   The location of the icon on the remote settings server.
   */
  getIcon(iconConfig, engineIdentifier, iconSize) {
    for (let record of iconConfig ?? []) {
      if (
        (!iconSize || record.imageSize == iconSize) &&
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

const Utils = new _Utils();
export default Utils;
