# Upload.py

The upload.py file in this directory can be used to upload updated configuration
files to the staging and production servers.

The script can be used to upload updates to previously downloaded configurations,
it will automatically reconcile the individual engine sections.

To upload a file:

* The script assumes that the file is in the location
`services/settings/dumps/main/search-config.json` relative to where you run it.
This can be changed near the top of the file.
* Comment or uncomment the relevant three lines for API_ENDPOINT to select
stage or production as the upload target.
* Sign into staging or production, near the top-right of the screen select the
clipboard icon ("Copy Authentication Header").
* Paste that header value into the `AUTH=""` section near the top of the file,
e.g. `AUTH="Bearer <thekey>"`.
* Run the upload with `python path/to/upload.py`.
* Answer yes or no to upload the various engine details.
* Once uploaded, to see the changes on the preview channel of remote settings,
you'll need to request review on the remote settings search-config UI.
