'use client';

import AdminTeamLeaderSidebar from '@/components/AdminTeamLeaderSidebar';
import { SidebarProvider } from '@/contexts/SidebarContext';
import MyRequisitionHistory from '@/components/MyRequisitionHistory';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

export default function TeamLeaderViewRequestsPage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <MyRequisitionHistory />
        </div>
    );
}
