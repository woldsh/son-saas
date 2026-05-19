'use client';

import React, { useRef, useState } from 'react';

interface Props {
    recipientName: string;
    itemReceiverName: string;
    overseerName: string;
    recipientRole: string;
    items?: Array<{
        name: string;
        model: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
    }>;
    receiverSigned?: boolean;
    receiverSignatureDate?: any;
    delivererSigned?: boolean;
    delivererSignatureDate?: any;
    receiverSignatureData?: string | null;
    delivererSignatureData?: string | null;
    overseerSigned?: boolean;
    overseerSignatureDate?: any;
    overseerSignatureData?: string | null;
    interactiveRole?: 'deliverer' | 'receiver' | 'overseer';
    onSignatureChange?: (data: string | null) => void;
}

export default function HandoverReceiptForm({ 
    recipientName, 
    itemReceiverName, 
    overseerName, 
    recipientRole, 
    items = [],
    receiverSigned = false,
    receiverSignatureDate = null,
    delivererSigned = false,
    delivererSignatureDate = null,
    receiverSignatureData = null,
    delivererSignatureData = null,
    overseerSigned = false,
    overseerSignatureDate = null,
    overseerSignatureData = null,
    interactiveRole,
    onSignatureChange
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current && onSignatureChange) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.beginPath();
            onSignatureChange(canvasRef.current.toDataURL('image/png'));
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

        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const blankVal: React.CSSProperties = {
        borderBottom: '1.5px dashed #000', minHeight: '22px', padding: '0 4px',
        fontFamily: "'Times New Roman', serif", fontSize: '14px', fontWeight: 'bold',
        display: 'inline-block', minWidth: '80px',
    };

    return (
        <div
            className="handover-receipt-print-area print:shadow-none print:border-none"
            style={{
                width: '210mm', minHeight: '297mm', padding: '20mm 20mm',
                fontFamily: "'Times New Roman', serif", color: '#000', backgroundColor: '#fff',
                position: 'relative', display: 'flex', flexDirection: 'column',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
            }}
        >
            {/* Header line */}
            <div style={{ marginBottom: '20px', fontSize: '14px', fontWeight: 'bold', lineHeight: '2.4' }}>
                <p style={{ margin: '0 0 8px 0' }}>
                    የ 
                    <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px', minWidth: '150px', display: 'inline-block' }}>
                        {recipientName}
                    </span>
                    ርክክብ ቢሮና
                </p>
                <p style={{ margin: 0 }}>
                    እኔ 
                    <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>
                        {recipientName}
                    </span>
                </p>
            </div>

            {/* Body text */}
            <div style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '2.2', marginBottom: '20px' }}>
                <p style={{ margin: 0 }}>
                    ከዚህ በታች በስሜ ያወጣሁትን ንብረቶች እንድረከብ በተዘዘልኝ መሠረት ከዚህ በታች
                </p>
                <p style={{ margin: 0 }}>
                    በዝርዝር ማስረከቢያ በፊርማየ አረጋግጣለሁ፡፡
                </p>
            </div>

            {/* ===== TABLE ===== */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: 'bold', marginBottom: '30px' }}>
                <thead>
                    <tr>
                        <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'left', width: '25%' }}>የዕቃው አይነት</th>
                        <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '8%' }}>ብዛት</th>
                        <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '12%' }}>ሞዴል</th>
                        <th colSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>ያንዱ ዋ.ጋ</th>
                        <th colSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>ጠቅላላ ዋ.ጋ</th>
                        <th rowSpan={2} style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '12%' }}>ምርመራ</th>
                    </tr>
                    <tr>
                        <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>ብር</th>
                        <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>ሣ</th>
                        <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>ብር</th>
                        <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>ሣ</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Render actual items */}
                    {items.map((item, i) => {
                        const uPriceStr = item.unitPrice ? item.unitPrice.toFixed(2).split('.') : ['0', '00'];
                        const tPriceStr = item.totalPrice ? item.totalPrice.toFixed(2).split('.') : ['0', '00'];
                        return (
                            <tr key={i}>
                                <td style={{ border: '1px solid #000', padding: '8px 4px', height: '28px' }}>{item.name}</td>
                                <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}>{item.model}</td>
                                <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}>{uPriceStr[0]}</td>
                                <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}>{uPriceStr[1]}</td>
                                <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}>{tPriceStr[0]}</td>
                                <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}>{tPriceStr[1]}</td>
                                <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                            </tr>
                        );
                    })}
                    {/* Fill remaining empty rows to at least 10 */}
                    {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td style={{ border: '1px solid #000', padding: '8px 4px', height: '28px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px 4px' }}></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Bottom text */}
            <div style={{ fontSize: '13px', fontWeight: 'bold', lineHeight: '2', marginBottom: '30px' }}>
                <p style={{ margin: 0 }}>
                    እኔ አቶ/ወ/ሮ/ወ/ሪት 
                    <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>
                        {itemReceiverName}
                    </span>
                    ከዚህ በላይ የተዘረዘሩትን ንብረቶች እጅግና ቁጥር መረከቤን በተለመደው ፊርማዬ አረጋግጣለሁ፡፡
                </p>
            </div>

            {/* ===== SIGNATURES ===== */}
            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                    {/* Column 1: አስረካቢ */}
                    <div>
                        <p style={{ margin: '0 0 12px 0', textDecoration: 'underline', textUnderlineOffset: '3px' }}>አስረካቢ</p>
                        <div style={{ lineHeight: '2.4' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ስም</span>
                                <span style={{ ...blankVal, flex: 1 }}>{recipientName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ፊርማ</span>
                                <span style={{ ...blankVal, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                                    {interactiveRole === 'deliverer' && !delivererSignatureData ? (
                                        <canvas
                                            ref={canvasRef}
                                            width={180}
                                            height={40}
                                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: '40px', cursor: 'crosshair', touchAction: 'none', zIndex: 10 }}
                                            onMouseDown={startDrawing} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onMouseMove={draw}
                                            onTouchStart={startDrawing} onTouchEnd={stopDrawing} onTouchMove={draw}
                                        />
                                    ) : null}
                                    {delivererSignatureData ? (
                                        <img src={delivererSignatureData} alt="Signature" style={{ height: '40px', objectFit: 'contain', marginBottom: '-8px' }} />
                                    ) : null}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ቀን</span>
                                <span style={{ ...blankVal, flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                                    {delivererSigned && delivererSignatureDate ? (
                                        delivererSignatureDate.seconds ? new Date(delivererSignatureDate.seconds * 1000).toLocaleDateString() : 'Now'
                                    ) : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: ተረካቢ */}
                    <div>
                        <p style={{ margin: '0 0 12px 0', textDecoration: 'underline', textUnderlineOffset: '3px' }}>ተረካቢ</p>
                        <div style={{ lineHeight: '2.4' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ስም</span>
                                <span style={{ ...blankVal, flex: 1 }}>{itemReceiverName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ፊርማ</span>
                                <span style={{ ...blankVal, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                                    {interactiveRole === 'receiver' && !receiverSignatureData ? (
                                        <canvas
                                            ref={canvasRef}
                                            width={180}
                                            height={40}
                                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: '40px', cursor: 'crosshair', touchAction: 'none', zIndex: 10 }}
                                            onMouseDown={startDrawing} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onMouseMove={draw}
                                            onTouchStart={startDrawing} onTouchEnd={stopDrawing} onTouchMove={draw}
                                        />
                                    ) : null}
                                    {receiverSignatureData ? (
                                        <img src={receiverSignatureData} alt="Signature" style={{ height: '40px', objectFit: 'contain', marginBottom: '-8px' }} />
                                    ) : null}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ቀን</span>
                                <span style={{ ...blankVal, flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                                    {receiverSigned && receiverSignatureDate ? (
                                        receiverSignatureDate.seconds ? new Date(receiverSignatureDate.seconds * 1000).toLocaleDateString() : 'Now'
                                    ) : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Column 3: አረጋጋጭ */}
                    <div>
                        <p style={{ margin: '0 0 12px 0', textDecoration: 'underline', textUnderlineOffset: '3px' }}>አረጋጋጭ</p>
                        <div style={{ lineHeight: '2.4' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ስም</span>
                                <span style={{ ...blankVal, flex: 1 }}>{overseerName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ፊርማ</span>
                                <span style={{ ...blankVal, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                                    {interactiveRole === 'overseer' && !overseerSignatureData ? (
                                        <canvas
                                            ref={canvasRef}
                                            width={180}
                                            height={40}
                                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: '40px', cursor: 'crosshair', touchAction: 'none', zIndex: 10 }}
                                            onMouseDown={startDrawing} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onMouseMove={draw}
                                            onTouchStart={startDrawing} onTouchEnd={stopDrawing} onTouchMove={draw}
                                        />
                                    ) : null}
                                    {overseerSignatureData ? (
                                        <img src={overseerSignatureData} alt="Signature" style={{ height: '40px', objectFit: 'contain', marginBottom: '-8px' }} />
                                    ) : null}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                <span>ቀን</span>
                                <span style={{ ...blankVal, flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                                    {overseerSigned && overseerSignatureDate ? (
                                        overseerSignatureDate.seconds ? new Date(overseerSignatureDate.seconds * 1000).toLocaleDateString() : 'Now'
                                    ) : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
