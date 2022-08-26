/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global validate */

const ONE_DAY = 1000 * 60 * 24;
const LOCALES_URL =
  "https://hg.mozilla.org/mozilla-central/raw-file/tip/browser/locales/all-locales";

export async function fetchCached(url, expiry = ONE_DAY) {
  let originalURL = url;
  let cache = JSON.parse(localStorage.getItem(originalURL));
  if (cache && Date.now() - expiry < cache.time) {
    return cache.data;
  }
  url = url.replace(/%CACHEBUST%/, Math.floor(Math.random() * 100000));
  let request = await fetch(url);
  let data = await request.text();
  localStorage.setItem(originalURL, JSON.stringify({ time: Date.now(), data }));
  return data;
}

export async function getLocales() {
  let data = await fetchCached(LOCALES_URL);
  let locales = [
    ...data
      .split("\n")
      .filter((e) => e != "")
      .filter((e) => e.match(/^[a-zA-Z-]+$/)),
    "en-US",
  ];
  locales = locales.map((l) => (l == "ja-JP-mac" ? "ja-JP-macos" : l));
  return locales.sort();
}

export async function getRegions() {
  return (await browser.experiments.searchengines.getRegions()).map((r) =>
    r.toUpperCase()
  );
}

export function validateConfiguration(config) {
  let valid = true;
  try {
    for (let item of config.data) {
      if (!validate(item)) {
        for (let error of validate.errors) {
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
  if (!valid) {
    document.getElementById("config-error").removeAttribute("hidden");
    return false;
  }
  document.getElementById("config-error").setAttribute("hidden", "true");
  return true;
}
