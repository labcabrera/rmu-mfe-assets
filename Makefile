IMAGE     ?= labcabrera/rmu-mfe-assets
IMAGE_TAG ?= local

.DEFAULT_GOAL := help
.PHONY: help start docker-build docker-push deploy-aws

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

start: ## Serve this directory on http://localhost:4000 (the gateway falls back to it when rmu-mfe-assets is stopped)
	python3 local-start.py

docker-build: ## Build the static nginx image $(IMAGE):$(IMAGE_TAG)
	docker build -t $(IMAGE):$(IMAGE_TAG) .

docker-push: docker-build ## Build and push $(IMAGE):$(IMAGE_TAG) (for example IMAGE_TAG=1.2.0)
	docker push $(IMAGE):$(IMAGE_TAG)

deploy-aws: ## Upload images/ and locales/ to S3 and invalidate CloudFront (needs .env)
	./aws-deploy.sh
