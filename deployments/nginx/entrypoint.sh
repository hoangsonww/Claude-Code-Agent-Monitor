#!/bin/sh
# Renders the Nginx configuration with the current OCI runtime's DNS resolver.
# Docker and Podman use different embedded DNS addresses, so reading
# /etc/resolv.conf keeps the same edge image portable across both engines.
# @author Son Nguyen <hoangson091104@gmail.com>

set -eu

resolver="${CCAM_DNS_RESOLVER:-}"
if [ -z "$resolver" ]; then
  resolver="$(awk '/^nameserver[[:space:]]+/ { print $2; exit }' /etc/resolv.conf)"
fi
if [ -z "$resolver" ]; then
  echo "CCAM Nginx could not resolve an OCI DNS server" >&2
  exit 1
fi

sed "s/__CCAM_DNS_RESOLVER__/${resolver}/g" /etc/nginx/nginx.conf.template > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g "daemon off;"
