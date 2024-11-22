/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Handles display of the suggestion results
 */

export default class EngineSuggestionsView extends HTMLElement {
  /**
   * The table that has been created by this view.
   * @type {?HTMLTableElement}
   */
  #table = null;

  constructor() {
    super();
  }

  #tableName(suggestionsType, engineName) {
    switch (suggestionsType) {
      case "suggest":
        return "Suggestion Results for " + engineName;
      case "trending":
        return "Trending Results for " + engineName;
      default:
        throw new Error("Invalid suggestions type");
    }
  }

  displaySuggestions(results, suggestionsType, engineName) {
    if (!this.#table) {
      this.createTable();
    }

    let tHead = this.#table.tHead;
    let headerCell = tHead.getElementsByTagName("th")[0];
    headerCell.textContent = this.#tableName(suggestionsType, engineName);

    let tBody = this.#table.tBodies[0];
    tBody.replaceChildren();

    for (let result of results) {
      let cell = document.createElement("td");
      cell.textContent = result;
      tBody.insertRow().appendChild(cell);
    }
  }

  createTable() {
    let fragment = document.createDocumentFragment();
    this.#table = document.createElement("table");

    let tHead = this.#table.createTHead();
    let headerRow = tHead.insertRow();
    headerRow.appendChild(document.createElement("th"));

    this.#table.createTBody();
    fragment.appendChild(this.#table);
    this.appendChild(fragment);
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
