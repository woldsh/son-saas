'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FiX, FiRefreshCw, FiCheck } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import HandoverReceiptForm from './HandoverReceiptForm';

interface HandoverReceiptSigningModalProps {
    order: any;
    role?: 'receiver' | 'deliverer';
    onClose: () => void;
    onSigned: () => void;
}

export default function HandoverReceiptSigningModal({ order, role = 'receiver', onClose, onSigned }: HandoverReceiptSigningModalProps) {
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Signature canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);

    useEffect(() => { setMounted(true); }, []);

    // Canvas drawing handlers
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.beginPath();
            setSignatureData(canvasRef.current.toDataURL('image/png'));
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = (e as React.MouseEvent).clientX - rect.left;
            y = (e as React.MouseEvent).clientY - rect.top;
        }

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearSignature = () => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            setSignatureData(null);
        }
    };

    const handleConfirm = async () => {
        if (!signatureData || !db) return;
        setIsSubmitting(true);

        try {
            const docRef = doc(db, 'Transfer_Orders', order.id);
            if (role === 'receiver') {
                await updateDoc(docRef, {
                    receiverAcknowledged: true,
                    receiverAcknowledgedAt: serverTimestamp(),
                    receiverSignatureData: signatureData
                });
            } else {
                await updateDoc(docRef, {
                    status: 'completed',
                    completedAt: serverTimestamp(),
                    delivererSignatureData: signatureData
                });
            }
            onSigned();
        } catch (error) {
            console.error('Error saving signature:', error);
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {role === 'receiver' ? 'Sign Property Handover Receipt' : 'Sign & Approve Transfer'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {role === 'receiver' ? 'Please review the form and sign below to confirm receipt.' : 'Please sign below to officially approve and complete this handover.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <FiX className="text-2xl" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                    {/* A4 Paper Preview */}
                    <div className="flex justify-center mb-8">
                        <div className="shadow-sm border border-slate-200 rounded-lg overflow-hidden">
                            <HandoverReceiptForm
                                recipientName={order.recipientName}
                                itemReceiverName={order.itemReceiverName}
                                overseerName={order.overseerName}
                                recipientRole={order.recipientRole}
                                items={order.items || []}
                            />
                        </div>
                    </div>

                    {/* Signature Area */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800">Draw Your Signature</h3>
                            <button
                                onClick={clearSignature}
                                className="text-xs flex items-center gap-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors font-semibold"
                            >
                                <FiRefreshCw /> Clear
                            </button>
                        </div>
                        <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 w-full relative group">
                            <canvas
                                ref={canvasRef}
                                width={600}
                                height={200}
                                className="w-full h-[200px] cursor-crosshair touch-none bg-white"
                                onMouseDown={startDrawing}
                                onMouseUp={stopDrawing}
                                onMouseOut={stopDrawing}
                                onMouseMove={draw}
                                onTouchStart={startDrawing}
                                onTouchEnd={stopDrawing}
                                onTouchMove={draw}
                            />
                            {!signatureData && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                                    <span className="text-2xl font-['Brush_Script_MT'] text-slate-400">Sign Here...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!signatureData || isSubmitting}
                        className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-sm active:scale-95"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FiCheck className="w-5 h-5" />}
                        Confirm & Sign Receipt
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
