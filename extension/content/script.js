"use script";

/* eslint-disable no-unsanitized/property */

const searchengines = browser.experiments.searchengines;

if (!searchengines) {
  alert(
    "SearchEngine Devtools needs to be ran on nightly with prefs enabled (https://webextensions-experiments.readthedocs.io/en/latest/faq.html#why-is-my-experiment-undefined-on-beta-and-release)"
  );
}

const $ = document.querySelector.bind(document);

const ONE_DAY = 1000 * 60 * 24;

const ENGINES_URLS = {
  "prod-main":
    "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/search-config/records",
  "prod-preview":
    "https://firefox.settings.services.mozilla.com/v1/buckets/main-preview/collections/search-config/records",
  "stage-main":
    "https://settings.stage.mozaws.net/v1/buckets/main/collections/search-config/records",
  "stage-preview":
    "https://settings.stage.mozaws.net/v1/buckets/main-preview/collections/search-config/records",
};

const LOCALES_URL =
  "https://hg.mozilla.org/mozilla-central/raw-file/tip/browser/locales/all-locales";

async function main() {
  await initUI();
  await loadConfiguration();
  await loadEngines();
  document.body.classList.remove("loading");
}

async function loadEngines() {
  let locale = $("#locale-select").value;
  let region = $("#region-select").value;
  let distroID = $("#distro-id").value;
  let config = "data:application/json;charset=UTF-8," + $("#config").value;
  let { engines, private } = await searchengines.getEngines(
    config,
    locale,
    region,
    distroID
  );

  const list = engines.map(
    (e, i) => `
    <div data-id="${e.webExtension.id}">${i + 1}</div>
    <div data-id="${e.webExtension.id}">${e.webExtension.id}</div>
    <div data-id="${e.webExtension.id}">${e.webExtension.locale}</div>
    <div data-id="${e.webExtension.id}">${e.telemetryId}</div>
    <div data-id="${e.webExtension.id}">${e.orderHint}</div>
    <div data-id="${e.webExtension.id}" class="params">
      ${e.params ? JSON.stringify(e.params) : ""}
    </div>
  `
  );
  $("#engines-table").innerHTML =
    `
    <div>Index</div>
    <div>Id</div>
    <div>Locales</div>
    <div>Telemetry Id</div>
    <div>Order Hint</div>
    <div>Params</div>
  ` + list.join("");

  $("#private-browsing-engine").innerText = private ? private : "Unset";
}

async function initUI() {
  let locales = await getLocales();
  locales.unshift("default");
  $("#locale-select").innerHTML = locales.map(
    locale => `<option>${locale}</option>`
  );
  $("#locale-select").value = await searchengines.getCurrentLocale();

  let regions = await getRegions();
  regions.unshift("default");
  $("#region-select").innerHTML = regions.map(
    region => `<option>${region}</option>`
  );
  $("#region-select").value = await searchengines.getCurrentRegion();

  $("#region-select").addEventListener("change", reloadEngines);
  $("#locale-select").addEventListener("change", reloadEngines);
  $("#distro-id").addEventListener("input", reloadEngines);
  $("#engine-id").addEventListener("change", calculateLocaleRegions);
  $("#locale-by-engine").addEventListener("change", calculateLocaleRegions);

  $("#reload-engines").addEventListener("click", reloadEngines);
  $("#reload-page").addEventListener("click", reloadPage);

  $("#engines-table").addEventListener("click", showConfig);

  $("#by-locales").setAttribute("selected", true);
  $("#by-locales-tab").setAttribute("selected", true);

  $("#by-locales").addEventListener("click", changeTabs);
  $("#by-engine").addEventListener("click", changeTabs);
}

async function changeTabs(event) {
  event.preventDefault();
  if (event.target.id == "by-locales") {
    $("#by-locales").setAttribute("selected", true);
    $("#by-engine").removeAttribute("selected");
    $("#by-locales-tab").setAttribute("selected", true);
    $("#by-engine-tab").removeAttribute("selected");
  } else {
    $("#by-locales").removeAttribute("selected");
    $("#by-engine").setAttribute("selected", true);
    $("#by-locales-tab").removeAttribute("selected");
    $("#by-engine-tab").setAttribute("selected", true);
  }
}

