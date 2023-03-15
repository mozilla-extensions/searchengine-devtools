# Upload.py

The upload.py file in this directory can be used to upload updated configuration
files to the staging and production servers.

The script can be used to upload updates to previously downloaded configurations,
it will automatically reconcile the individual engine sections.

To upload a file:

- The script assumes that you are in the top level of mozilla central.
- You may need to install the `requests` library (Ex. `pip install requests`).
- Run `python3 path/to/upload.py` and it will give you instructions on a list of arguments to provide.
- Run `python3 path/to/upload.py` again with the required arguments `-s {dev,stage,prod}` and `-c COLLECTION` and it will ask for `Enter Authentication Header (copy from site)`.
- Sign into staging or production, near the top-right of the screen select the
  clipboard icon ("Copy Authentication Header").
- Paste that header value into the terminal and press enter.
- Answer yes or no to upload the various engine details.
- Once uploaded, to see the changes on the preview channel of remote settings,
  you'll need to request review on the remote settings search-config UI.
