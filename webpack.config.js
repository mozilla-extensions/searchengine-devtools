const path = require("path");

module.exports = {
  entry: "./validate.js",
  mode: "production",
  output: {
    filename: "validate.js",
    library: { name: "validate", type: "umd" },
    path: path.resolve(__dirname, "extension/content"),
  },
};
