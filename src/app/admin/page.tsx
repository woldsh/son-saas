'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  FiUsers,
  FiCheckCircle,
  FiXCircle,
  FiBookOpen,
  FiUserCheck
} from 'react-icons/fi';
import { Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [userStats, setUserStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    academic: 0,
    admin: 0,
    procurement: 0,
    executive: 0
  });

  useEffect(() => {
    if (!db) return;
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const total = snapshot.size;
      const inactive = docs.filter(d => d.status === 'inactive').length;
      const active = total - inactive;
      const academic = docs.filter(d => d.mainRole === 'academic_staff').length;
      const admin = docs.filter(d => d.mainRole === 'admin_staff').length;
      const procurement = docs.filter(d => d.mainRole === 'procurement_management').length;
      const executive = docs.filter(d => d.mainRole === 'managing_director' || d.mainRole === 'chief').length;

      setUserStats({ total, active, inactive, academic, admin, procurement, executive });
    }, (error) => {
      console.error('Error listening to user stats:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) return null;

  const stats = [
    { label: t('total_registered'), value: userStats.total.toString(), icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Executive', value: userStats.executive.toString(), icon: FiUsers, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: t('academic_staff'), value: userStats.academic.toString(), icon: FiBookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: t('admin_staff'), value: userStats.admin.toString(), icon: FiUserCheck, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Procurement', value: userStats.procurement.toString(), icon: FiUsers, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: t('active_personnel'), value: userStats.active.toString(), icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: t('deactivated_employee'), value: userStats.inactive.toString(), icon: FiXCircle, color: 'text-red-600', bg: 'bg-red-50' }
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('systems_header')} {t('overview_header')}</h1>
        <p className="text-gray-500 mt-1">{t('admin_overview_desc')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className="text-xl" />
            </div>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
