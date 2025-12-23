import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import {
    User, Lock, Key, Mail, Building2, Save, RefreshCw,
    Eye, EyeOff, Check, AlertCircle, Calendar
} from 'lucide-react';
import './SettingsPanel.css';

interface UserProfile {
    tenant_id: string;
    company_name: string;
    email: string;
    api_key: string;
    created_at: string | null;
    last_login: string | null;
}

interface SettingsPanelProps {
    token: string;
    onApiKeyChange?: (newKey: string) => void;
}

const SettingsPanel = ({ token, onApiKeyChange }: SettingsPanelProps) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form states
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                setCompanyName(data.company_name);
                setEmail(data.email);
            } else {
                setError('Failed to load profile');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [token]);

    const showMessage = (type: 'success' | 'error', message: string) => {
        if (type === 'success') {
            setSuccess(message);
            setError('');
        } else {
            setError(message);
            setSuccess('');
        }
        setTimeout(() => { setSuccess(''); setError(''); }, 4000);
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ company_name: companyName, email })
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('success', 'Profile updated successfully');
                fetchProfile();
            } else {
                showMessage('error', data.error || 'Failed to update profile');
            }
        } catch (err) {
            showMessage('error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showMessage('error', 'Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            showMessage('error', 'Password must be at least 6 characters');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/password`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('success', 'Password changed successfully');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                showMessage('error', data.error || 'Failed to change password');
            }
        } catch (err) {
            showMessage('error', 'Failed to change password');
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateApiKey = async () => {
        if (!confirm('Are you sure? This will invalidate your current API key.')) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/api-key`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('success', 'API key regenerated successfully');
                localStorage.setItem('api_key', data.api_key);
                if (onApiKeyChange) onApiKeyChange(data.api_key);
                fetchProfile();
            } else {
                showMessage('error', data.error || 'Failed to regenerate API key');
            }
        } catch (err) {
            showMessage('error', 'Failed to regenerate API key');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="settings-loading">
                <div className="settings-spinner" />
                <span>Loading settings...</span>
            </div>
        );
    }

    return (
        <div className="settings-panel">
            {/* Messages */}
            {success && (
                <div className="settings-message success">
                    <Check size={16} /> {success}
                </div>
            )}
            {error && (
                <div className="settings-message error">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* Profile Info Card */}
            <div className="settings-section">
                <div className="settings-section-header">
                    <User size={20} />
                    <h3>Account Information</h3>
                </div>
                <div className="settings-info-grid">
                    <div className="settings-info-item">
                        <span className="label">Tenant ID</span>
                        <code>{profile?.tenant_id}</code>
                    </div>
                    <div className="settings-info-item">
                        <span className="label"><Calendar size={14} /> Member Since</span>
                        <span>{formatDate(profile?.created_at || null)}</span>
                    </div>
                    <div className="settings-info-item">
                        <span className="label">Last Login</span>
                        <span>{formatDate(profile?.last_login || null)}</span>
                    </div>
                </div>
            </div>

            {/* Profile Settings */}
            <div className="settings-section">
                <div className="settings-section-header">
                    <Building2 size={20} />
                    <h3>Profile Settings</h3>
                </div>
                <form onSubmit={handleUpdateProfile} className="settings-form">
                    <div className="form-group">
                        <label><Building2 size={14} /> Company Name</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Your Company"
                        />
                    </div>
                    <div className="form-group">
                        <label><Mail size={14} /> Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@company.com"
                        />
                    </div>
                    <button type="submit" className="settings-btn primary" disabled={saving}>
                        <Save size={16} /> Save Changes
                    </button>
                </form>
            </div>

            {/* Change Password */}
            <div className="settings-section">
                <div className="settings-section-header">
                    <Lock size={20} />
                    <h3>Change Password</h3>
                </div>
                <form onSubmit={handleChangePassword} className="settings-form">
                    <div className="form-group">
                        <label>Current Password</label>
                        <div className="password-input">
                            <input
                                type={showCurrentPassword ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                            />
                            <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>New Password</label>
                        <div className="password-input">
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                            />
                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}>
                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                        />
                    </div>
                    <button type="submit" className="settings-btn primary" disabled={saving}>
                        <Lock size={16} /> Change Password
                    </button>
                </form>
            </div>

            {/* API Key */}
            <div className="settings-section">
                <div className="settings-section-header">
                    <Key size={20} />
                    <h3>API Key</h3>
                </div>
                <div className="api-key-display">
                    <code>{profile?.api_key}</code>
                </div>
                <p className="settings-hint">
                    Your API key is used to send telemetry data to SkyView. Regenerating it will invalidate the current key.
                </p>
                <button
                    onClick={handleRegenerateApiKey}
                    className="settings-btn danger"
                    disabled={saving}
                >
                    <RefreshCw size={16} /> Regenerate API Key
                </button>
            </div>
        </div>
    );
};

export default SettingsPanel;
