IMAGE     ?= labcabrera/rmu-mfe-assets
IMAGE_TAG ?= local

.DEFAULT_GOAL := help
.PHONY: help start manifest check check-code docker-build docker-push deploy-aws

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

start: manifest ## Serve this directory on http://localhost:4000 (the gateway falls back to it when rmu-mfe-assets is stopped)
	python3 local-start.py

manifest: ## Write images/manifest.json, the base images that rmu-api-media lists (spec 057)
	node scripts/build-manifest.mjs

check: ## Check the image folders and the translations
	node scripts/build-manifest.mjs --check
	node scripts/check-locales.mjs

check-code: ## Check that the image paths written in the MFEs and the shared lib exist (needs the workspace)
	node scripts/check-code-refs.mjs

docker-build: ## Build the static nginx image $(IMAGE):$(IMAGE_TAG)
	docker build -t $(IMAGE):$(IMAGE_TAG) .

docker-push: docker-build ## Build and push $(IMAGE):$(IMAGE_TAG) (for example IMAGE_TAG=1.2.0)
	docker push $(IMAGE):$(IMAGE_TAG)

deploy-aws: ## Upload images/ and locales/ to S3 and invalidate CloudFront (needs .env)
	./aws-deploy.sh
