'use client';

export default function TeamLeaderExchangeReportPlaceholderPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Exchange Report</h1>
                <p className="text-slate-500 mt-2">This feature is currently under development for Team Leaders.</p>
                <div className="mt-6">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 w-2/3 rounded-full animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
