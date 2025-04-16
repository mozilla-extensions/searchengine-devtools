/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import Utils from "./utils.mjs";
import { validateConfiguration, validateIconConfiguration } from "./loader.mjs";

export default class AllEnginesView extends HTMLElement {
  /**
   * @type {HTMLTableElement}
   */
  #allEnginesTable;
  #config = null;
  #attachmentBaseUrl = null;
  #iconConfig = null;

  constructor() {
    super();
    let template = document.getElementById("all-engines-view-template");
    let templateContent = template.content;

    let shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(templateContent.cloneNode(true));

    this.exportToCsv = this.exportToCsv.bind(this);
  }

  connectedCallback() {
    if (!this.isConnected) {
      return;
    }
    this.#allEnginesTable = this.shadowRoot.getElementById("all-engines-table");
    this.shadowRoot
      .getElementById("export-to-csv")
      .addEventListener("click", this.exportToCsv);
  }

  disconnectedCallback() {
    this.#allEnginesTable = null;
    this.shadowRoot
      .getElementById("export-to-csv")
      .removeEventListener("click", this.exportToCsv);
  }

  async loadEngines(event, config, attachmentBaseUrl, iconConfig) {
    if (!config) {
      return;
    }
    if (event) {
      event.preventDefault();
    }

    await this.#validateConfigs(config, attachmentBaseUrl, iconConfig);

    let body = this.#allEnginesTable.tBodies[0];
    let rows = body.rows;
    let currentRowIndex = 0;

    let records = this.#config.data
      .filter((r) => r.recordType == "engine")
      .sort(sortRecordsByIdentifier);

    for (let record of records) {
      let row;
      if (rows.length <= currentRowIndex) {
        row = body.insertRow();

        // Icon
        let imageCell = row.insertCell();
        imageCell.className = "icon";
        // Identifier
        row.insertCell();
        // Display Name
        row.insertCell();
        // Domain
        row.insertCell();
        // Applications
        row.insertCell();
        // Deployed To
        let deployedCell = row.insertCell();
        deployedCell.className = "deployed";
      } else {
        row = rows[currentRowIndex];
      }

      Utils.addOrUpdateImage(
        row.children[0],
        this.#attachmentBaseUrl +
          Utils.getIcon(this.#iconConfig, record.identifier),
        16
      );
      row.children[1].textContent = record.identifier;
      row.children[2].textContent = record.base.name;
      row.children[3].textContent = new URL(record.base.urls.search.base).host;
      this.#insertApplications(row.children[4], record.variants);
      this.#insertDeployments(row.children[5], record);

      currentRowIndex++;
    }

    // Remove any extra rows that are no longer needed, e.g. the list of engines
    // has reduced from the previous version of the configuration that was
    // displayed.
    while (rows.length > currentRowIndex) {
      body.deleteRow(rows.length - 1);
    }
  }

  exportToCsv() {
    let content = [];

    content.push(
      Array.from(this.#allEnginesTable.tHead.rows[0].children)
        .slice(1)
        .map((c) => convertTextToCsvFormat(c.innerText))
    );
    for (let row of this.#allEnginesTable.tBodies[0].rows) {
      let rowString = "";
      // Skip the first column as that's for icons.
      for (let i = 1; i < row.children.length; i++) {
        if (i > 1) {
          rowString += ",";
        }
        // The last column is the deployed to, which we treat differently.
        if (i == row.children.length - 1) {
          let columnString = "";
          for (let node of row.children[i].childNodes) {
            if (node.nodeName == "#text") {
              columnString += node.textContent;
            } else if (node.nodeName == "BR") {
              columnString += " AND ";
            } else if (node.nodeName == "HR") {
              rowString += convertTextToCsvFormat(columnString) + ",";
              columnString = "";
            }
          }
          rowString += convertTextToCsvFormat(columnString);
        } else {
          rowString += convertTextToCsvFormat(row.children[i].innerText);
        }
      }
      content.push(rowString);
    }

    let link = document.createElement("a");
    link.download = "engines-info.csv";

    let blob = new Blob([content.join("\n")], { type: "text/plain" });

    link.href = URL.createObjectURL(blob);

    link.click();

    URL.revokeObjectURL(link.href);
  }

  async #validateConfigs(config, attachmentBaseUrl, iconConfig) {
    let parsedConfig = JSON.parse(config);
    let parsedIconConfig = JSON.parse(iconConfig);
    if (
      !(await validateConfiguration(parsedConfig)) ||
      !(await validateIconConfiguration(parsedIconConfig))
    ) {
      this.#config = null;
      this.#iconConfig = null;
      this.#attachmentBaseUrl = null;
      throw new Error("Invalid Config");
    }
    this.#config = parsedConfig;
    this.#iconConfig = await Utils.filterIconConfig(parsedIconConfig);
    this.#attachmentBaseUrl = attachmentBaseUrl;
  }

  #insertApplications(parentElement, variants) {
    Utils.removeAllChildren(parentElement);

    let apps = this.#findApplications(variants);

    for (let i = 0; i < apps.length; i++) {
      parentElement.appendChild(document.createTextNode(apps[i]));
      if (i + 1 < apps.length) {
        parentElement.appendChild(document.createElement("br"));
      }
    }
  }

