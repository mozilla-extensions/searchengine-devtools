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
      "Method",
      "Results",
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

  createTableFragment(headers, rowHeaders, sortedUrls) {
    let fragment = document.createDocumentFragment();
    let table = document.createElement("table");
    let thead = document.createElement("thead");
    let tbody = this.createTableBody(rowHeaders);

    Array.from(tbody.children).forEach((row, index) => {
      let td = document.createElement("td");
      let a = document.createElement("a");
      a.href = sortedUrls[index];
      a.text = sortedUrls[index];
      td.appendChild(a);
      row.append(td);
    });

    thead.appendChild(this.createTableRow(headers, "th"));
    table.appendChild(thead);
    table.appendChild(tbody);
    fragment.appendChild(table);

    return fragment;
  }

  createTableBody(rowHeaders) {
    let tbody = document.createElement("tbody");
    rowHeaders.forEach((header) => {
      let row = this.createTableRow([header], "th");
      tbody.appendChild(row);
    });

    return tbody;
  }

  createTableRow(cellData, cellType) {
    let tr = document.createElement("tr");
    cellData.forEach((data) => {
      let cell = document.createElement(cellType);
      let text = document.createTextNode(data);
      cell.appendChild(text);
      tr.appendChild(cell);
    });

    return tr;
  }
}
