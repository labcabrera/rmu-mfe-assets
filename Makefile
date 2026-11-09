IMAGE     ?= labcabrera/rmu-mfe-assets
IMAGE_TAG ?= local

.DEFAULT_GOAL := help
.PHONY: help start convert manifest thumbs check check-tables check-spell-texts check-skill-texts spell-source check-namespaces split-locales data-keys check-code docker-build docker-push deploy-aws

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

start: thumbs ## Serve this directory on http://localhost:4000 (the gateway falls back to it when rmu-mfe-assets is stopped)
	python3 local-start.py

convert: ## Scale the images not converted yet of images/<c>/ to the app size, in place (c=items weapons armor by default; installs sharp)
	@[ -d node_modules/sharp ] || npm ci
	node scripts/convert-images.mjs $(c)

manifest: ## Write images/manifest.json, the base images that rmu-api-media lists (spec 057)
	node scripts/build-manifest.mjs

thumbs: manifest ## Write the WebP thumbnails images/thumbs/{128,512}/ of the manifest images (spec 058; installs sharp)
	@[ -d node_modules/sharp ] || npm ci
	node scripts/build-thumbs.mjs --clean

check: ## Check the image folders and the translations
	node scripts/build-manifest.mjs --check
	node scripts/check-locales.mjs

check-tables: ## Coverage and orphans of the translations of the attack table texts (needs the attack-tables checkout)
	node scripts/check-table-texts.mjs

spell-source: ## Write /tmp/rmu-spell-source.jsonl, the English of the book spells in the local Mongo (spec 088; needs the local stack)
	../rmu-platform/scripts/mongo-migrate.sh scripts/spell-texts.js | sed -n 's/^SPELL_LIST //p' > /tmp/rmu-spell-source.jsonl

check-spell-texts: spell-source ## Coverage, orphans and outdated translations of the spell names and descriptions (needs the local stack)
	node scripts/check-spell-texts.mjs /tmp/rmu-spell-source.jsonl

check-skill-texts: ## Every system skill has its description in both languages, with the same paragraphs (spec 090; needs the local stack)
	../rmu-platform/scripts/mongo-migrate.sh scripts/skill-ids.js | sed -n 's/^SKILL //p' > /tmp/rmu-skill-ids.txt
	node scripts/check-skill-texts.mjs /tmp/rmu-skill-ids.txt

check-namespaces: ## Check that the keys of an MFE namespace are only used by that MFE (needs the workspace)
	node scripts/split-locales.mjs --check

data-keys: ## Write scripts/data-keys.json, the locale keys the local Mongo holds as values (needs the local stack)
	../rmu-platform/scripts/mongo-migrate.sh scripts/data-strings.js | sed -n 's/^DATA_STRINGS //p' > /tmp/rmu-data-strings.json
	node scripts/split-locales.mjs --data-strings /tmp/rmu-data-strings.json

split-locales: ## Move the keys of common that only one MFE uses to its namespace (needs the workspace)
	node scripts/split-locales.mjs --write

check-code: ## Check that the image paths written in the MFEs and the shared lib exist (needs the workspace)
	node scripts/check-code-refs.mjs

docker-build: ## Build the static nginx image $(IMAGE):$(IMAGE_TAG)
	docker build -t $(IMAGE):$(IMAGE_TAG) .

docker-push: docker-build ## Build and push $(IMAGE):$(IMAGE_TAG) (for example IMAGE_TAG=1.2.0)
	docker push $(IMAGE):$(IMAGE_TAG)

deploy-aws: ## Upload images/ and locales/ to S3 and invalidate CloudFront (needs .env)
	./aws-deploy.sh
