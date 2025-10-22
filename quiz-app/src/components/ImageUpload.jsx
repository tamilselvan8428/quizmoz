import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import '../styles/img.css'; 

const ImageUpload = ({ onUploadSuccess, questionIndex }) => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050';

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPEG, PNG, and GIF images are allowed');
      return;
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setError('');
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!image) {
      setError('Please select an image first');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('image', image);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${baseURL}/api/images`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          // Optional: Add progress tracking here
        }
      });

      if (response.data.success) {
        onUploadSuccess(questionIndex, response.data.imageId, response.data.contentType);
        setImage(null);
        setPreview('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error('Upload failed: Invalid response from server');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || err.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="image-upload-container">
      <div className="image-preview">
        {preview ? (
          <img src={preview} alt="Preview" className="preview-image" />
        ) : (
          <div className="no-image">No image selected</div>
        )}
      </div>
      
      <div className="upload-controls">
        <input
          type="file"
          accept="image/jpeg, image/png, image/gif"
          onChange={handleImageChange}
          disabled={isUploading}
          id={`image-upload-${questionIndex}`}
          className="file-input"
          aria-label="Upload image"
        />
        <label htmlFor={`image-upload-${questionIndex}`} className="upload-button">
          Choose Image
        </label>
        
        {image && (
          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className="upload-button"
            aria-busy={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Image uploaded successfully!</div>}
    </div>
  );
};

ImageUpload.propTypes = {
  onUploadSuccess: PropTypes.func.isRequired,
  questionIndex: PropTypes.number.isRequired
};

export default ImageUpload;