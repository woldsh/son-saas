'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { countAcademicCoordinatorMdFeedback } from '@/lib/requestFeedbackUtils';

/**
 * My assets: User-Report rows for this user with status "accepted" (in custody).
 * Total feedback: count of Academic Coordinator / Managing Director history entries on your
 * material requests (rejections + quantity adjustments), across requesterId and requester_id.
 */
export function useUserAssetsAndFeedback() {
  const { user } = useAuth();
  const [assetCount, setAssetCount] = useState(0);
  const [feedbackTotal, setFeedbackTotal] = useState(0);

  const requestsByRequesterId = useRef(new Map<string, Record<string, unknown>>());
  const requestsByRequesterLegacy = useRef(new Map<string, Record<string, unknown>>());

  useEffect(() => {
    if (!db || !user?.uid) {
      setAssetCount(0);
      setFeedbackTotal(0);
      requestsByRequesterId.current = new Map();
      requestsByRequesterLegacy.current = new Map();
      return;
    }

    const uid = user.uid;

    const recomputeFeedbackTotal = () => {
      const merged = new Map<string, Record<string, unknown>>([
        ...requestsByRequesterId.current,
        ...requestsByRequesterLegacy.current,
      ]);
      let total = 0;
      for (const req of merged.values()) {
        total += countAcademicCoordinatorMdFeedback(req);
      }
      setFeedbackTotal(total);
    };

    const qReports = query(collection(db, 'User-Report'), where('requesterId', '==', uid));
    const unsubReports = onSnapshot(
      qReports,
      (snap) => {
        const n = snap.docs.filter((d) => d.data().status === 'accepted').length;
        setAssetCount(n);
      },
      (err) => console.error('User-Report (dashboard assets):', err)
    );

    const qReqId = query(collection(db, 'Request_materials'), where('requesterId', '==', uid));
    const unsubReqId = onSnapshot(
      qReqId,
      (snap) => {
        requestsByRequesterId.current = new Map(
          snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }])
        );
        recomputeFeedbackTotal();
      },
      (err) => console.error('Request_materials (requesterId dashboard):', err)
    );

    const qReqLegacy = query(collection(db, 'Request_materials'), where('requester_id', '==', uid));
    const unsubReqLegacy = onSnapshot(
      qReqLegacy,
      (snap) => {
        requestsByRequesterLegacy.current = new Map(
          snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }])
        );
        recomputeFeedbackTotal();
      },
      (err) => console.error('Request_materials (requester_id dashboard):', err)
    );

    return () => {
      unsubReports();
      unsubReqId();
      unsubReqLegacy();
    };
  }, [user?.uid]);

  return { assetCount, feedbackTotal };
}
