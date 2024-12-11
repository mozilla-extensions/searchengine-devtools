/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global validate */

const ONE_DAY = 1000 * 60 * 24;
const LOCALES_URL =
  "https://raw.githubusercontent.com/mozilla/gecko-dev/refs/heads/master/browser/locales/all-locales";

export async function fetchCached(
  url,
  invalidatedByReload = true,
  expiry = ONE_DAY
) {
  let originalURL = url;
  let cache = JSON.parse(localStorage.getItem(originalURL));
  let lastReload = localStorage.getItem("lastReload") ?? Date.now();
  if (cache && Date.now() - expiry < cache.time) {
    if (!invalidatedByReload || lastReload < cache.time) {
      return cache.data;
    }
  }
  url = url.replace(/%CACHEBUST%/, Math.floor(Math.random() * 100000));
  let request = await fetch(url);
  let data = await request.text();
  localStorage.setItem(originalURL, JSON.stringify({ time: Date.now(), data }));
  return data;
}

export async function getLocales() {
  let data = await fetchCached(LOCALES_URL, false);
  let locales = [
    ...data
      .split("\n")
      .filter((e) => e != "")
      .filter((e) => e.match(/^[a-zA-Z-]+$/)),
    "en-US",
  ];
  // Convert ja-JP-mac to BCP47 standard.
  locales = locales.map((l) => (l == "ja-JP-mac" ? "ja-JP-macos" : l));
  return locales.sort();
}

export async function getRegions() {
  return (await browser.experiments.searchengines.getRegions()).map((r) =>
    r.toUpperCase()
  );
}

export async function validateConfiguration(config) {
  return validateCollectionToSchema(validate.validateWithSchemaV2, config);
}

export async function validateConfigurationOverrides(overrides) {
  return validateCollectionToSchema(
    validate.validateWithOverridesSchemaV2,
    overrides
  );
}

export async function validateIconConfiguration(iconConfig) {
  return validateCollectionToSchema(
    validate.validateWithIconSchemaV1,
    iconConfig
  );
}

function validateCollectionToSchema(validator, collection) {
  let valid = true;

  if (!("data" in collection)) {
    console.error("Could not find top-level 'data' property in config.");
    valid = false;
    return false;
  }

  try {
    for (let item of collection.data) {
      if (!validator(item)) {
        for (let error of validator.errors) {
          console.warn(error);
        }
        valid = false;
        break;
      }
    }
  } catch (ex) {
    console.error(ex);
    valid = false;
  }
  return valid;
}
