import os
from functools import lru_cache
from io import BytesIO

import boto3
from botocore.config import Config
from boto3.s3.transfer import TransferConfig


def get_setting(name: str) -> str:
    value = os.getenv(name, "").strip()

    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")

    return value


def get_bucket_name() -> str:
    return get_setting("NEON_STORAGE_BUCKET")


@lru_cache(maxsize=1)
def get_storage_client():
    endpoint = get_setting("AWS_ENDPOINT_URL_S3").rstrip("/")
    region = get_setting("AWS_REGION")

    if not endpoint.startswith("https://"):
        raise RuntimeError(
            "AWS_ENDPOINT_URL_S3 must be the HTTPS S3 endpoint copied from Neon's Storage connection settings"
        )

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=get_setting("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=get_setting("AWS_SECRET_ACCESS_KEY"),
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            connect_timeout=10,
            read_timeout=30,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def upload_dataset(file_object, object_key: str, content_type: str = "text/csv"):
    """Upload a seekable file object to the configured Neon bucket."""
    client = get_storage_client()
    file_object.seek(0)

    # The API currently limits uploads to 25 MB. Keep this below the
    # multipart threshold so boto3 uses a single PutObject operation.
    transfer_config = TransferConfig(
        multipart_threshold=32 * 1024 * 1024,
        multipart_chunksize=8 * 1024 * 1024,
        use_threads=False,
    )

    client.upload_fileobj(
        file_object,
        get_bucket_name(),
        object_key,
        ExtraArgs={"ContentType": content_type},
        Config=transfer_config,
    )

    return object_key


def download_dataset(object_key: str) -> BytesIO:
    client = get_storage_client()
    response = client.get_object(
        Bucket=get_bucket_name(),
        Key=object_key,
    )

    body = response["Body"]
    try:
        return BytesIO(body.read())
    finally:
        body.close()


def delete_dataset(object_key: str) -> None:
    client = get_storage_client()
    client.delete_object(
        Bucket=get_bucket_name(),
        Key=object_key,
    )


def test_storage_connection() -> bool:
    """Test bucket access with ListObjects, a documented Neon read operation."""
    client = get_storage_client()

    # Do not use head_bucket here. Test real bucket access with ListObjectsV2.
    response = client.list_objects_v2(
        Bucket=get_bucket_name(),
        MaxKeys=1,
    )

    status_code = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return status_code == 200
