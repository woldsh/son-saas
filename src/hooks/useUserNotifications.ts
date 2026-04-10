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
import { useAuth } from '../contexts/AuthContext';

export function useUserNotifications() {
    const { user } = useAuth();
    const [feedbackCount, setFeedbackCount] = useState(0);
    const [transferCount, setTransferCount] = useState(0);
    const [handoutCount, setHandoutCount] = useState(0);

    useEffect(() => {
        if (!db || !user?.uid) return;

        let feedbackUnsubscribe: Unsubscribe | undefined;
        let transferUnsubscribe: Unsubscribe | undefined;
        let handoutUnsubscribe: Unsubscribe | undefined;

        // 1. Feedback Notifications
        const feedbackQuery = query(
            collection(db, 'Request_materials'),
            where('requesterId', '==', user.uid),
            where('isFeedbackSeen', '==', false)
        );

        feedbackUnsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
            setFeedbackCount(snapshot.size);
        }, (error) => {
            console.error("Error fetching feedback notification count:", error);
        });

        // 2. Transfer Notifications
        if (user.email) {
            const transferQuery = query(
                collection(db, 'Material_transfers'),
                where('receiverEmail', '==', user.email.toLowerCase()),
                where('status', '==', 'pending_receiver')
            );
            
            transferUnsubscribe = onSnapshot(transferQuery, (snapshot) => {
                setTransferCount(snapshot.size);
            }, (error) => {
                console.error("Error fetching transfer notification count:", error);
            });
        }

        // 3. Handout Notifications (Verification Codes)
        const handoutQuery = query(
            collection(db, 'Send_to_Users'),
            where('requester_user_id', '==', user.uid)
        );

        handoutUnsubscribe = onSnapshot(handoutQuery, (snapshot) => {
            const unseenCount = snapshot.docs.filter(doc => doc.data().isSeen !== true).length;
            setHandoutCount(unseenCount);
        }, (error) => {
            console.error("Error fetching handout notification count:", error);
        });

        return () => {
            if (feedbackUnsubscribe) feedbackUnsubscribe();
            if (transferUnsubscribe) transferUnsubscribe();
            if (handoutUnsubscribe) handoutUnsubscribe();
        };
    }, [user?.uid, user?.email]);

    return {
        feedbackCount,
        transferCount,
        handoutCount,
        totalCount: feedbackCount + transferCount + handoutCount
    };
}
