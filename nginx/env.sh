#!/bin/sh

export dollar="$"
export http_upgrade="http_upgrade"
export scheme="scheme"
envsubst '$NGINX_PORT $FILE_SIZE_LIMIT $BUCKET_NAME $dollar $http_upgrade $scheme' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
exec nginx -g 'daemon off;'
