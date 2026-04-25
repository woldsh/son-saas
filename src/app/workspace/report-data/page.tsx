'use client';

import ClerkWorkReport from '@/components/ClerkWorkReport';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ReportDataPage() {
    const { user } = useAuth();
    const [stockType, setStockType] = useState<'fixed' | 'consumable' | 'all'>('all');
    const [roleType, setRoleType] = useState<'clerk' | 'keeper' | 'team_leader'>('clerk');

    useEffect(() => {
        const fetchUserType = async () => {
            if (!user?.uid || !db) return;
            try {
                const userDoc = await getDoc(doc(db!, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const role = data.userRole || '';

                    // Team Leader sees ALL data
                    if (role.includes('procurement_team_leader') || role === 'team_leader') {
                        setStockType('all');
                        setRoleType('team_leader');
                    } else if (role.includes('store_keeper')) {
                        setRoleType('keeper');
                        if (role.includes('fixed_asset')) setStockType('fixed');
                        else if (role.includes('consumable')) setStockType('consumable');
                    } else {
                        setRoleType('clerk');
                        if (role.includes('fixed_asset')) setStockType('fixed');
                        else if (role.includes('consumable')) setStockType('consumable');
                    }
                }
            } catch (e) {
                console.error('Error fetching user role:', e);
            }
        };
        fetchUserType();
    }, [user?.uid]);

    return <ClerkWorkReport stockType={stockType} roleType={roleType} />;
}
