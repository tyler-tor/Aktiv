import boto3
import io
import uuid

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError

# The boto3 client is created on first use (not at import time), and it gets
# credentials from boto3's default chain instead of S3_KEY/S3_SECRET:
#   - on EC2: the instance's IAM role (no keys stored anywhere)
#   - locally: `aws configure` / `aws sso login` (~/.aws) or the standard
#     AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_PROFILE env vars
_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=current_app.config['AWS_REGION'])
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


# Phone photos are 4000+ pixels wide (several MB) but the app shows them at most
# ~800 px wide. Bigger uploads are scaled down so pages load faster and storage
# and bandwidth stay small. Animated GIFs are left alone (resizing would break them).
MAX_IMAGE_PIXELS = 1600


def shrink_image(file, max_px=MAX_IMAGE_PIXELS):
    """
    If the image is larger than max_px on its longer side, replace the file's
    contents with a scaled-down copy in the same format (JPEG quality 85) and
    apply the EXIF rotation first (a re-saved JPEG loses that tag). Returns
    True when the file was changed. Any problem leaves the original untouched.
    """
    original = file.stream
    try:
        original.seek(0)
        with Image.open(original) as img:
            img_format = img.format
            if img_format == 'GIF' or max(img.size) <= max_px:
                original.seek(0)
                return False
            img = ImageOps.exif_transpose(img)
            img.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            if img_format == 'JPEG':
                if img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                img.save(out, 'JPEG', quality=85, optimize=True)
            elif img_format == 'PNG':
                img.save(out, 'PNG', optimize=True)
            else:
                img.save(out, img_format, quality=85)
        out.seek(0)
        file.stream = out
        return True
    except Exception:
        file.stream = original
        original.seek(0)
        return False


def get_unique_filename(filename):
    # Bug fix: this used to build "<uuid>,<ext>" with a comma instead of a dot.
    ext = filename.rsplit('.', 1)[1].lower()
    unique_filename = uuid.uuid4().hex
    return f'{UPLOAD_PREFIX}{unique_filename}.{ext}'


def media_base_url():
    """
    Public base URL of uploaded files, always ending in "/".

    MEDIA_BASE_URL in production (https://aktiv.tylertorrero.dev/media: the
    bucket stays private and CloudFront serves /media/* from it). Without it,
    the bucket's own S3 URL.
    """
    base = current_app.config.get('MEDIA_BASE_URL')
    if not base:
        base = (f"https://{current_app.config.get('S3_BUCKET')}.s3."
                f"{current_app.config['AWS_REGION']}.amazonaws.com")
    return base.rstrip('/') + '/'


def is_uploaded_image_url(url):
    """True for a URL returned by /api/img/upload (our media, uploads/ prefix)."""
    return isinstance(url, str) and url.startswith(media_base_url() + UPLOAD_PREFIX)


def upload_file_to_s3(file, content_type=None):
    # No ACL: new S3 buckets have ACLs disabled ("bucket owner enforced") and
    # reject uploads that send one. Read access is granted to CloudFront only
    # (Origin Access Control), so the bucket never has to be public.
    bucket = current_app.config.get('S3_BUCKET')
    if not bucket:
        return {'errors': 'Image uploads are not configured (S3_BUCKET is not set)'}
    try:
        get_s3_client().upload_fileobj(
            file,
            bucket,
            file.filename,
            ExtraArgs={
                'ContentType': content_type or file.content_type
            }
        )
    except Exception as e:
        # in case the s3 upload fails (logged in full, short message to the user)
        current_app.logger.warning('S3 upload failed: %s', e)
        return {'errors': 'Upload failed, please try again'}
    return {'url': f'{media_base_url()}{file.filename}'}
