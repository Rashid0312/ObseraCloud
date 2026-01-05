// frontend/src/components/DataDeletionPanel.tsx
import React, { useState } from 'react';
import './DataDeletionPanel.css';

interface DataDeletionPanelProps {
    tenantId: string;
    onClose: () => void;
}

export const DataDeletionPanel: React.FC<DataDeletionPanelProps> = ({ tenantId, onClose }) => {
    const [dataType, setDataType] = useState<'traces' | 'logs'>('traces');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [previewCount, setPreviewCount] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handlePreview = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/${dataType}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    start_time: new Date(startDate).toISOString(),
                    end_time: new Date(endDate).toISOString()
                })
            });

            const data = await response.json();

            if (response.ok) {
                setPreviewCount(data.deleted_count);
                setShowConfirm(true);
            } else {
                setError(data.error || 'Failed to preview deletion');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/${dataType}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    start_time: new Date(startDate).toISOString(),
                    end_time: new Date(endDate).toISOString()
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Successfully deleted ${data.deleted_count} ${dataType}`);
                setShowConfirm(false);
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 2000);
            } else {
                setError(data.error || 'Failed to delete data');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="deletion-panel-overlay">
            <div className="deletion-panel">
                <div className="deletion-header">
                    <h2>Delete Data</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="deletion-body">
                    <div className="form-group">
                        <label>Data Type</label>
                        <div className="radio-group">
                            <label>
                                <input
                                    type="radio"
                                    value="traces"
                                    checked={dataType === 'traces'}
                                    onChange={(e) => setDataType(e.target.value as 'traces')}
                                />
                                Traces
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    value="logs"
                                    checked={dataType === 'logs'}
                                    onChange={(e) => setDataType(e.target.value as 'logs')}
                                />
                                Logs
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Start Date & Time</label>
                        <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="date-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>End Date & Time</label>
                        <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="date-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>Quick Presets</label>
                        <div className="preset-buttons">
                            <button onClick={() => {
                                const now = new Date();
                                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                                setStartDate(yesterday.toISOString().slice(0, 16));
                                setEndDate(now.toISOString().slice(0, 16));
                            }}>Last 24 Hours</button>
                            <button onClick={() => {
                                const now = new Date();
                                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                setStartDate(weekAgo.toISOString().slice(0, 16));
                                setEndDate(now.toISOString().slice(0, 16));
                            }}>Last 7 Days</button>
                            <button onClick={() => {
                                const now = new Date();
                                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                                setStartDate(monthAgo.toISOString().slice(0, 16));
                                setEndDate(now.toISOString().slice(0, 16));
                            }}>Last 30 Days</button>
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    {showConfirm && (
                        <div className="confirm-box">
                            <p className="warning-text">
                                WARNING: You are about to delete <strong>{previewCount}</strong> {dataType}
                            </p>
                            <p>This action cannot be undone!</p>
                            <div className="confirm-actions">
                                <button
                                    className="btn-danger"
                                    onClick={handleDelete}
                                    disabled={loading}
                                >
                                    {loading ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowConfirm(false)}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {!showConfirm && (
                        <div className="action-buttons">
                            <button
                                className="btn-primary"
                                onClick={handlePreview}
                                disabled={loading || !startDate || !endDate}
                            >
                                {loading ? 'Loading...' : 'Preview Deletion'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