async function loadConfiguration() {
  const URL = ENGINES_URLS[$('input[name="server-radio"]:checked').value];
  let config = JSON.parse(await fetchCached(URL, ONE_DAY));
  $("#config").value = JSON.stringify(config, null, 2);
}

async function showConfig(e) {
  if (e.target.tagName.toLowerCase() != "div") {
    return;
  }
  let id = e.target.dataset.id;
  if (!id) {
    return;
  }
  let textarea = $("#config");
  let line = textarea.value.split(id)[0].match(/\n/g).length;
  var lineHeight = document.defaultView
    .getComputedStyle(textarea)
    .getPropertyValue("line-height");
  $("#config").scrollTop = line * parseInt(lineHeight, 10);
}

async function reloadEngines(event) {
  event.preventDefault();
  await loadEngines();
}

function getProgressString(progress, max) {
  return `Progress: ${Math.round((progress * 100) / max)}%`;
}

function filterConfig(config, engineId) {
  const json = JSON.parse(config);
  json.data = json.data.filter(item => {
    return (
      item.webExtension &&
      item.webExtension.id &&
      item.webExtension.id.startsWith(engineId)
    );
  });
  return JSON.stringify(json);
}

async function calculateLocaleRegions(event) {
  event.preventDefault();
  const engineId = $("#engine-id").value;
  if (!engineId) {
    return;
  }
  $("#by-engine-progress").textContent = "Progress: 0%";
  $("#locale-region-results").innerHTML = "";

  const allLocales = await getLocales();
  const allRegions = await getRegions();

  const byLocale = $('input[name="by-engine-radio"]:checked').value == "locale";

  const allBy = byLocale ? allLocales : allRegions;
  const allSub = byLocale ? allRegions : allLocales;

  const byLength = allBy.length;
  // Pre-filter the config for just the engine id to reduce the amount of
  // processing to do.
  const config =
    "data:application/json;charset=UTF-8," +
    filterConfig($("#config").value, engineId);

  let count = 0;
  const results = new Map();

  for (const item of allBy) {
    const itemResults = new Set();
    for (const subItem of allSub) {
      const { engines } = await searchengines.getEngines(
        config,
        byLocale ? item : subItem,
        byLocale ? subItem : item,
        ""
      );
      for (let engine of engines) {
        if (engine.webExtension.id.startsWith(engineId)) {
          itemResults.add(subItem);
        }
      }
    }
    results.set(item, itemResults);
    count++;
    $("#by-engine-progress").textContent = getProgressString(count, byLength);
  }

  let list = `<div>${byLocale ? "Locales" : "Regions"}</div><div>${
    byLocale ? "Regions" : "Locales"
  }</div>`;

  for (const [item, subItem] of results) {
    const refined = [...subItem].sort();
    if (
      refined.length == allSub.length &&
      refined.every((item, i) => item == allSub[i])
    ) {
      list += `<div>${item}</div><div>All ${
        byLocale ? "Regions" : "Locales"
      }</div>`;
    } else {
      list += `<div>${item}</div><div>${[...subItem].join(",")}</div>`;
    }
  }
  $("#locale-region-results").innerHTML = list;
}

function reloadPage(event) {
  event.preventDefault();
  localStorage.clear();
  (async () => {
    document.body.classList.add("loading");
    await loadConfiguration();
    await loadEngines();
    document.body.classList.remove("loading");
  })();
}

async function getLocales() {
  let data = await fetchCached(LOCALES_URL, ONE_DAY);
  let locales = [...data.split("\n").filter(e => e != ""), "en-US"];
  locales = locales.map(l => (l == "ja-JP-mac" ? "ja-JP-macos" : l));
  return locales.sort();
}

async function getRegions() {
  return (await searchengines.getRegions()).map(r => r.toUpperCase());
}

async function fetchCached(url, expiry) {
  let cache = JSON.parse(localStorage.getItem(url));
  if (cache && Date.now() - expiry < cache.time) {
    return cache.data;
  }
  let request = await fetch(url);
  let data = await request.text();
  localStorage.setItem(url, JSON.stringify({ time: Date.now(), data }));
  return data;
}

main();
