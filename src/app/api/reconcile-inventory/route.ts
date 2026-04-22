import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, updateDoc } from 'firebase/firestore';

export async function GET() {
    try {
        if (!db) {
            return NextResponse.json({ error: 'Database not available' }, { status: 500 });
        }

        // Step 1: Get ALL accepted User-Report documents (these are materials that were issued)
        const userReportQuery = query(
            collection(db, 'User-Report'),
            where('status', '==', 'accepted')
        );
        const userReportSnap = await getDocs(userReportQuery);

        // Step 2: Group total issued quantities by materialName
        const issuedMap: Record<string, { totalIssued: number; materialCode?: string }> = {};

        userReportSnap.docs.forEach(doc => {
            const data = doc.data();
            const name = data.materialName?.trim();
            const code = data.materialCode?.trim();
            const qty = Number(data.quantity) || 0;

            if (!name) return;

            const key = name.toLowerCase();
            if (!issuedMap[key]) {
                issuedMap[key] = { totalIssued: 0, materialCode: code };
            }
            issuedMap[key].totalIssued += qty;
        });

        // Step 3: Get ALL materials from inventory
        const materialsSnap = await getDocs(collection(db, 'materials'));

        const updates: { name: string; oldQty: number; issued: number; newQty: number }[] = [];

        // Step 4: For each material, check if quantity needs adjustment
        for (const materialDoc of materialsSnap.docs) {
            const data = materialDoc.data();
            
            // Skip batch/items-based documents
            if (data.items && Array.isArray(data.items)) continue;

            const materialName = data.materialName?.trim();
            if (!materialName) continue;

            const key = materialName.toLowerCase();
            const issued = issuedMap[key];

            if (issued && issued.totalIssued > 0) {
                // Get the ORIGINAL registered quantity (we stored it as 'quantity')
                const currentQty = Number(data.quantity) || 0;
                
                // Check if this material's quantity was already adjusted
                // by checking if originalQuantity field exists
                const originalQty = Number(data.originalQuantity) || currentQty;
                
                // Calculate what the quantity SHOULD be
                const correctQty = Math.max(0, originalQty - issued.totalIssued);

                if (currentQty !== correctQty) {
                    // Save the original quantity for reference, and set the correct current quantity
                    await updateDoc(materialDoc.ref, { 
                        quantity: correctQty,
                        originalQuantity: originalQty  // Save original for future reference
                    });

                    updates.push({
                        name: materialName,
                        oldQty: currentQty,
                        issued: issued.totalIssued,
                        newQty: correctQty
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Reconciled ${updates.length} materials`,
            totalAcceptedReports: userReportSnap.docs.length,
            updates
        });

    } catch (error: any) {
        console.error('Reconciliation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
