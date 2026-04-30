'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { FiUser, FiShield, FiMail, FiLock, FiCheckCircle, FiEdit3, FiArrowRight } from 'react-icons/fi';
import ChangePasswordModal from './ChangePasswordModal';
import EditProfileModal from './EditProfileModal';
import UpdateEmailModal from './UpdateEmailModal';

export default function ManageAccount() {
    const { t } = useLanguage();
    const { user, userRole, department } = useAuth();
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Overview Card */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center text-center">
                        <div className="relative mb-5">
                            <div className="w-24 h-24 rounded-full bg-blue-50 border-4 border-white shadow-sm flex items-center justify-center overflow-hidden ring-1 ring-gray-100">
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl font-semibold text-blue-600">{user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}</span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowProfileModal(true)}
                                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:border-blue-500 hover:text-blue-600 transition-colors"
                                title={t('edit_profile') || "Edit Profile"}
                            >
                                <FiEdit3 size={14} />
                            </button>
                        </div>

                        <div className="space-y-3 w-full">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{user?.displayName || 'User'}</h3>
                                <p className="text-sm text-gray-500 mt-1 capitalize">{department?.replace(/_/g, ' ') || 'No Department'}</p>
                            </div>
                            
                            <div className="pt-4 border-t border-gray-100 flex flex-wrap justify-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100/50 capitalize">
                                    {userRole ? t(userRole.toLowerCase() as any)?.replace(/_/g, ' ') : 'Staff'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100/50">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    {t('active_status') || 'Active'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Settings Area */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500">
                                <FiLock size={16} />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">{t('security_label') || "Security & Access"}</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Full Name Row */}
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                                        <FiUser size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">{t('full_name_label')}</h4>
                                        <p className="text-sm text-gray-500 mt-1">{user?.displayName || 'Not set'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowProfileModal(true)}
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
                                >
                                    {t('edit_profile') || 'Change Name'}
                                </button>
                            </div>

                            {/* Account Email Row */}
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                                        <FiMail size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">{t('email_address_label')}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-sm text-gray-500">{user?.email}</p>
                                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                                <FiCheckCircle size={12} /> {t('verified')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowEmailModal(true)}
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
                                >
                                    {t('change_email')}
                                </button>
                            </div>

                            {/* Password Security Row */}
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                                        <FiShield size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">{t('password')}</h4>
                                        <p className="text-sm text-gray-500 mt-1">{t('last_changed_know') || "Update your security credentials"}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPasswordModal(true)}
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
                                >
                                    {t('update_password')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
            <EditProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
            <UpdateEmailModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />
        </div>
    );
}