  #findApplications(variants) {
    let specifiedApplications = new Set();
    for (let variant of variants) {
      let applications = variant?.environment?.applications;
      if (!applications) {
        // If we don't have applications specified, then it will be available to all.
        return ["all"];
      }
      // Otherwise figure out if the engine is available to all or not.
      for (let application of applications) {
        specifiedApplications.add(application);
      }
    }

    if (!specifiedApplications.size) {
      return ["all"];
    }

    return [...specifiedApplications.values()];
  }

  /**
   * Inserts deployment information for a given record into a table cell.
   * @param {HTMLTableCellElement} parentElement
   * @param {object} record
   */
  #insertDeployments(parentElement, record) {
    Utils.removeAllChildren(parentElement);

    let deployments = [];
    for (let variant of record.variants) {
      if (variant.environment) {
        if (variant.environment.allRegionsAndLocales) {
          if (!variant.environment.excludedLocales) {
            if (variant.optional) {
              parentElement.textContent = "(Optional) All Configurations";
              return;
            }
            parentElement.textContent = "All Configurations";
            return;
          }
          if (record.identifier == "wikipedia") {
            parentElement.textContent =
              "All Configurations except locales where other Wikipedias are deployed.";
            return;
          }
          parentElement.textContent =
            "All Configurations excluding locales " +
            variant.environment.excludedLocales.join("\n");
          return;
        }
        deployments.push(variant.environment);
      }
    }

    let addedOneDeployment = false;
    for (let deployment of deployments) {
      if (addedOneDeployment) {
        parentElement.appendChild(document.createElement("hr"));
      }

      let addedItem = false;
      if (deployment.distributions) {
        this.#appendTextChild(
          parentElement,
          `Distributions: ${deployment.distributions.join(", ")}`
        );
        addedItem = true;
      }
      if (deployment.locales) {
        this.#maybeAppendBr(parentElement, addedItem);
        this.#appendTextChild(
          parentElement,
          `Locales: ${deployment.locales.join(", ")}`
        );
        addedItem = true;
      }
      if (deployment.regions) {
        this.#maybeAppendBr(parentElement, addedItem);
        this.#appendTextChild(
          parentElement,
          `Regions: ${deployment.regions.map((r) => r.toUpperCase()).join(", ")}`
        );
        addedItem = true;
      }
      addedOneDeployment = true;
    }
  }

  #maybeAppendBr(parentElement, itemHasBeenAdded) {
    if (itemHasBeenAdded) {
      parentElement.appendChild(document.createElement("br"));
    }
  }

  #appendTextChild(parentElement, text) {
    parentElement.appendChild(document.createTextNode(text));
  }
}

function convertTextToCsvFormat(text) {
  return `"${text.replaceAll("\n", ",").replaceAll('"', '""')}"`;
}

function sortRecordsByIdentifier(a, b) {
  if (!b.identifier) {
    return -1;
  }
  if (!a.identifier) {
    return 1;
  }
  if (a.identifier < b.identifier) {
    return -1;
  }
  if (a.identifier > b.identifier) {
    return 1;
  }
  return 0;
}
