'use client';

import RegisterUser from '@/components/RegisterUser';

export default function EnrollPersonnelPage() {
    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="p-6 md:p-8">
                    <RegisterUser />
                </div>
            </div>
        </div>
    );
}
