from flask import Blueprint, request
from flask_login import login_required
from app.s3_helpers import (upload_file_to_s3, allowed_file,
                            get_unique_filename, detect_image, shrink_image)

img_routes = Blueprint('img', __name__)


@img_routes.route('/upload', methods=['POST'])
@login_required
def upload_image():
    """
    Uploads one image (png, jpg, gif, webp; max size = MAX_CONTENT_LENGTH)
    to S3 and returns its public URL.
    """
    if "image" not in request.files:
        return {"errors": "image required"}, 400

    image = request.files["image"]
    if not image.filename or not allowed_file(image.filename):
        return {"errors": "file type not permitted (png, jpg, jpeg, gif, webp only)"}, 400

    detected = detect_image(image)
    if detected is None:
        return {"errors": "file is not a valid image"}, 400
    ext, content_type = detected

    # Scale down very large photos before storing them (A30)
    shrink_image(image)

    # Name the S3 object after the *detected* type, not the user's filename.
    image.filename = get_unique_filename(f'upload.{ext}')

    upload = upload_file_to_s3(image, content_type=content_type)
    if "url" not in upload:
        # if the dictionary doesn't have a url key
        # it means that there was an error when we tried to upload
        # so we send back that error message
        return upload, 400

    return {"url": upload["url"]}
