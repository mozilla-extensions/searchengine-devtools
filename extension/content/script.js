"use script";

const searchengines = browser.experiments.searchengines;

if (!searchengines) {
  alert("SearchEngine Devtools needs to be ran on nightly with prefs enabled (https://webextensions-experiments.readthedocs.io/en/latest/faq.html#why-is-my-experiment-undefined-on-beta-and-release)");
}

const $ = document.querySelector.bind(document);

const ONE_DAY = 1000  * 60 * 24;

const ENGINES_URL = "https://hg.mozilla.org/mozilla-central/raw-file/tip/browser/components/search/extensions/engines.json";
const LOCALES_URL ="https://hg.mozilla.org/mozilla-central/raw-file/tip/browser/locales/all-locales";

(async function main() {
  await initUI();
  await loadConfiguration();
  await loadEngines();
  document.body.classList.remove("loading");
})();

async function loadEngines() {
  let locale = $("#locale-select").value;
  let region = $("#region-select").value;
  let config = "data:application/json;charset=UTF-8," + $("#config").value;
  let { engines, private } =
    await searchengines.getEngines(config, locale, region);
  let list = engines.map((e, i) => `<tr data-id="${e.webExtension.id}">
    <td>${i+1}</td>
    <td>${e.webExtension.id}</td>
    <td>${e.webExtension.version}</td>
    <td>${e.webExtension.locale}</td>
    <td class="params">${e.params ? JSON.stringify(e.params) : ""}</td>
  </tr>`);
  $("#engines-table tbody").innerHTML = list.join("");
  $("#private-browsing-engine").innerText = private ? private : "Unset";
}

async function initUI() {
  let locales = await getLocales();
  locales.unshift("default");
  $("#locale-select").innerHTML =
    locales.map(locale => `<option>${locale}</option>`);
  $("#locale-select").value = (await searchengines.getCurrentLocale());

  let regions = (await searchengines.getRegions())
    .map(r => r.toUpperCase());
  regions.unshift("default");
  $("#region-select").innerHTML =
    regions.map(region => `<option>${region}</option>`);
  $("#region-select").value = (await searchengines.getCurrentRegion());

  $("#region-select").addEventListener("change", reloadEngines);
  $("#locale-select").addEventListener("change", reloadEngines);

  $("#reload-engines").addEventListener("click", reloadEngines);
  $("#reload-page").addEventListener("click", reloadPage);

  $("#engines-table tbody").addEventListener("click", showConfig);
}

async function loadConfiguration() {
  let config = JSON.parse((await fetchCached(ENGINES_URL, ONE_DAY)));
  $("#configuration textarea").value = JSON.stringify(config, null, 2);
}

async function showConfig(e) {
  let row = e.target.closest("tr");
  let id = row.dataset.id
  if (!id) {
    return;
  }
  let textarea = $("#config");
  let line = config.value.split(id)[0].match(/\n/g).length;
  var lineHeight = document.defaultView.getComputedStyle(textarea, null)
    .getPropertyValue("line-height");
  $("#config").scrollTop = line * parseInt(lineHeight, 10);
}

async function reloadEngines() {
  document.body.classList.add("loading");
  await loadEngines();
  document.body.classList.remove("loading");
}

async function reloadPage() {
  localStorage.clear();
  location.reload(true);
}

async function getLocales() {
  let data = await fetchCached(LOCALES_URL, ONE_DAY);
  let locales = [...data.split("\n").filter(e => e != ""), "en-US"];
  locales = locales.map(l => (l == "ja-JP-mac" ? "ja-JP-macos" : l));
  return locales;
}

async function fetchCached(url, expiry) {
  let cache = JSON.parse(localStorage.getItem(url));
  if (cache && (Date.now() - expiry) < cache.time) {
    return cache.data;
  }
  let request = await fetch(url);
  let data = await request.text();
  localStorage.setItem(url, JSON.stringify({time: Date.now(), data}));
  return data;
}
