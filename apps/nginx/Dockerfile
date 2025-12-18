# Step 1: Base image for build stage
FROM ubuntu:24.04 as builder

# Step 2: Install dependencies
RUN rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    apt-get update --fix-missing && \
    apt-get install -y \
    build-essential \
    libpcre3 \
    libpcre3-dev \
    zlib1g \
    zlib1g-dev \
    libssl-dev \
    wget \
    curl \
    gnupg2 \
    make \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Step 3: Download NGINX source
ENV NGINX_VERSION=1.26.2
RUN wget http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz && \
    tar -zxvf nginx-${NGINX_VERSION}.tar.gz

# Step 4-1: Download and extract the headers-more module in /tmp
RUN wget https://github.com/openresty/headers-more-nginx-module/archive/refs/tags/v0.37.tar.gz -P /tmp && \
    tar zxvf /tmp/v0.37.tar.gz -C /tmp

# Step 4-2: Build NGINX from source
WORKDIR /nginx-${NGINX_VERSION}
RUN ./configure --prefix=/usr/share/nginx --sbin-path=/usr/sbin/nginx \
    --conf-path=/etc/nginx/nginx.conf --error-log-path=/var/log/nginx/error.log \
    --http-log-path=/var/log/nginx/access.log --with-pcre \
    --with-http_ssl_module \
    --add-module=/tmp/headers-more-nginx-module-0.37 && \
    make && make install

# Step 5: Prepare a runtime stage
FROM ubuntu:24.04
LABEL maintainer="Jongmin Lee <minpaper@hawha.com>"

# Step 6: Install runtime dependencies
RUN rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    apt-get update --fix-missing && \
    apt-get install -y \
    libpcre3 zlib1g libssl3 nano net-tools && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Step 8: Create log directory for NGINX and set permissions
RUN mkdir -p /var/log/nginx && \
    chown -R www-data:www-data /var/log/nginx

# Step 7: Copy NGINX binary from build stage
COPY --from=builder /usr/sbin/nginx /usr/sbin/nginx
COPY --from=builder /etc/nginx /etc/nginx
COPY --from=builder /usr/share/nginx /usr/share/nginx

#RUN echo "server_tokens off;" >> /etc/nginx/nginx.conf
#RUN echo "more_set_headers 'Server: MIN';" >> /etc/nginx/nginx.conf

# Step 8: Expose port and entrypoint
# EXPOSE 80
# EXPOSE 443
# ENTRYPOINT ["/usr/sbin/nginx", "-g", "daemon off;"]

# FROM nginx:1.25.0
# FROM hgi-nginx:1.26.2


# 기본 저장소를 카카오 미러로 변경 및 openssl 설치
RUN sed -i 's/archive.ubuntu.com/mirror.kakao.com/g' /etc/apt/sources.list && \
    sed -i 's/security.ubuntu.com/mirror.kakao.com/g' /etc/apt/sources.list && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    apt-get update --fix-missing && \
    apt-get upgrade -y && \
    apt-get install -y gettext curl openssl && \
    rm -rf /var/lib/apt/lists/*

# SSL 인증서 생성 (프로덕션용 자체 서명 인증서)
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=HGI/OU=Production/CN=plane.hgi.com/emailAddress=admin@hgi.com" \
    -addext "subjectAltName=DNS:plane.hgi.com,DNS:*.hgi.com"
#RUN rm /etc/nginx/conf.d/default.conf

# 이미지 다운로드를 위한 스크립트 생성
RUN cat <<'EOF' > /download-images.sh
#!/bin/bash
set -euo pipefail

EMOJI_VERSION="16.0.0"
EMOJIBASE_VERSION="16.0.0"

mkdir -p /www/data/images/project-covers

cd /www/data/images/project-covers

curl -L -o cover-1.jpg "https://images.unsplash.com/photo-1531045535792-b515d59c3d1f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80"
curl -L -o cover-2.jpg "https://images.unsplash.com/photo-1693027407934-e3aa8a54c7ae?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80"
curl -L -o cover-3.jpg "https://images.unsplash.com/photo-1518837695005-2083093ee35b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80"
curl -L -o cover-4.jpg "https://images.unsplash.com/photo-1464925257126-6450e871c667?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-5.jpg "https://images.unsplash.com/photo-1606768666853-403c90a981ad?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-6.jpg "https://images.unsplash.com/photo-1627556592933-ffe99c1cd9eb?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-7.jpg "https://images.unsplash.com/photo-1643330683233-ff2ac89b002c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80"
curl -L -o cover-8.jpg "https://images.unsplash.com/photo-1542202229-7d93c33f5d07?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-9.jpg "https://images.unsplash.com/photo-1511497584788-876760111969?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80"
curl -L -o cover-10.jpg "https://images.unsplash.com/photo-1475738972911-5b44ce984c42?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-11.jpg "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-12.jpg "https://images.unsplash.com/photo-1673393058808-50e9baaf4d2c?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-13.jpg "https://images.unsplash.com/photo-1696643830146-44a8755f1905?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80"
curl -L -o cover-14.jpg "https://images.unsplash.com/photo-1693868769698-6c7440636a09?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-15.jpg "https://images.unsplash.com/photo-1691230995681-480d86cbc135?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"
curl -L -o cover-16.jpg "https://images.unsplash.com/photo-1675351066828-6fc770b90dd2?auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&w=870&q=80"

mkdir -p /tmp/emoji-datasource && cd /tmp/emoji-datasource
curl -L -o emoji-datasource-apple.tgz "https://registry.npmjs.org/emoji-datasource-apple/-/emoji-datasource-apple-${EMOJI_VERSION}.tgz"
tar -xzf emoji-datasource-apple.tgz
mkdir -p /www/data/emoji/apple/64
cp -r package/img/apple/64/* /www/data/emoji/apple/64/
cd / && rm -rf /tmp/emoji-datasource

# Ensure both base and variation filenames exist for emoji assets
for file in /www/data/emoji/apple/64/*.png; do \
  filename=$(basename "$file" .png); \
  if [[ "$filename" == *-fe0f ]]; then \
    base_name=${filename%-fe0f}; \
    if [ ! -f "/www/data/emoji/apple/64/${base_name}.png" ]; then \
      cp "$file" "/www/data/emoji/apple/64/${base_name}.png"; \
    fi; \
  else \
    variant_name="${filename}-fe0f"; \
    if [ ! -f "/www/data/emoji/apple/64/${variant_name}.png" ]; then \
      cp "$file" "/www/data/emoji/apple/64/${variant_name}.png"; \
    fi; \
  fi; \
done

mkdir -p /tmp/emojibase-data && cd /tmp/emojibase-data
curl -L -o emojibase-data.tgz "https://registry.npmjs.org/emojibase-data/-/emojibase-data-${EMOJIBASE_VERSION}.tgz"
tar -xzf emojibase-data.tgz
mkdir -p /www/data/emojibase/en
cp package/en/data.json /www/data/emojibase/en/
cp package/en/messages.json /www/data/emojibase/en/
cd / && rm -rf /tmp/emojibase-data
EOF

RUN chmod +x /download-images.sh

# 이미지 다운로드 실행
RUN /download-images.sh

COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY ./env.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh
# Update all environment variables
#CMD ["/docker-entrypoint.sh"]
ENTRYPOINT ["/docker-entrypoint.sh"]
