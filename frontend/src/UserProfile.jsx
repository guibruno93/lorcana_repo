// UserProfile.jsx - Página de perfil do usuário
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './UserProfile.css';

const UserProfile = ({ user, setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'password', 'danger'
  const [loading, setLoading] = useState(false);
  
  // Profile edit
  const [username, setUsername] = useState(user.username || '');
  const [avatar, setAvatar] = useState(user.avatar_url || '');
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url || '');
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Messages
  const [message, setMessage] = useState({ type: '', text: '' });

  // Update profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // TODO: Implementar API call
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username, avatar_url: avatar })
      });

      if (!response.ok) throw new Error('Failed to update profile');

      const updatedUser = await response.json();
      
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setMessage({ type: 'success', text: t('userProfile.profileUpdated') });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: t('userProfile.updateFailed') });
    } finally {
      setLoading(false);
    }
  };

  // Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('userProfile.passwordsDontMatch') });
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: t('userProfile.passwordTooShort') });
      setLoading(false);
      return;
    }

    try {
      // TODO: Implementar API call
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          currentPassword, 
          newPassword 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change password');
      }

      setMessage({ type: 'success', text: t('userProfile.passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: error.message || t('userProfile.passwordChangeFailed') });
    } finally {
      setLoading(false);
    }
  };

  // Upload avatar
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: t('userProfile.fileTooLarge') });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: t('userProfile.invalidFileType') });
      return;
    }

    try {
      setLoading(true);

      // Preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);

      // TODO: Upload to storage (Supabase Storage, AWS S3, etc.)
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to upload avatar');

      const { avatar_url } = await response.json();
      setAvatar(avatar_url);
      setMessage({ type: 'success', text: t('userProfile.avatarUploaded') });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage({ type: 'error', text: t('userProfile.avatarUploadFailed') });
    } finally {
      setLoading(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    const confirmation = window.prompt(
      t('userProfile.deleteConfirmation'),
      ''
    );

    if (confirmation !== user.email) {
      setMessage({ type: 'error', text: t('userProfile.deleteCancelled') });
      return;
    }

    try {
      setLoading(true);

      // TODO: Implementar API call
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete account');

      // Logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      setMessage({ type: 'error', text: t('userProfile.deleteFailed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h1>{t('userProfile.title')}</h1>
        <button onClick={() => navigate(-1)} className="btn-back">
          ← {t('common.back')}
        </button>
      </div>

      {message.text && (
        <div className={`profile-message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="profile-container">
        {/* Sidebar */}
        <div className="profile-sidebar">
          <div className="profile-avatar-section">
            <div className="avatar-container">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="avatar" />
              ) : (
                <div className="avatar-placeholder">
                  {(user.username || user.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <label className="btn-upload-avatar">
              📷 {t('userProfile.changeAvatar')}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <nav className="profile-nav">
            <button
              onClick={() => setActiveTab('profile')}
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            >
              👤 {t('userProfile.profile')}
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`nav-item ${activeTab === 'password' ? 'active' : ''}`}
            >
              🔒 {t('userProfile.security')}
            </button>
            <button
              onClick={() => setActiveTab('danger')}
              className={`nav-item ${activeTab === 'danger' ? 'active' : ''}`}
            >
              ⚠️ {t('userProfile.dangerZone')}
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="profile-content">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="profile-section">
              <h2>{t('userProfile.editProfile')}</h2>
              <form onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label>{t('userProfile.username')}:</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('userProfile.usernamePlaceholder')}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('userProfile.email')}:</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="input-disabled"
                  />
                  <small>{t('userProfile.emailCantChange')}</small>
                </div>

                <div className="form-group">
                  <label>{t('userProfile.memberSince')}:</label>
                  <input
                    type="text"
                    value={new Date(user.created_at || Date.now()).toLocaleDateString()}
                    disabled
                    className="input-disabled"
                  />
                </div>

                <button type="submit" className="btn-save" disabled={loading}>
                  {loading ? t('common.saving') : t('common.save')}
                </button>
              </form>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="profile-section">
              <h2>{t('userProfile.changePassword')}</h2>
              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label>{t('userProfile.currentPassword')}:</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('userProfile.newPassword')}:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <small>{t('userProfile.passwordRequirements')}</small>
                </div>

                <div className="form-group">
                  <label>{t('userProfile.confirmPassword')}:</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button type="submit" className="btn-save" disabled={loading}>
                  {loading ? t('common.saving') : t('userProfile.updatePassword')}
                </button>
              </form>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="profile-section danger-section">
              <h2>{t('userProfile.dangerZone')}</h2>
              <div className="danger-content">
                <p>{t('userProfile.deleteWarning')}</p>
                <button 
                  onClick={handleDeleteAccount} 
                  className="btn-delete"
                  disabled={loading}
                >
                  {loading ? t('common.deleting') : t('userProfile.deleteAccount')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
