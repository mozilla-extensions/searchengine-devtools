/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export default class EngineUrlView extends HTMLElement {
  /**
   * The table that has been created by this view.
   * @type {?HTMLTableElement}
   */
  #table = null;

  constructor() {
    super();
  }

  async loadEngineUrls(config) {
    const COL_HEADERS = [
      "URL Type",
      "",
      // TODO: Add Method display
      // "Method",
    ];
    const ROW_HEADERS = ["search", "suggest", "trending"];

    let sortedUrls = ROW_HEADERS.map((key) => config.urls[key]);

    if (!this.#table) {
      this.createTableFragment(COL_HEADERS, ROW_HEADERS);
    }

    this.#updateTable(`Full URL for ${config.name}`, sortedUrls);
  }

  createTableFragment(colHeaders, rowHeaders) {
    let fragment = document.createDocumentFragment();
    this.#table = document.createElement("table");

    let thead = this.#table.createTHead();
    let tbody = this.#table.createTBody();

    // Create header row
    let headerRow = thead.insertRow(-1);
    colHeaders.forEach((header) =>
      this.createAndAppendCell(headerRow, "th", header)
    );

    // Create body rows
    rowHeaders.forEach((header) => {
      let row = tbody.insertRow(-1);
      this.createAndAppendCell(row, "th", header);

      let cell = row.insertCell(-1);
      cell.textContent = "";
    });

    fragment.appendChild(this.#table);
    this.appendChild(fragment);
  }

  #updateTable(header, sortedUrls) {
    this.#table.tHead.rows[0].cells[1].textContent = header;

    let tBody = this.#table.tBodies[0];

    sortedUrls.forEach((url, index) => {
      if (url) {
        tBody.rows[index].cells[1].replaceChildren(this.createAnchor(url));
      } else {
        tBody.rows[index].cells[1].textContent = "Not Specified";
      }
    });
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
    this.#table = null;
  }
}
