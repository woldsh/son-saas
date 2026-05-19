'use client';

import { useState, useRef } from 'react';
import { FiRefreshCw, FiCheck } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';

interface InlineSignaturePadProps {
    onConfirm: (signatureData: string) => Promise<void>;
    buttonText?: string;
}

export default function InlineSignaturePad({ onConfirm, buttonText = "Confirm & Sign" }: InlineSignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (!signatureData) return;
        setIsSubmitting(true);
        try {
            await onConfirm(signatureData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-50 p-6 border-t border-slate-200 print:hidden">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="font-bold text-slate-800">Please Sign Below</h3>
                        <p className="text-xs text-slate-500">Draw your signature to officially acknowledge this document.</p>
                    </div>
                    <button
                        onClick={clearSignature}
                        className="text-xs flex items-center gap-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors font-semibold"
                    >
                        <FiRefreshCw /> Clear
                    </button>
                </div>
                
                <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden w-full relative group bg-white shadow-sm mb-4">
                    <canvas
                        ref={canvasRef}
                        width={600}
                        height={150}
                        className="w-full h-[150px] cursor-crosshair touch-none"
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
                            <span className="text-2xl font-['Brush_Script_MT'] text-slate-400">Draw Signature Here...</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleConfirm}
                        disabled={!signatureData || isSubmitting}
                        className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-sm active:scale-95"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FiCheck className="w-5 h-5" />}
                        {buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
}
