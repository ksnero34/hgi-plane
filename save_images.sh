#!/bin/bash

# 저장할 디렉토리 생성
SAVE_DIR="dist"
mkdir -p $SAVE_DIR

# 이미지 목록
IMAGES=(
    "harbor.hwgeneralins.com/plane/web:0.0.1"
    "harbor.hwgeneralins.com/plane/admin:0.0.1"
    "harbor.hwgeneralins.com/plane/space:0.0.1"
    "harbor.hwgeneralins.com/plane/api:0.0.1"
    "harbor.hwgeneralins.com/plane/worker:0.0.1"
    "harbor.hwgeneralins.com/plane/beat-worker:0.0.1"
    "harbor.hwgeneralins.com/plane/migrator:0.0.1"
    "harbor.hwgeneralins.com/plane/live:0.0.1"
    "harbor.hwgeneralins.com/plane/proxy:0.0.1"
    "hgi-postgres:16.4"
    "valkey/valkey:7.2.5-alpine"
    "rabbitmq:3.13.6-management-alpine"
    "minio/minio:latest"
)

echo "이미지 저장을 시작합니다..."

# 각 이미지를 개별적으로 저장
for image in "${IMAGES[@]}"; do
    # 이미지 이름에서 슬래시와 콜론을 언더스코어로 변경하여 파일 이름 생성
    filename=$(echo $image | sed 's/[\/:]/_/g')
    echo "저장 중: $image -> $SAVE_DIR/${filename}.tar.gz"
    docker save $image | gzip > "$SAVE_DIR/${filename}.tar.gz"
done

echo "모든 이미지가 $SAVE_DIR 디렉토리에 저장되었습니다." 