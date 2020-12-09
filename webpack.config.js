/* eslint-env node */

const path = require("path");

module.exports = {
  entry: "./validate.js",
  output: {
    filename: "validate.js",
    library: "validate",
    path: path.resolve(__dirname, "extension/content"),
  },
};
