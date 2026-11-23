import boto3
import botocore
import os
import uuid

from PIL import Image, UnidentifiedImageError

# The boto3 client is created on first use (not at import time), and it gets
# credentials from boto3's default chain instead of S3_KEY/S3_SECRET:
#   - on EC2: the instance's IAM role (no keys stored anywhere)
#   - locally: `aws configure` / `aws sso login` (~/.aws) or the standard
#     AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_PROFILE env vars
_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3", region_name=os.environ.get("AWS_REGION") or None)
    return _s3_client


# Only real image types are accepted (pdf used to be allowed).
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Pillow's detected format -> (file extension, Content-Type we store in S3).
# We use what Pillow detects from the bytes, never the browser-supplied
# filename or content type, so a file cannot pretend to be an image.
IMAGE_FORMATS = {
    'PNG': ('png', 'image/png'),
    'JPEG': ('jpg', 'image/jpeg'),
    'GIF': ('gif', 'image/gif'),
    'WEBP': ('webp', 'image/webp'),
}

# Every upload is stored under this key prefix in the bucket.
UPLOAD_PREFIX = 'uploads/'


def allowed_file(filename):
    return '.' in filename and \
            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def detect_image(file):
    """
    Check that the uploaded bytes really are an image.
    Returns (extension, content_type) or None if it is not a supported image.
    Leaves the file positioned at the start so it can be uploaded afterwards.
    """
    try:
        file.stream.seek(0)
        with Image.open(file.stream) as img:
            img_format = img.format
            img.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        return None
    finally:
        file.stream.seek(0)
    return IMAGE_FORMATS.get(img_format)


def get_unique_filename(filename):
    # Bug fix: this used to build "<uuid>,<ext>" with a comma instead of a dot.
    ext = filename.rsplit('.', 1)[1].lower()
    unique_filename = uuid.uuid4().hex
    return f'{UPLOAD_PREFIX}{unique_filename}.{ext}'


BUCKET_NAME = os.environ.get('S3_BUCKET')
# Public base URL for uploaded files. Defaults to the bucket's own URL; set
# S3_PUBLIC_URL (e.g. https://cdn.example.com/) when serving through CloudFront.
S3_LOCATION = os.environ.get('S3_PUBLIC_URL') or f'https://{BUCKET_NAME}.s3.amazonaws.com/'
if not S3_LOCATION.endswith('/'):
    S3_LOCATION += '/'


def upload_file_to_s3(file, content_type=None):
    # No ACL: new S3 buckets have ACLs disabled ("bucket owner enforced") and
    # reject uploads that send one. Public read access to uploads/* is granted
    # by a bucket policy (or CloudFront) instead - see CHANGES.md (A5).
    try:
        get_s3_client().upload_fileobj(
            file,
            BUCKET_NAME,
            file.filename,
            ExtraArgs={
                'ContentType': content_type or file.content_type
            }
        )
    except Exception as e:
        # in case the s3 upload fails
        return {'errors': str(e)}
    return {'url': f'{S3_LOCATION}{file.filename}'}
