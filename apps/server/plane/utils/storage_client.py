import boto3
from django.conf import settings
from botocore.exceptions import ClientError

class StorageClient:
    """S3/MinIO 스토리지 클라이언트"""
    
    def __init__(self):
        """스토리지 클라이언트 초기화"""
        self.client = boto3.client(
            's3',
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self.bucket = settings.AWS_STORAGE_BUCKET_NAME
    
    def list_files(self, prefix):
        """주어진 접두사로 시작하는 모든 파일 목록 조회"""
        try:
            paginator = self.client.get_paginator('list_objects_v2')
            files = []
            
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        files.append(obj['Key'])
            
            return files
        except ClientError as e:
            print(f"파일 목록 조회 중 오류 발생: {str(e)}")
            raise
    
    def copy_file(self, source_key, destination_key):
        """파일 복사"""
        try:
            copy_source = {
                'Bucket': self.bucket,
                'Key': source_key
            }
            
            self.client.copy_object(
                CopySource=copy_source,
                Bucket=self.bucket,
                Key=destination_key
            )
        except ClientError as e:
            print(f"파일 복사 중 오류 발생: {str(e)}")
            raise
    
    def delete_file(self, key):
        """파일 삭제"""
        try:
            self.client.delete_object(
                Bucket=self.bucket,
                Key=key
            )
        except ClientError as e:
            print(f"파일 삭제 중 오류 발생: {str(e)}")
            raise 