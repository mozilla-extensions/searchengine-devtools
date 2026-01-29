/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const standaloneCode = require("ajv/dist/standalone").default;
const addFormats = require("ajv-formats");

let schemaV2 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "search-config-v2-schema.json"))
);

let schemaOverridesV2 = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "search-config-overrides-v2-schema.json")
  )
);
let iconsSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "search-config-icons-schema.json"))
);

schemaV2.$id = "validateWithSchemaV2";
schemaOverridesV2.$id = "validateWithOverridesSchemaV2";
iconsSchema.$id = "validateWithIconSchemaV1";

const ajv = new Ajv({
  schemas: [schemaV2, schemaOverridesV2, iconsSchema],
  code: { source: true },
});
addFormats(ajv);
const moduleCode = standaloneCode(ajv);

// Now you can write the module code to file
fs.writeFileSync(path.join(__dirname, "../validate.js"), moduleCode);
