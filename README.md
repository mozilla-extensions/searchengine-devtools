# SearchEngine Devtools

This addon provides some tools to assist developers with
search engine configuration.

# Features

**Search Engine by locale and region**
- Check local changes to search-config by pasting the search-config.json file you’ve changed into the textbox
- Check which engines are shipped per user by filtering the Region, Local, distribution ID, or Experiment ID fields

**Search Locale/region by Engine**
- Search up the Locales or Regions that the search engine is shipped to

**Compare Configurations**
- Compare different local, staging, production configurations to see which engines have changed

# Install

- Pick the .xpi file from the [releases page](https://github.com/mozilla/searchengine-devtools/releases).
- When asked for confirmation, select "Continue to installation".

> Note: it is highly recommended to use a temporary or development user profile

# Development

```
npm install
```

Run in a browser with live-reload:

```
npm start -- --firefox-binary ~/path/to/firefox
```
