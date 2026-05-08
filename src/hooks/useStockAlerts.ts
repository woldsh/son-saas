import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

export function useStockAlerts() {
    const [counts, setCounts] = useState({
        lowStock: 0,
        expireStock: 0,
        outOfStock: 0,
        total: 0
    });

    useEffect(() => {
        if (!db) return;

        const materialsRef = collection(db, 'materials');
        const q = query(materialsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(now.getDate() + 30);

            // Step 1: Aggregate quantities and expiry dates by material name
            const materialMap = new Map<string, { totalQty: number; earliestExpiry?: string }>();

            snapshot.forEach((doc) => {
                const data = doc.data();

                const addToMap = (name: string, qty: number, expiryStr?: string) => {
                    const key = name.trim().toLowerCase();
                    if (!key) return;
                    const existing = materialMap.get(key) || { totalQty: 0 };
                    existing.totalQty += qty;
                    // Track the earliest expiry date
                    if (expiryStr) {
                        if (!existing.earliestExpiry || expiryStr < existing.earliestExpiry) {
                            existing.earliestExpiry = expiryStr;
                        }
                    }
                    materialMap.set(key, existing);
                };

                if (data.items && Array.isArray(data.items) && (data.formType === 'receipt_for_articles' || (data.items.length > 0 && !data.materialName))) {
                    data.items.forEach((item: any) => {
                        if (item.description && typeof item.description === 'string' && item.description.trim()) {
                            addToMap(item.description, Number(item.quantity) || 0, item.expiryDate || data.expiryDate);
                        }
                    });
                } else if (data.materialName) {
                    addToMap(data.materialName, Number(data.quantity) || 0, data.expiryDate);
                }
            });

            // Step 2: Count alerts based on aggregated totals
            let low = 0;
            let expire = 0;
            let out = 0;

            materialMap.forEach((info) => {
                if (info.totalQty === 0) {
                    out += 1;
                } else if (info.totalQty > 0 && info.totalQty <= 10) {
                    low += 1;
                }
                if (info.earliestExpiry) {
                    const exp = new Date(info.earliestExpiry);
                    if (exp <= thirtyDaysFromNow) {
                        expire += 1;
                    }
                }
            });

            setCounts({
                lowStock: low,
                expireStock: expire,
                outOfStock: out,
                total: low + expire + out
            });
        });

        return () => unsubscribe();
    }, []);

    return counts;
}
