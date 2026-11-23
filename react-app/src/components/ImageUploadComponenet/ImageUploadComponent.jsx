import React, { useState } from "react";
import { uploadImage, checkImageFile } from "../../store/uploads";
import "./ImageUploadComponent.css";

// Two modes:
// - default: the user picks a file and clicks "Upload"; on success setUrl(url) is called.
// - deferred (onFileSelected given): only picks and previews the file; the parent
//   uploads it later (used on sign-up, because uploads require a logged-in user).
const ImageUploadComponent = ({ setUrl, onFileSelected }) => {
  const [image, setImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [uploadedImg, setUploadImg] = useState(false);
  const [prevImgUrl, setPrevImgUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setImageLoading(true);
    const result = await uploadImage(image);
    setImageLoading(false);
    if (result.url) {
      setUrl(result.url);
      setUploadImg(true);
      setPrevImgUrl(result.url);
    } else {
      setError(result.error);
    }
  };

  const updateImage = (e) => {
    const file = e.target.files[0];
    setError("");
    setImage(file);
    if (onFileSelected) {
      const problem = checkImageFile(file);
      if (problem) {
        setError(problem);
        onFileSelected(null);
        setUploadImg(false);
        return;
      }
      onFileSelected(file);
      setPrevImgUrl(URL.createObjectURL(file));
      setUploadImg(true);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}
      className='upload-form-container'>
        <div className="upload-photo-container">
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp"
          className='uli-input' onChange={updateImage} />
          {!onFileSelected && (
            <button type="submit" className="upload-img-btn" disabled={!image || imageLoading}>Upload</button>
          )}
        </div>
        {imageLoading && <p>Loading...</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </form>
      {uploadedImg && (
        <img src={prevImgUrl} alt="yours" className="prev_img" />
      )}
    </>
  );
};

export default ImageUploadComponent;
