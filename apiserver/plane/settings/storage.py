# Python imports
import os

# Third party imports
import boto3
from botocore.exceptions import ClientError
from urllib.parse import quote

# Module imports
from plane.utils.exception_logger import log_exception
from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings


class S3Storage(S3Boto3Storage):
    def url(self, name, parameters=None, expire=None, http_method=None):
        return name

    """S3 storage class to generate presigned URLs for S3 objects"""

    def __init__(self, request=None):
        # Get the AWS credentials and bucket name from the environment
        self.aws_access_key_id = os.environ.get("AWS_ACCESS_KEY_ID")
        # Use the AWS_SECRET_ACCESS_KEY environment variable for the secret key
        self.aws_secret_access_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        # Use the AWS_S3_BUCKET_NAME environment variable for the bucket name
        self.aws_storage_bucket_name = os.environ.get("AWS_S3_BUCKET_NAME")
        # Use the AWS_REGION environment variable for the region
        self.aws_region = os.environ.get("AWS_REGION")
        # Use the AWS_S3_ENDPOINT_URL environment variable for the endpoint URL
        self.aws_s3_endpoint_url = os.environ.get(
            "AWS_S3_ENDPOINT_URL"
        ) or os.environ.get("MINIO_ENDPOINT_URL")

        if os.environ.get("USE_MINIO") == "1":
            # Create an S3 client for MinIO
            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.aws_region,
                endpoint_url=self.aws_s3_endpoint_url,
                config=boto3.session.Config(signature_version="s3v4"),
            )
        else:
            # Create an S3 client
            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.aws_region,
                endpoint_url=self.aws_s3_endpoint_url,
                config=boto3.session.Config(signature_version="s3v4"),
            )

    def generate_presigned_post(
        self, object_name, file_type, file_size, expiration=3600
    ):
        """Generate a presigned URL to upload an S3 object"""
        print(f"\n=== Generate Presigned Post ===")
        print(f"object_name: {object_name}")
        print(f"file_type: {file_type}")
        print(f"file_size: {file_size}")

        fields = {
            "Content-Type": file_type,
            "key": object_name,
        }

        conditions = [
            {"bucket": self.aws_storage_bucket_name},
            ["content-length-range", 1, file_size],
            {"Content-Type": file_type},
            {"key": object_name},
        ]

        print(f"\nFields: {fields}")
        print(f"Conditions: {conditions}")

        try:
            # Generate a presigned URL for the S3 object
            response = self.s3_client.generate_presigned_post(
                Bucket=self.aws_storage_bucket_name,
                Key=object_name,
                Fields=fields,
                Conditions=conditions,
                ExpiresIn=expiration,
            )

            # nginx가 /storage/uploads로 프록시하므로 /uploads로 설정
            response['url'] = f"/{self.aws_storage_bucket_name}"
            
            print(f"\nGenerated Response: {response}")
            return response
        except ClientError as e:
            print(f"\nError generating presigned POST URL: {e}")
            return None

    def _get_content_disposition(self, disposition, filename=None):
        """Helper method to generate Content-Disposition header value"""
        if filename:
            # Encode the filename to handle special characters
            encoded_filename = quote(filename)
            return f"{disposition}; filename*=UTF-8''{encoded_filename}"
        return disposition

    def generate_presigned_url(
        self,
        object_name,
        expiration=3600,
        http_method="GET",
        disposition="inline",
        filename=None,
    ):
        content_disposition = self._get_content_disposition(disposition, filename)
        """Generate a presigned URL to share an S3 object"""
        try:
            # 내부 URL 생성 (/storage 제거)
            return f"/{self.aws_storage_bucket_name}/{object_name}?response-content-disposition={quote(content_disposition)}"
        except Exception as e:
            print(f"Error generating URL: {e}")
            return None

    def get_object_metadata(self, object_name):
        """Get the metadata for an S3 object"""
        try:
            response = self.s3_client.head_object(
                Bucket=self.aws_storage_bucket_name, Key=object_name
            )
        except ClientError as e:
            log_exception(e)
            return None

        return {
            "ContentType": response.get("ContentType"),
            "ContentLength": response.get("ContentLength"),
            "LastModified": (
                response.get("LastModified").isoformat()
                if response.get("LastModified")
                else None
            ),
            "ETag": response.get("ETag"),
            "Metadata": response.get("Metadata", {}),
        }

    def get_object(self, object_name):
        """Get an object from MinIO/S3"""
        try:
            # object_name이 None이거나 빈 문자열인 경우 체크
            if not object_name:
                return None
            
            # asset 필드가 PosixPath 객체일 수 있으므로 문자열로 변환
            key = str(object_name)
            
            response = self.s3_client.get_object(
                Bucket=self.aws_storage_bucket_name,
                Key=key
            )
            return response.get('Body')
        except ClientError as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"S3 Client Error - Key: {object_name}, Error: {str(e)}")
            return None
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Unexpected Error - Key: {object_name}, Error: {str(e)}")
            return None

    def delete_object(self, object_name):
        """Delete an object from MinIO/S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.aws_storage_bucket_name,
                Key=str(object_name)
            )
            return True
        except ClientError as e:
            log_exception(e)
            return False
