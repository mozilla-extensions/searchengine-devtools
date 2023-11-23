/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env node */

const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const standaloneCode = require("ajv/dist/standalone").default;
const addFormats = require("ajv-formats");

let schemaV1 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "search-engine-config-schema.json"))
);
let schemaV2 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "search-engine-config-v2-schema.json"))
);

schemaV1.$id = "validateWithSchemaV1";
schemaV2.$id = "validateWithSchemaV2";

const ajv = new Ajv({
  schemas: [schemaV1, schemaV2],
  code: { source: true },
});
addFormats(ajv);
const moduleCode = standaloneCode(ajv);

// Now you can write the module code to file
fs.writeFileSync(path.join(__dirname, "../validate.js"), moduleCode);
