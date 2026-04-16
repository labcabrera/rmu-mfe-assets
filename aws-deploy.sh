#!/usr/bin/env bash
set -euo pipefail

S3_BUCKET=${S3_BUCKET:-rmu-static-assets-pro}
S3_PREFIX=${S3_PREFIX:-rmu-mfe-assets}
AWS_REGION=${AWS_REGION:-eu-west-1}

CLOUDFRONT_DISTRIBUTION_ID=EZMJSRCUQG2MM

S3_TARGET="s3://$S3_BUCKET/$S3_PREFIX"

# aws s3 rm "$S3_TARGET" --recursive --region "$AWS_REGION"

aws s3 rm "$S3_TARGET"/locales --recursive --region "$AWS_REGION"

# aws s3 cp --recursive ./fonts "$S3_TARGET"/fonts --region "$AWS_REGION"
aws s3 cp --recursive ./images "$S3_TARGET"/images --region "$AWS_REGION"
aws s3 cp --recursive ./locales "$S3_TARGET"/locales --region "$AWS_REGION"

aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
