import boto3
import botocore
import os
import uuid

from PIL import Image, UnidentifiedImageError

s3 = boto3.client(
   "s3",
   aws_access_key_id=os.environ.get("S3_KEY"),
   aws_secret_access_key=os.environ.get("S3_SECRET")
)

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
S3_LOCATION = f'https://{BUCKET_NAME}.s3.amazonaws.com/'


def upload_file_to_s3(file, content_type=None, acl='public-read'):
    try:
        s3.upload_fileobj(
            file,
            BUCKET_NAME,
            file.filename,
            ExtraArgs={
                'ACL': acl,
                'ContentType': content_type or file.content_type
            }
        )
    except Exception as e:
        # in case the s3 upload fails
        return {'errors': str(e)}
    return {'url': f'{S3_LOCATION}{file.filename}'}
