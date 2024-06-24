/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let Utils = {
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
  },

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
