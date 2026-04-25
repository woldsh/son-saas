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
            let low = 0;
            let expire = 0;
            let out = 0;

            const now = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(now.getDate() + 30);

            snapshot.forEach((doc) => {
                const data = doc.data();

                const processItem = (qty: number, expiryStr?: string) => {
                    // Out of stock
                    if (qty === 0) {
                        out += 1;
                    } else if (qty > 0 && qty <= 10) {
                        // Low stock
                        low += 1;
                    }

                    // Expire stock
                    if (expiryStr) {
                        const exp = new Date(expiryStr);
                        if (exp <= thirtyDaysFromNow) {
                            expire += 1;
                        }
                    }
                };

                if (data.items && Array.isArray(data.items) && (data.formType === 'receipt_for_articles' || (data.items.length > 0 && !data.materialName))) {
                    // Model 19 structure
                    data.items.forEach((item: any) => {
                        if (item.description && typeof item.description === 'string' && item.description.trim()) {
                            processItem(Number(item.quantity) || 0, item.expiryDate || data.expiryDate);
                        }
                    });
                } else if (data.materialName) {
                    // Standard structure
                    processItem(Number(data.quantity) || 0, data.expiryDate);
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
