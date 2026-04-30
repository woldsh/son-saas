'use client';

import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { FiX, FiUser, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleClose = () => {
        setError('');
        setSuccess(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!displayName.trim()) {
            setError('Display name cannot be empty.');
            return;
        }

        setLoading(true);
        try {
            if (auth?.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: displayName
                });

                if (db) {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    try {
                        await updateDoc(userRef, { displayName });
                    } catch (e) {
                        console.log('User document might not exist', e);
                    }

                    const adminRef = doc(db, 'admins', auth.currentUser.uid);
                    try {
                        await updateDoc(adminRef, { name: displayName, displayName });
                    } catch (e) {
                        // Ignore
                    }
                }

                setSuccess(true);
                setTimeout(() => {
                    handleClose();
                    window.location.reload();
                }, 1500);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <FiUser className="text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">{t('edit_profile_header')}</h3>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {success && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium">
                            <FiCheck /> {t('profile_updated_success')}
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
                            <FiAlertCircle /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('full_name_label')}</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={t('enter_full_name')}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                            disabled={loading || success}
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || success}
                            className="flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? t('saving_btn') : t('save_changes_btn')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
