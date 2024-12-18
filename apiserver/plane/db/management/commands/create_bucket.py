# Python imports
import os
import json
import boto3
from botocore.exceptions import ClientError

# Django imports
from django.core.management import BaseCommand


class Command(BaseCommand):
    help = "Create the default bucket for the instance"

    def handle(self, *args, **options):
        # Create a session using the credentials from Django settings
        try:
            s3_client = boto3.client(
                "s3",
                endpoint_url=os.environ.get("AWS_S3_ENDPOINT_URL"),  # MinIO endpoint
                aws_access_key_id=os.environ.get(
                    "AWS_ACCESS_KEY_ID"
                ),  # MinIO access key
                aws_secret_access_key=os.environ.get(
                    "AWS_SECRET_ACCESS_KEY"
                ),  # MinIO secret key
                region_name=os.environ.get("AWS_REGION"),  # MinIO region
                config=boto3.session.Config(signature_version="s3v4"),
            )
            # Get the bucket name from the environment
            bucket_name = os.environ.get("AWS_S3_BUCKET_NAME")
            self.stdout.write(self.style.NOTICE("Checking bucket..."))
            # Check if the bucket exists
            s3_client.head_bucket(Bucket=bucket_name)
            # If the bucket exists, print a success message
            self.stdout.write(self.style.SUCCESS(f"Bucket '{bucket_name}' exists."))
            
            # Set bucket policy to private
            self.set_private_policy(s3_client, bucket_name)
            return
            
        except ClientError as e:
            error_code = int(e.response["Error"]["Code"])
            bucket_name = os.environ.get("AWS_S3_BUCKET_NAME")
            if error_code == 404:
                # Bucket does not exist, create it
                self.stdout.write(
                    self.style.WARNING(
                        f"Bucket '{bucket_name}' does not exist. Creating bucket..."
                    )
                )
                try:
                    s3_client.create_bucket(Bucket=bucket_name)
                    # Set bucket policy to private
                    self.set_private_policy(s3_client, bucket_name)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Bucket '{bucket_name}' created successfully with private policy."
                        )
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"Error creating bucket: {str(e)}")
                    )
            else:
                self.stdout.write(
                    self.style.ERROR(f"Error checking bucket: {str(e)}")
                )

    def set_private_policy(self, s3_client, bucket_name):
        try:
            # Private policy configuration
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Deny",
                        "Principal": {"AWS": "*"},
                        "Action": "s3:*",
                        "Resource": [
                            f"arn:aws:s3:::{bucket_name}",
                            f"arn:aws:s3:::{bucket_name}/*"
                        ]
                    }
                ]
            }
            
            # Set the bucket policy
            s3_client.put_bucket_policy(
                Bucket=bucket_name,
                Policy=json.dumps(policy)
            )
            
            self.stdout.write(
                self.style.SUCCESS(f"Private policy set for bucket '{bucket_name}'")
            )
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f"Error setting bucket policy: {str(e)}")
            )
