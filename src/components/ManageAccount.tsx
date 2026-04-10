'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
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
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            {/* Simple Heading Area */}
            <div className="px-2 pb-2 border-b border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('manage_account')}</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">{t('personal_security_settings')}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">
                    <FiShield className="text-xs" /> {userRole?.replace('_', ' ') || 'Staff Access'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Profile Overview Card */}
                <div className="lg:col-span-4">
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 flex flex-col items-center text-center sticky top-24"
                    >
                        <div className="relative mb-6">
                            <div className="w-28 h-28 rounded-[2.5rem] bg-indigo-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden ring-1 ring-slate-100">
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl font-black text-indigo-500">{user?.email?.[0]?.toUpperCase()}</span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowProfileModal(true)}
                                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-lg hover:shadow-indigo-500/20 hover:text-indigo-600 transition-all active:scale-90"
                                title={t('edit_profile') || "Edit Profile"}
                            >
                                <FiEdit3 size={16} />
                            </button>
                        </div>

                        <div className="space-y-4 w-full">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">{user?.displayName || 'User'}</h3>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{department || 'Department'}</p>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-50">
                                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">{userRole ? t(userRole.toLowerCase() as any) : 'Staff'}</span>
                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">{t('active_status') || 'Active'}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Main Settings Area */}
                <div className="lg:col-span-8 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 md:p-8"
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                                <FiLock />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">{t('security_label') || "Security & Access"}</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Account Email Row */}
                            <div className="group p-5 rounded-3xl bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                                            <FiMail size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">{t('email_address_label')}</h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-xs text-slate-500">{user?.email}</p>
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest border border-emerald-100">
                                                    <FiCheckCircle size={10} /> {t('verified')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowEmailModal(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-500 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 transition-all"
                                    >
                                        {t('change_email')} <FiArrowRight className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>

                            {/* Password Security Row */}
                            <div className="group p-5 rounded-3xl bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                                            <FiShield size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">{t('password')}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">{t('last_changed_know') || "Updated security credentials"}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowPasswordModal(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-500 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-amber-600 transition-all"
                                    >
                                        {t('update_password')} <FiArrowRight className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
            <EditProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
            <UpdateEmailModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />
        </div>
    );
}
