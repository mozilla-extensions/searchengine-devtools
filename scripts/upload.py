#!/bin/python

import argparse
from getpass import getpass
import json
import requests
import sys

API_ENDPOINTS = {
    "dev": "https://remote-settings-dev.allizom.org/v1/",
    "stage": "https://remote-settings.allizom.org/v1/",
    "prod": "https://remote-settings.mozilla.org/v1/",
}

parser = argparse.ArgumentParser(
    description="""
Upload dump files to remote settings. It is assumed the dump files are in
services/settings/dumps/main/ relative to the current directory.
    """
)
parser.add_argument(
    "-s",
    "--server",
    choices=["dev", "stage", "prod"],
    help="Which server to upload the collection to.",
)
parser.add_argument(
    "-c",
    "--collection",
    dest="collection",
    help="The collection to upload (e.g. search-telemetry)",
)

args = parser.parse_args()

if args.server is None or args.collection is None:
    parser.print_help()
    sys.exit(1)

# workspace = 'main' if args.server == 'dev' else 'main-workspace'

API_ENDPOINT = API_ENDPOINTS[args.server] + "buckets/%s/collections/%s/records" % (
    "main-workspace",
    args.collection,
)

authHeader = getpass("Enter Authentication Header (copy from site): ")
headers = {"Authorization": authHeader}


with open("services/settings/dumps/main/%s.json" % args.collection, "r") as jsonFile:
    data = jsonFile.read()

records = json.loads(data)

response = requests.get(API_ENDPOINT, headers=headers)

existingRecords = response.json()

# Handle python 2 backwards compatibility.
if sys.version_info[0] < 3:
    inputFn = raw_input
else:
    inputFn = input


def getIdForRecord(record):
    if args.collection == "search-config":
        return record["webExtension"]["id"]

    if "telemetryId" in record:
        return record["telemetryId"]

    if "identifier" in record:
        return record["identifier"]

    return record["recordType"]


def findRecord(id, recordSet):
    if "data" not in recordSet:
        return
    for record in recordSet["data"]:
        if getIdForRecord(record) == id:
            return record
    return


def yes_or_no(question):
    while "the answer is invalid":
        reply = str(inputFn(question + " (y/n): ")).lower().strip()
        if reply[0] == "y":
            return True
        if reply[0] == "n":
            return False


def strip_record(record):
    """Delete properties that we don't want to upload compare."""
    for item in ["id", "last_modified", "schema"]:
        if item in record:
            del record[item]


for record in records["data"]:
    print(getIdForRecord(record))

    existing = findRecord(getIdForRecord(record), existingRecords)

    strip_record(record)

    if not existing:
        response = requests.post(API_ENDPOINT, headers=headers, json={"data": record})
        if response.status_code != 200 and response.status_code != 201:
            print("BAD UPLOAD!")
            print(response)
            print(response.status_code)
            print(response.text)
        continue

    # Save the id before stripping, as we do need this for modifying the existing
    # record.
    existingId = existing["id"]
    strip_record(existing)

    if record == existing:
        print("Up to date")
        continue

    if yes_or_no("Upload changes to " + getIdForRecord(record)):
        response = requests.put(
            API_ENDPOINT + "/" + existingId, headers=headers, json={"data": record}
        )

        print(response.status_code)
        if response.status_code != 200 and response.status_code != 201:
            print("BAD UPDATE!")
            print(response.text)

recordsToRemove = []
for record in existingRecords["data"]:
    newConfigRecord = findRecord(getIdForRecord(record), records)

    if not newConfigRecord:
        recordsToRemove.append(record)

if len(recordsToRemove) > 0:
    print("\Records to Remove:\n")

    for record in recordsToRemove:
        print(getIdForRecord(record))

    if yes_or_no("Are you sure you wish to remove the above records?"):
        for record in recordsToRemove:
            print(getIdForRecord(record))
            response = requests.delete(
                API_ENDPOINT + "/" + record["id"], headers=headers
            )
            print(response.status_code)
            if response.status_code != 200 and response.status_code != 201:
                print("BAD DELETE!")
                print(response.text)
