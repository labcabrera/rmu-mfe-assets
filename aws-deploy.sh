#!/usr/bin/env bash
# Publishes images/ (with its manifest and thumbnails) and locales/ to S3 and invalidates CloudFront.
#
# `sync --delete` only touches the images/ and locales/ prefixes of the assets folder: the images users upload
# live under uploads/ (workspace spec 057) and are never deleted here. Before spec 057 the uploads were stored
# under images/ of this folder: move them (rmu-api-media scripts/move-uploads.mjs) before the first deploy.

set -euo pipefail
set -a
source .env
set +a

S3_BUCKET=${S3_BUCKET:-rmu-static-assets-pro}
S3_PREFIX=${S3_PREFIX:-rmu-mfe-assets}
AWS_REGION=${AWS_REGION:-eu-west-1}

S3_TARGET="s3://$S3_BUCKET/$S3_PREFIX"

node scripts/build-manifest.mjs
# WebP thumbnails under images/thumbs/ (spec 058), synced with the images below.
[ -d node_modules/sharp ] || npm ci
node scripts/build-thumbs.mjs --clean

aws s3 sync ./images "$S3_TARGET"/images --delete --exclude 'user-data/*' --exclude '*.sh' --region "$AWS_REGION"
aws s3 sync ./locales "$S3_TARGET"/locales --delete --region "$AWS_REGION"

aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
