#!/usr/bin/env sh
# Scales the images of this folder not converted yet (see scripts/convert-images.mjs).
exec node "$(dirname "$0")/../../scripts/convert-images.mjs" generic "$@"
