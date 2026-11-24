import React, { useId, useState } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { uploadImage, checkImageFile } from "../../store/uploads";
import "./ImageUploadComponent.css";

// Two modes:
// - default: the user picks a file and clicks "Upload"; on success setUrl(url) is called.
// - deferred (onFileSelected given): only picks and previews the file; the parent
//   uploads it later (used on sign-up, because uploads require a logged-in user).
const ImageUploadComponent = ({ setUrl, onFileSelected, labelledBy }) => {
  const inputId = useId();
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
    <div className="upload">
      <div className="upload__row">
        {uploadedImg && <img src={prevImgUrl} alt="Preview of the chosen picture" className="upload__preview" />}
        <label htmlFor={inputId} className="btn btn--secondary btn--sm upload__pick">
          <FiUploadCloud aria-hidden="true" />
          {uploadedImg ? 'Choose a different picture' : 'Choose a picture'}
        </label>
        <input id={inputId} type="file" accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only" onChange={updateImage} aria-labelledby={labelledBy} />
        {!onFileSelected && (
          <button type="button" className="btn btn--primary btn--sm" disabled={!image || imageLoading} onClick={handleSubmit}>
            {imageLoading ? 'Uploading...' : 'Upload'}
          </button>
        )}
      </div>
      {image && !onFileSelected && <p className="field-hint">Selected: {image.name}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
};

export default ImageUploadComponent;
