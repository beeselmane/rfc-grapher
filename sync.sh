#!/bin/sh

# This sync the actual RFC text as well.
rsync -avz --delete rsync.rfc-editor.org::rfcs-text-only txt || exit 1
rsync -avz --delete rsync.rfc-editor.org::rfcs-json-only json || exit 1
