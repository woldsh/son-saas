'use client';

import AdminTeamLeaderSidebar from '@/components/AdminTeamLeaderSidebar';
import { SidebarProvider } from '@/contexts/SidebarContext';
import RequestJourneyView from '@/components/RequestJourneyView';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

export default function TeamLeaderRequestJourneyPage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <RequestJourneyView />
        </div>
    );
}
