/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class _Utils {
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

  /**
   * Adds an image in the element.
   *
   * @param {Element} parentElement
   * @param {string} imageUrl
   * @param {number} imageSize
   * @param {string} data
   *   Any data to add as a property onto the div.
   */
  addImage(parentElement, imageUrl, imageSize, data = "") {
    let div = document.createElement("div");
    if (data) {
      div.data = data;
    }
    if (imageUrl) {
      let image = document.createElement("img");
      image.src = imageUrl;
      image.setAttribute("size", imageSize);
      div.appendChild(image);
    }
    parentElement.appendChild(div);
  }

  /**
   * Adds multiple images in the element, indicating sizes if necessary.
   *
   * @param {Node} documentNode
   * @param {string} baseUrl
   * @param {{size: number, location: string, mimetype: string}[]} imageDetails
   * @param {string} data
   *   Any data to add as a property onto the div.
   */
  addImages(documentNode, baseUrl, imageDetails, data = "") {
    let div = document.createElement("div");
    if (data) {
      div.data = data;
    }

    // For now, we only display one image, as we only ever ship one size of
    // image in search-config-icons.
    if (imageDetails.length) {
      let anchor = document.createElement("a");
      anchor.href = baseUrl + imageDetails[0].location;
      anchor.target = "_blank";

      if (imageDetails[0].mimetype == "application/pdf") {
        anchor.textContent = "(pdf)";
      } else {
        let image = document.createElement("img");
        image.src = baseUrl + imageDetails[0].location;
        image.setAttribute("size", "16");
        anchor.appendChild(image);
      }
      div.appendChild(anchor);
    }
    documentNode.appendChild(div);
  }

  /**
   * Adds or updates the image in the element.
   *
   * @param {Node} documentNode
   * @param {string} baseUrl
   * @param {{size: number, location: string, mimetype: string}[]} imageDetails
   * @param {string} data
   *   Any data to add as a property onto the div.
   */
  addOrUpdateImages(documentNode, baseUrl, imageDetails, data = "") {
    // TODO: Revisit this at some stage and consider making it work, so that
    // when changing views, we're more efficient.
    // if (
    //   documentNode.firstChild?.tagName == "DIV" &&
    //   documentNode.firstChild.firstChild?.tagName == "IMG"
    //   documentNode.firstChild.firstChild?.getAttribute("size") == imageSize
    // ) {
    //   documentNode.firstChild.firstChild.src =
    //     baseUrl + imageDetails[0].location;
    //   return;
    // }
    this.removeAllChildren(documentNode);
    this.addImages(documentNode, baseUrl, imageDetails, data);
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
   * @type {Map<string, boolean>}
   *   A cache that is keyed by a record's filter_expression and the platform
   *   being searched for. The value is the result of calling jexlFilterMatches
   *   on the API.
   *
   *   This avoids repeatedly crossing the cross process boundary for each filter
   *   call, hence speeding up display of icons, especially on the allEnginesView.
   */
  #filterCache = new Map();

  /**
   * Filters search-config-icons, keeping records without a filter expression or
   * with expressions that matches the current platform. Only supports filtering
   * by OS, as that is all we currently require for search-config-icons.
   *
   * @param {object[]} unfilteredConfig
   * @returns object[]
   */
  async filterIconConfig(unfilteredConfig, platform) {
    let result = [];
    for (let record of unfilteredConfig.data) {
      if (!record.filter_expression) {
        result.push(record);
        continue;
      }

      if (
        this.#filterCache.has(record.filter_expression + platform) != undefined
      ) {
        if (this.#filterCache.get(record.filter_expression + platform)) {
          result.push(record);
          continue;
        }
      }

      let matches = await browser.experiments.searchengines.jexlFilterMatches(
        record.filter_expression,
        platform
      );

      this.#filterCache.set(record.filter_expression + platform, matches);

      if (matches) {
        result.push(record);
      }
    }
    return result;
  }

  /**
   * Finds any matching icon records in the remote settings records.
   *
   * @param {object[]} iconConfig
   *   The array of icon records from search-config-icons.
   * @param {string} engineIdentifier
   *   The engine identifier.
   * @param {string} platform
   *   The platform to get the icons for.
   */
  async getIcons(iconConfig, engineIdentifier, platform) {
    let filteredConfig = await this.filterIconConfig(iconConfig, platform);

    /** @type {{size: number, location: string, mimetype: string}[]} */
    let icons = [];

    for (let record of filteredConfig) {
      if (
        record.engineIdentifiers.some((i) => {
          if (i.endsWith("*")) {
            return engineIdentifier.startsWith(i.slice(0, -1));
          }
          return engineIdentifier == i;
        })
      ) {
        icons.push({
          size: record.imageSize,
          location: record.attachment.location,
          mimetype: record.attachment.mimetype,
        });
      }
    }
    return icons;
  }
}

const Utils = new _Utils();
export default Utils;
