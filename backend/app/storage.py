
import os
from io import BytesIO
from functools import lru_cache

import boto3
from botocore.config import Config


def get_setting(name):
    value = os.getenv(name)

    if not value:
        raise RuntimeError(
            f"Missing storage environment variable: {name}"
        )

    return value.strip()


@lru_cache(maxsize=1)
def get_storage_client():

    return boto3.client(
        "s3",
        endpoint_url=get_setting("AWS_ENDPOINT_URL_S3"),
        aws_access_key_id=get_setting("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=get_setting(
            "AWS_SECRET_ACCESS_KEY"
        ),
        region_name=get_setting("AWS_REGION"),
        config=Config(
            signature_version="s3v4",
            s3={
                "addressing_style": "path"
            },
            retries={
                "max_attempts": 3,
                "mode": "standard"
            }
        )
    )


def get_bucket_name():
    return get_setting("NEON_STORAGE_BUCKET")


def upload_dataset(file_object, object_key, content_type="text/csv"):

    client = get_storage_client()
    bucket = get_bucket_name()

    file_object.seek(0)

    client.upload_fileobj(
        file_object,
        bucket,
        object_key,
        ExtraArgs={
            "ContentType": content_type
        }
    )

    return object_key


def download_dataset(object_key):

    client = get_storage_client()
    bucket = get_bucket_name()

    response = client.get_object(
        Bucket=bucket,
        Key=object_key
    )

    try:
        return BytesIO(response["Body"].read())

    finally:
        response["Body"].close()


def delete_dataset(object_key):

    client = get_storage_client()
    bucket = get_bucket_name()

    client.delete_object(
        Bucket=bucket,
        Key=object_key
    )


def test_storage_connection():

    client = get_storage_client()

    response = client.head_bucket(
        Bucket=get_bucket_name()
    )

    return response.get("ResponseMetadata", {}).get(
        "HTTPStatusCode"
    ) == 200
