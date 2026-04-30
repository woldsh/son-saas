'use client';

import ManageAccount from '@/components/ManageAccount';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminManageAccountPage() {
    const { t } = useLanguage();
    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('admin_account_header')}</h1>
                <p className="text-gray-500 mt-1">{t('admin_account_desc')}</p>
            </div>

            <ManageAccount />
        </div>
    );
}
