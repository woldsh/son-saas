'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { FiFileText } from 'react-icons/fi';
import { motion } from 'framer-motion';
import MaterialTransferReport from '@/components/MaterialTransferReport';

export default function MaterialTransferReportPage() {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md">
                            <FiFileText className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                {t('material_transfer_report') || "Material Transfer Report"}
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">
                                View all finalized and completed material transfer records.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Report Component */}
                <MaterialTransferReport />
            </div>
        </div>
    );
}
