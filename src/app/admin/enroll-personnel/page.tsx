'use client';

import RegisterUser from '@/components/RegisterUser';

export default function EnrollPersonnelPage() {
    return (
        <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-1.5">
            <div className="flex items-baseline gap-2">
                <h1 className="text-sm font-bold text-gray-900">Enroll Personnel</h1>
                <span className="text-[11px] text-gray-400">— Register new institutional staff accounts.</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-2 md:p-3">
                    <RegisterUser />
                </div>
            </div>
        </div>
    );
}
