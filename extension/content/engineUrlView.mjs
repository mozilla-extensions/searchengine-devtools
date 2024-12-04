/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export default class EngineUrlView extends HTMLElement {
  /**
   * The table that has been created by this view.
   * @type {?HTMLTableElement}
   */
  #table = null;

  #config = null;

  #suggestionsTable = document.getElementById("engine-suggestions-table");

  #ROW_HEADERS = ["search", "suggest", "trending", "searchForm"];

  constructor() {
    super();
  }

  async loadEngineUrls(config) {
    this.#suggestionsTable.clear();
    const COL_HEADERS = [
      "URL Type",
      "",
      "",
      // TODO: Add Method display
      // "Method",
    ];

    let sortedUrls = this.#ROW_HEADERS.map((key) => config.urls[key]);

    if (!this.#table) {
      this.createTableFragment(COL_HEADERS, this.#ROW_HEADERS);
    }

    this.#updateTable(`Full URL for ${config.name}`, sortedUrls);
    this.#config = config;
  }

  createTableFragment(colHeaders, rowHeaders) {
    let fragment = document.createDocumentFragment();
    this.#table = document.createElement("table");

    let thead = this.#table.createTHead();
    let tbody = this.#table.createTBody();

    // Create header row
    let headerRow = thead.insertRow();
    colHeaders.forEach((header) =>
      this.createAndAppendCell(headerRow, "th", header)
    );

    // Create body rows
    rowHeaders.forEach((header) => {
      let row = tbody.insertRow();
      this.createAndAppendCell(row, "th", header);

      let cell = row.insertCell();
      cell.textContent = "";
      cell = row.insertCell();
      if (header == "suggest" || header == "trending") {
        let button = document.createElement("button");
        button.style.visibility = "hidden";
        button.textContent = "Test";
        button.addEventListener(
          "click",
          this.testSuggestion.bind(this, header)
        );
        cell.appendChild(button);
      } else {
        cell.textContent = "";
      }
    });

    fragment.appendChild(this.#table);
    this.appendChild(fragment);
  }

  #updateTable(header, sortedUrls) {
    this.#table.tHead.rows[0].cells[1].textContent = header;

    let tBody = this.#table.tBodies[0];

    sortedUrls.forEach((url, index) => {
      let row = tBody.rows[index];
      let button = row.cells[2].getElementsByTagName("button")[0];

      if (url) {
        row.cells[1].replaceChildren(this.createAnchor(url));
        if (button) {
          button.style.visibility = "";
        }
      } else {
        row.cells[1].textContent = "Not Specified";
        if (button) {
          button.style.visibility = "hidden";
        }
      }
    });
  }

  async testSuggestion(header, event) {
    event.preventDefault();

    let url =
      this.#table.tBodies[0].rows[this.#ROW_HEADERS.indexOf(header)].children[1]
        .textContent;
    let result = await browser.experiments.searchengines.getSuggestions(
      url,
      header
    );

    let suggestions = result.suggestions;
    if (result.error) {
      suggestions = [result.error];
    } else if (!suggestions.length) {
      suggestions = ["Zero results"];
    }

    this.#suggestionsTable.displaySuggestions(
      suggestions,
      header,
      this.#config.name
    );
    document.getElementById("engine-suggestions-table").scrollIntoView();
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
    this.#config = null;

    this.#suggestionsTable.clear();
  }
}
