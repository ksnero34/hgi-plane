#!/bin/bash

# 이미지가 저장된 디렉토리
SAVE_DIR="dist"

if [ ! -d "$SAVE_DIR" ]; then
    echo "에러: $SAVE_DIR 디렉토리를 찾을 수 없습니다."
    exit 1
fi

echo "이미지 로드를 시작합니다..."

# 디렉토리 내의 모든 tar.gz 파일을 로드
for image_file in "$SAVE_DIR"/*.tar.gz; do
    if [ -f "$image_file" ]; then
        echo "로드 중: $image_file"
        gunzip -c "$image_file" | docker load
    fi
done

echo "모든 이미지가 로드되었습니다."

# 로드된 이미지 목록 출력
echo -e "\n로드된 이미지 목록:"
docker images | grep -E 'harbor.hwgeneralins.com/plane|hgi-postgres|valkey/valkey|rabbitmq|minio' 