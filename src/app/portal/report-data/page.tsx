'use client';

import ClerkWorkReport from '@/components/ClerkWorkReport';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ReportDataPage() {
    const { user } = useAuth();
    const [stockType, setStockType] = useState<'fixed' | 'consumable' | 'all'>('all');
    const [roleType, setRoleType] = useState<'clerk' | 'keeper' | 'team_leader'>('team_leader');

    useEffect(() => {
        const fetchUserType = async () => {
            if (!user?.uid || !db) return;
            try {
                const userDoc = await getDoc(doc(db!, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const role = data.userRole || '';

                    // Managing Director sees ALL data
                    if (role.includes('managing_director')) {
                        setStockType('all');
                        setRoleType('team_leader');
                    } else {
                        setStockType('all');
                        setRoleType('team_leader');
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
