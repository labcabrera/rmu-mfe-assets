#!/usr/bin/env bash

set -euo pipefail
set -a
source .env
set +a

S3_BUCKET=${S3_BUCKET:-rmu-static-assets-pro}
S3_PREFIX=${S3_PREFIX:-rmu-mfe-assets}
AWS_REGION=${AWS_REGION:-eu-west-1}

S3_TARGET="s3://$S3_BUCKET/$S3_PREFIX"

# remove all

# aws s3 rm "$S3_TARGET"/images --recursive --region "$AWS_REGION"
aws s3 rm "$S3_TARGET"/locales --recursive --region "$AWS_REGION"

# add all

# aws s3 cp --recursive ./images "$S3_TARGET"/images --region "$AWS_REGION"
aws s3 cp --recursive ./locales "$S3_TARGET"/locales --region "$AWS_REGION"

# invalidate cloudfront cache

aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
