'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    onSnapshot,
    where,
    Unsubscribe
} from 'firebase/firestore';

export function useRequestNotification(userRole: string | null | undefined, department: string | null | undefined) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!db || !userRole) return;

        let unsubscribe: Unsubscribe | undefined;
        const requestsRef = collection(db, 'Request_materials');
        let q;

        const effectiveRole = userRole.toLowerCase().replace(/\s+/g, '_');

        if (effectiveRole.endsWith('_head')) {
            let dept = department;
            if (!dept) {
                dept = userRole.replace('_head', '');
            }
            if (dept) {
                q = query(
                    requestsRef,
                    where('department', '==', dept),
                    where('currentApproverRole', '==', 'department_head'),
                    where('status', 'in', ['pending', 'pending_department_leader'])
                );
            }
        }
        else if (effectiveRole === 'academic_coordinator') {
            q = query(
                requestsRef,
                where('currentApproverRole', '==', 'academic_coordinator'),
                where('status', '==', 'approved_by_head')
            );
        }
        else if (effectiveRole === 'managing_director' || effectiveRole === 'managing_director_leader' || effectiveRole === 'chief') {
            q = query(
                requestsRef,
                where('status', 'in', ['approved_by_coordinator', 'pending_managing_director', 'approved_by_student_service_leader'])
            );
        }
        else if (effectiveRole === 'procurement_team_leader' || effectiveRole === 'team_leader') {
            q = query(
                requestsRef,
                where('status', 'in', ['forwarded_to_team_leader', 'pending_procurement'])
            );
        }
        else if (effectiveRole.includes('stock_clerk')) {
            q = query(
                requestsRef,
                where('currentApproverRole', '==', userRole),
                where('status', '==', 'approved_by_procurement_team_leader')
            );
        }
        else if (effectiveRole.includes('store_keeper')) {
            // Store Keepers see count of items waiting for employee verification
            const sendToUsersRef = collection(db, 'Send_to_Users');
            q = query(
                sendToUsersRef,
                where('status', 'in', ['ready_for_pickup', 'code_sent', 'shared_with_store'])
            );
        }
        else if (effectiveRole === 'student_service_dormitory_leader' || effectiveRole === 'dormitory_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_dormitory_leader'), where('status', '==', 'pending_department_leader'));
        }
        else if (effectiveRole === 'student_service_cafeteria_leader' || effectiveRole === 'cafeteria_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_cafeteria_leader'), where('status', '==', 'pending_department_leader'));
        }
        else if (effectiveRole === 'student_service_sport_leader' || effectiveRole === 'sports_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_sport_leader'), where('status', '==', 'pending_department_leader'));
        }
        else if (effectiveRole === 'hrm_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'hrm_leader'), where('status', '==', 'pending_department_leader'));
        }
        else if (effectiveRole === 'finance_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'finance_leader'), where('status', '==', 'pending_department_leader'));
        }
        else if (effectiveRole === 'student_service_leader') {
            q = query(requestsRef, where('status', '==', 'pending_student_service_leader'));
        }
        // Dynamic leaders (e.g. quality_assurance_leader, building_renovation_leader, etc.)
        else if (effectiveRole.endsWith('_leader')) {
            q = query(requestsRef, where('currentApproverRole', '==', userRole), where('status', '==', 'pending_department_leader'));
        }

        if (q) {
            unsubscribe = onSnapshot(q, (snapshot) => {
                if (effectiveRole.includes('store_keeper')) {
                    // Filter in memory for store keepers by store type
                    const storeType = effectiveRole.includes('consumable') ? 'consumable' : 'fixed_asset';
                    const normalizedStoreType = storeType.replace(/[^a-z]/g, '');
                    
                    let validCount = 0;
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const matchesType = data.material_details?.some((m: any) => {
                            const itemType = (m.materialType || '').toLowerCase().replace(/[^a-z]/g, '');
                            return itemType.includes(normalizedStoreType) || normalizedStoreType.includes(itemType);
                        });
                        
                        // Don't count handout_completed explicitly just in case query missed it
                        if (matchesType && data.status !== 'handout_completed') {
                            validCount++;
                        }
                    });
                    setCount(validCount);
                } else {
                    setCount(snapshot.size);
                }
            }, (error) => {
                console.error("Error fetching notification count:", error);
            });
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [userRole, department]);

    return count;
}
