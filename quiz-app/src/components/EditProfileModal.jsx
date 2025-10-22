import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/edit-profile.css';

// Confirmation Dialog Component
const ConfirmationDialog = ({ isOpen, onConfirm, onCancel, message }) => {
  if (!isOpen) return null;

  return (
    <div className="confirmation-overlay">
      <div className="confirmation-dialog">
        <div className="confirmation-content">
          <h3>Confirm Changes</h3>
          <p>{message || 'Are you sure you want to save these changes?'}</p>
          <div className="confirmation-actions">
            <button 
              className="button button-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button 
              className="button button-primary"
              onClick={onConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditProfileModal = ({ user, onClose, onUpdate }) => {
  const isStaff = user?.role === 'staff';
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    rollNumber: user?.rollNumber || '',
    department: user?.department || '',
    ...(isStaff ? {} : {
      section: user?.section || '',
      batch: user?.batch || ''
    }),
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const formRef = useRef(null);
  const modalContentRef = useRef(null);
  
  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if confirmation dialog is open or if click is inside the modal content
      if (showConfirmation || (modalContentRef.current && modalContentRef.current.contains(event.target))) {
        return;
      }
      onClose();
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, showConfirmation]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        rollNumber: user.rollNumber || '',
        department: user.department || '',
        section: user.section || '',
        batch: user.batch || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    setError('');
    setSuccess('');
    
    // Only validate passwords if new password is provided
    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters long');
        return false;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!validateForm()) {
      return;
    }
    
    // Show confirmation dialog
    setShowConfirmation(true);
  };
  
  const handleConfirmSave = async () => {
    console.log('=== UPDATE PROFILE STARTED ===');
    setIsLoading(true);
    setError('');
    setSuccess('');
  
    try {
      const updateData = {
        name: formData.name,
        rollNumber: formData.rollNumber,
        department: formData.department,
        ...(!isStaff && {
          section: formData.section,
          batch: formData.batch
        }),
        ...(formData.newPassword && formData.newPassword.trim() !== '' && { 
          newPassword: formData.newPassword 
        })
      };
  
      console.log('Update payload:', updateData);
  
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
  
      const response = await axios.put('/api/users/profile', updateData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
  
      console.log('Update response:', response.data);
  
      if (response.data && response.data.success) {
        setSuccess('Profile updated successfully!');
        
        // Update local user data
        if (onUpdate && response.data.user) {
          onUpdate(response.data.user);
          
          // If roll number was changed, update it in localStorage
          if (response.data.user.rollNumber) {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({
              ...currentUser,
              rollNumber: response.data.user.rollNumber
            }));
          }
        }
        
        // Update token if password was changed
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
  
        // Close confirmation dialog first
        setShowConfirmation(false);
        
        // Then close the modal after a delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(response.data?.message || 'Update failed');
      }
    } catch (err) {
      console.error('Update error:', err);
      let errorMsg = err.response?.data?.message || 
                    err.response?.data?.error || 
                    err.message;
      
      // Handle roll number conflict specifically
      if (err.response?.data?.field === 'rollNumber') {
        errorMsg = 'This roll number is already in use. Please choose a different one.';
      }
      
      setError(errorMsg || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };
  if (!user) return null;

  return (
    <div className="edit-profile-modal">
      <div className="edit-profile-content" ref={modalContentRef}>
        <div className="edit-profile-header">
          <h2>Edit Profile</h2>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            disabled={isLoading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {error && (
          <div className="status-message error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="status-message success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} ref={formRef}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rollNumber">Roll Number</label>
            <input
              type="text"
              id="rollNumber"
              name="rollNumber"
              value={formData.rollNumber}
              onChange={handleChange}
              required
              disabled={isLoading}
              pattern="[A-Za-z0-9]+"
              title="Please enter a valid roll number (letters and numbers only)"
              className={error && error.includes('roll number') ? 'error-input' : ''}
            />
            {error && error.includes('roll number') && (
              <div className="field-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <input
              type="text"
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          {!isStaff && (
            <>
              <div className="form-group">
                <label htmlFor="section">Section</label>
                <input
                  type="text"
                  id="section"
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="batch">Batch</label>
                <input
                  type="text"
                  id="batch"
                  name="batch"
                  value={formData.batch}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="newPassword">New Password (leave blank to keep current)</label>
            <div className="password-input-container">
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="Enter new password"
                disabled={isLoading}
              />
            </div>
          </div>

          {formData.newPassword && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="password-input-container">
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button button-primary ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirmation(false)}
        message="Are you sure you want to save these changes?"
      />
    </div>
  );
};

export default EditProfileModal;
