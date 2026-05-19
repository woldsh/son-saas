'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import HandoverReceiptForm from '@/components/HandoverReceiptForm';

interface TransferOrder {
    recipientName: string;
    itemReceiverName: string;
    overseerName: string;
    recipientRole: string;
    items?: any[];
    status?: string;
    completedAt?: any;
    receiverAcknowledged?: boolean;
    receiverAcknowledgedAt?: any;
    receiverSignatureData?: string;
    delivererSignatureData?: string;
}

export default function HandoverReceiptPage() {
    const params = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<TransferOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!params?.id) return;
            try {
                const docRef = doc(db, 'Transfer_Orders', params.id as string);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setOrder(docSnap.data() as TransferOrder);
                }
            } catch (error) {
                console.error("Error fetching order:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [params?.id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800">Receipt Not Found</h2>
                    <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col items-center print:bg-white print:py-0 print:px-0">
            {/* Action Bar */}
            <div className="w-full max-w-[210mm] flex items-center justify-between mb-6 print:hidden">
                <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
                >
                    <Printer className="w-5 h-5" />
                    Print Receipt
                </button>
            </div>

            {/* A4 Paper Form */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden print:shadow-none print:rounded-none">
                <HandoverReceiptForm
                    recipientName={order.recipientName}
                    itemReceiverName={order.itemReceiverName}
                    overseerName={order.overseerName}
                    recipientRole={order.recipientRole}
                    items={order.items || []}
                    delivererSigned={order.status === 'completed' || order.status === 'pending_receipt' || order.completedAt != null}
                    delivererSignatureDate={order.completedAt}
                    delivererSignatureData={order.delivererSignatureData}
                    receiverSigned={!!order.receiverAcknowledged}
                    receiverSignatureDate={order.receiverAcknowledgedAt}
                    receiverSignatureData={order.receiverSignatureData}
                />
            </div>
        </div>
    );
}
