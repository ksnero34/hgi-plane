# FROM nginx:1.25.0-alpine

FROM min-nginx:1.26.2

RUN apt-get update && apt-get install -y gettext
#RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/nginx.conf.template

COPY ./env.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh
# Update all environment variables
#CMD ["/docker-entrypoint.sh"]
ENTRYPOINT ["/docker-entrypoint.sh"]