/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export default class EngineUrlView extends HTMLElement {
  constructor() {
    super();
  }

  async loadEngineUrls(config) {
    const COL_HEADERS = [
      "URL Type",
      `Full URL for ${config.name} `,
      // TODO: Add Method display
      // "Method",
    ];
    const ROW_HEADERS = ["search", "suggest", "trending"];

    let urls = await browser.experiments.searchengines.getEngineUrls(config);
    let sortedUrls = ROW_HEADERS.map((key) => urls[key]);

    let fragment = this.createTableFragment(
      COL_HEADERS,
      ROW_HEADERS,
      sortedUrls
    );

    this.appendChild(fragment);

    return fragment;
  }

  createTableFragment(colHeaders, rowHeaders, sortedUrls) {
    let fragment = document.createDocumentFragment();
    let table = document.createElement("table");
    let thead = table.createTHead();
    let tbody = table.createTBody();

    // Create header row
    let headerRow = thead.insertRow(-1);
    colHeaders.forEach((header) =>
      this.createAndAppendCell(headerRow, "th", header)
    );

    // Create body rows
    rowHeaders.forEach((header, index) => {
      let row = tbody.insertRow(-1);
      this.createAndAppendCell(row, "th", header);

      let cell = row.insertCell(-1);
      let url = sortedUrls[index];
      if (url) {
        cell.appendChild(this.createAnchor(url));
      } else {
        cell.textContent = "Not Specified";
      }
    });

    fragment.appendChild(table);
    return fragment;
  }

  createAndAppendCell(row, cellType, textContent) {
    let cell = document.createElement(cellType);
    cell.textContent = textContent;
    row.appendChild(cell);
  }

  createAnchor(url) {
    let a = document.createElement("a");
    a.href = url;
    a.textContent = url;
    a.target = "_blank";
    return a;
  }

  clear() {
    for (let childNode of this.children) {
      if (childNode.tagName.toLowerCase() == "table") {
        childNode.remove();
      }
    }
  }
}
