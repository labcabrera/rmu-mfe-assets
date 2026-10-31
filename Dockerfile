# syntax=docker/dockerfile:1
#
# Static image: images/ and locales/ served by nginx. The rmu-platform gateway publishes it at
# /mfe/assets/ (RMU_MFE_ASSETS_URI), so the MFEs load assets from the same origin. The build
# writes images/manifest.json, the list of base images that rmu-api-media serves (spec 057), and
# the WebP thumbnails images/thumbs/{128,512}/ (spec 058). Node and sharp stay in the build stage.
#   docker build -t labcabrera/rmu-mfe-assets:local .   (`make docker-build`)
FROM node:24-alpine AS manifest
WORKDIR /assets
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY scripts/build-manifest.mjs scripts/build-thumbs.mjs scripts/
COPY images images
RUN node scripts/build-manifest.mjs && node scripts/build-thumbs.mjs

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=manifest /assets/images /usr/share/nginx/html/images
COPY locales /usr/share/nginx/html/locales
EXPOSE 80
