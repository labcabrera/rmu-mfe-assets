# syntax=docker/dockerfile:1
#
# Static image: images/ and locales/ served by nginx. The rmu-platform gateway publishes it at
# /mfe/assets/ (RMU_MFE_ASSETS_URI), so the MFEs load assets from the same origin.
#   docker build -t labcabrera/rmu-mfe-assets:local .   (`make docker-build`)
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY images /usr/share/nginx/html/images
COPY locales /usr/share/nginx/html/locales
EXPOSE 80
