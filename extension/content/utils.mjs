/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let Utils = {
  addDiv(element, content, dataId = "", className = "") {
    let div = document.createElement("div");
    div.textContent = content;
    if (dataId) {
      div.setAttribute("data-id", dataId);
    }
    if (className) {
      div.className = className;
    }
    element.appendChild(div);
  },

  addImage(element, src, dataId = "") {
    let div = document.createElement("div");
    if (dataId) {
      div.setAttribute("data-id", dataId);
    }
    if (src) {
      let image = document.createElement("img");
      image.src = src;
      div.appendChild(image);
    }
    element.appendChild(div);
  },

  insertOptionList(field, list) {
    let fragment = document.createDocumentFragment();
    for (let item of list) {
      let option = document.createElement("option");
      option.text = item;
      fragment.appendChild(option);
    }
    field.appendChild(fragment);
  },

  removeAllChildren(element) {
    while (element.firstChild) {
      element.firstChild.remove();
    }
  },

  calculateTelemetryId(engineData) {
    return "telemetrySuffix" in engineData
      ? `${engineData.identifier}-${engineData.telemetrySuffix}`
      : engineData.identifier;
  },
};

export default Utils;
