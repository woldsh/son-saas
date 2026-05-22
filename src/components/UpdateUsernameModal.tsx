'use client';
import { updateDocWithAudit } from '@/utils/auditTrail';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { doc, getDoc} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FiX, FiUser, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

interface UpdateUsernameModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function UpdateUsernameModal({ isOpen, onClose }: UpdateUsernameModalProps) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [currentUsername, setCurrentUsername] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    // Fetch current username on open
    useEffect(() => {
        if (isOpen && user && db) {
            const firestore = db;
            const fetchUsername = async () => {
                try {
                    const userDoc = await getDoc(doc(firestore, 'users', user.uid));
                    if (userDoc.exists()) {
                        setCurrentUsername(userDoc.data()?.username || '');
                    }
                } catch (err) {
                    console.error('Failed to fetch username:', err);
                }
            };
            fetchUsername();
        }
    }, [isOpen, user]);

    // Check username availability with debounce
    useEffect(() => {
        if (!newUsername || newUsername.toLowerCase().trim() === currentUsername) {
            setIsAvailable(null);
            return;
        }

        const timer = setTimeout(async () => {
            setChecking(true);
            try {
                const res = await fetch('/api/auth/lookup-username', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: newUsername.toLowerCase().trim() })
                });
                const data = await res.json();
                // If lookup succeeds, the username is taken
                setIsAvailable(!data.success);
            } catch {
                setIsAvailable(null);
            } finally {
                setChecking(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [newUsername, currentUsername]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const cleanUsername = newUsername.toLowerCase().trim().replace(/\s+/g, '');

        if (!cleanUsername) {
            setError('Username cannot be empty.');
            return;
        }

        if (cleanUsername.length < 3) {
            setError('Username must be at least 3 characters.');
            return;
        }

        if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
            setError('Username can only contain lowercase letters, numbers, and underscores.');
            return;
        }

        if (cleanUsername === currentUsername) {
            setError('This is already your current username.');
            return;
        }

        if (isAvailable === false) {
            setError('This username is already taken.');
            return;
        }

        setLoading(true);

        try {
            // Double-check availability on server
            const checkRes = await fetch('/api/auth/lookup-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: cleanUsername })
            });
            const checkData = await checkRes.json();

            if (checkData.success) {
                throw new Error('Username is already taken.');
            }

            // Update in Firestore
            if (!db || !user) throw new Error('Not authenticated');
            const firestore = db;
            await updateDocWithAudit(doc(firestore, 'users', user.uid), {
                username: cleanUsername,
            });

            setCurrentUsername(cleanUsername);
            setSuccess('Username updated successfully!');
            setNewUsername('');
            setIsAvailable(null);

            setTimeout(() => {
                setSuccess('');
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to update username.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                            <FiUser className="text-blue-600" size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Update Username</h3>
                            <p className="text-xs text-gray-400">Change your login username</p>
                        </div>
                    </div>
                    <button onClick={() => { onClose(); setError(''); setSuccess(''); setNewUsername(''); setIsAvailable(null); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <FiX size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <FiAlertCircle className="text-red-500 flex-shrink-0" size={16} />
                            <p className="text-xs font-medium text-red-700">{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                            <FiCheckCircle className="text-emerald-500 flex-shrink-0" size={16} />
                            <p className="text-xs font-medium text-emerald-700">{success}</p>
                        </div>
                    )}

                    {/* Current Username */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Username</label>
                        <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                            {currentUsername || <span className="text-gray-400 italic">Not set</span>}
                        </div>
                    </div>

                    {/* New Username */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">New Username</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                                placeholder="new_username"
                                className={`w-full px-4 py-2.5 border rounded-lg text-sm font-mono outline-none transition-colors ${
                                    isAvailable === true ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-200' :
                                    isAvailable === false ? 'border-red-400 focus:ring-2 focus:ring-red-200' :
                                    'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
                                }`}
                            />
                            {/* Availability indicator */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {checking && (
                                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                )}
                                {!checking && isAvailable === true && (
                                    <FiCheckCircle className="text-emerald-500" size={16} />
                                )}
                                {!checking && isAvailable === false && (
                                    <FiAlertCircle className="text-red-500" size={16} />
                                )}
                            </div>
                        </div>
                        {/* Availability text */}
                        {!checking && isAvailable === true && newUsername && (
                            <p className="text-[11px] text-emerald-600 mt-1 font-medium">✓ Username is available</p>
                        )}
                        {!checking && isAvailable === false && newUsername && (
                            <p className="text-[11px] text-red-600 mt-1 font-medium">✕ Username is already taken</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">Only lowercase letters, numbers, and underscores. Min 3 characters.</p>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => { onClose(); setError(''); setSuccess(''); setNewUsername(''); setIsAvailable(null); }}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !newUsername || isAvailable === false || checking}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Updating...' : 'Update Username'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
