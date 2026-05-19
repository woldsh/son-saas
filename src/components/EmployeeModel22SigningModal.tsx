'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { FiX, FiRefreshCw, FiCheck } from 'react-icons/fi';
import { FaPrint } from 'react-icons/fa';

interface MaterialDetail {
    materialName: string;
    materialCode?: string;
    materialType: string;
    quantity: number;
    unit: string;
    materialId?: string;
}

interface SentCodeRecord {
    id: string;
    verification_code: string;
    requester_name: string;
    material_details: MaterialDetail[];
    status: string;
    created_at: any;
    department?: string;
    request_id?: string;
}

interface EmployeeModel22SigningModalProps {
    record: SentCodeRecord;
    onClose: () => void;
    onSigned: () => void;
}

export default function EmployeeModel22SigningModal({ record, onClose, onSigned }: EmployeeModel22SigningModalProps) {
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [materialDetails, setMaterialDetails] = useState<Record<string, any>>({});

    // Signature canvas (same pattern as Model 20 PaperMaterialRequestForm)
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);

    useEffect(() => { setMounted(true); }, []);

    // Fetch material metadata for prices
    useEffect(() => {
        const fetchMaterials = async () => {
            if (!db) return;
            try {
                const snap = await getDocs(collection(db!, 'materials'));
                const details: Record<string, any> = {};
                snap.docs.forEach(d => {
                    const data = d.data();
                    if (data.materialCode) details[data.materialCode] = data;
                    if (data.materialName) details[data.materialName.trim().toLowerCase()] = data;
                });
                setMaterialDetails(details);
            } catch (err) {
                console.error('Failed to fetch materials:', err);
            }
        };
        fetchMaterials();
    }, []);

    // Canvas setup
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const resize = () => {
            const p = canvas.parentElement;
            if (p) {
                canvas.width = p.clientWidth;
                canvas.height = p.clientHeight;
                ctx.strokeStyle = '#0033aa';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [mounted]);

    const getPos = (e: React.MouseEvent | React.TouchEvent, c: HTMLCanvasElement) => {
        const r = c.getBoundingClientRect();
        if ('touches' in e) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
        return { x: (e as React.MouseEvent).clientX - r.left, y: (e as React.MouseEvent).clientY - r.top };
    };
    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        setIsDrawing(true);
        const { x, y } = getPos(e, c);
        ctx.beginPath(); ctx.moveTo(x, y);
    };
    const onDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        const { x, y } = getPos(e, c);
        ctx.lineTo(x, y); ctx.stroke();
    };
    const endDraw = () => {
        if (!isDrawing) return; setIsDrawing(false);
        const c = canvasRef.current;
        if (c) setSignatureData(c.toDataURL());
    };
    const clearSig = () => {
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        setSignatureData(null);
        ctx.strokeStyle = '#0033aa'; ctx.lineWidth = 2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    };

    const handleConfirmSign = async () => {
        if (!signatureData) {
            alert('እባክዎ ከማረጋገጥዎ በፊት ይፈርሙ። (Please sign before confirming)');
            return;
        }
        if (!db) return;
        setIsSubmitting(true);
        try {
            await updateDoc(doc(db!, 'Send_to_Users', record.id), {
                status: 'shared_with_store',
                recipientSignature: signatureData,
                sharedAt: new Date().toISOString()
            });
            onSigned();
        } catch (err) {
            console.error('Error saving signature:', err);
            alert('Failed to save signature.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    // Prepare display rows
    const displayRows = [...record.material_details];
    while (displayRows.length < 12) {
        displayRows.push({ materialName: '', materialCode: '', materialType: '', quantity: 0, unit: '' });
    }

    const inputClasses = "absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold px-1 text-[#0033aa] font-[Kalam] w-full text-center";
    const thClasses = "border-[1.5px] border-black p-1 text-center font-bold text-[12px] leading-tight";
    const tdClasses = "border-[1.5px] border-black p-1 text-center text-[12px] h-[30px] font-bold";

    const department = record.department || '';
    const employeeName = record.requester_name || '';

    // Date
    const rawDate = record.created_at;
    let dateObj = new Date();
    if (rawDate) {
        if (typeof rawDate.toDate === 'function') dateObj = rawDate.toDate();
        else dateObj = new Date(rawDate);
    }
    const formattedDate = dateObj.toLocaleDateString('am-ET');

    return createPortal(
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '40px 20px' }}
            onClick={onClose}
            className="print-reset-bg"
        >
            <div
                style={{ background: '#FDFCF8', width: '100%', maxWidth: '210mm', padding: '40px', color: '#000', position: 'relative', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                onClick={e => e.stopPropagation()}
                className="printable-receipt"
            >
                {/* Close & Print buttons */}
                <div className="absolute top-4 right-4 flex gap-2 print-hide font-sans z-50">
                    <button type="button" onClick={() => window.print()} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full shadow-sm" title="Print">
                        <FaPrint size={18} />
                    </button>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full shadow-sm">
                        <FiX size={18} />
                    </button>
                </div>

                {/* Row 1: Headers */}
                <div className="flex justify-between items-start mb-4 w-full">
                    <div className="w-[150px]">
                        <p className="text-[14px] font-bold leading-tight">ሞዴል ፳፪</p>
                        <p className="text-[12px] italic">Model 22</p>
                    </div>
                    <div className="flex flex-col items-center ml-20">
                        <div className="flex items-center gap-2 text-[20px] font-black">
                            <span className="italic">No.</span>
                            <span className="font-[Kalam] text-[#0033aa]">{record.verification_code || '---'}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[14px] font-bold leading-tight mr-16">ሴሪ ሀ/2ኛ</p>
                        <p className="text-[12px] italic mr-16">Serial B-2nd</p>
                    </div>
                </div>

                {/* Row 2: Emblem and Info */}
                <div className="flex justify-between gap-8 mb-6">
                    <div className="w-[400px] flex flex-col items-center justify-start mt-[-20px] shrink-0">
                        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0 mb-3" style={{ filter: 'grayscale(1) contrast(1000%) brightness(1.1)', opacity: 0.9 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://upload.wikimedia.org/wikipedia/commons/3/3f/Emblem_of_Ethiopia.svg" alt="Emblem" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col text-center justify-center w-full relative">
                            <p className="text-[14px] font-bold leading-tight">በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</p>
                            <p className="text-[11px] font-bold leading-tight uppercase">The Federal Democratic Republic of Ethiopia</p>
                            <p className="text-[14px] font-bold leading-tight mt-2">የገንዘብ ሚኒስቴር</p>
                            <p className="text-[11px] font-bold leading-tight uppercase">Ministry of Finance</p>
                            <div className="mt-8 relative w-full px-4">
                                <div className="flex items-end">
                                    <span className="text-[14px] font-bold leading-tight mr-2">የ</span>
                                    <div className="flex-1 border-b-[1.5px] border-black h-[22px] relative">
                                        <div className={inputClasses}>{department}</div>
                                    </div>
                                </div>
                                <div className="text-[11px] italic ml-10 mt-1 leading-none text-center">Department</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 text-[11px] space-y-3 font-semibold w-[400px]">
                        {[
                            { am: '1. ገንዘብ ወጪ መዝገብ የተመዘገበት ተራ ቁጥር', en: 'Item No. in Expenditure Registry', val: '' },
                            { am: '2. ዕቃ ገቢ መዝገብ የገባበት ገጽ', en: 'No. of entry in the register of incoming goods', val: '' },
                            { am: '3. ዕቃው የተሰጠው መደብ', en: 'Classification of Stock', val: '' },
                            { am: '4. ዕቃው የተቀመጠበት መጋዘን ቁጥር', en: 'Store No.', val: '' },
                            { am: '5. የመደርደሪያው ቁጥር', en: 'Shelf No.', val: '' },
                            { am: '6. ዕቃው የወጣበት የወጪ መዝገብ የተመዘገበት ተራ ቁጥር', en: 'No. of entry in the register of outgoing goods', val: '' }
                        ].map((item, i) => (
                            <div key={i}>
                                <div className="flex items-end">
                                    <span className="shrink-0 whitespace-nowrap">{item.am}</span>
                                    <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative">
                                        <div className="absolute inset-0 flex items-center justify-center font-[Kalam] text-[#0033aa] text-[13px] font-bold">{item.val}</div>
                                    </div>
                                </div>
                                <p className="text-[9px] italic pl-4 -mt-1 font-normal">{item.en}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-6 relative">
                    <p className="text-[20px] font-bold tracking-[0.2em] mb-1">የዕቃ &nbsp;&nbsp;ወይም &nbsp;&nbsp;የንብረት &nbsp;&nbsp;ወጪ &nbsp;&nbsp;ደረሰኝ</p>
                    <p className="text-[13px] font-bold tracking-[0.05em] border-b-[1.5px] border-black pb-0.5 inline-block">RECEIPT FOR ARTICLES OR PROPERTY ISSUED</p>
                </div>

                {/* Sentence block */}
                <div className="text-[13px] leading-[26px] mb-8 font-semibold w-full pr-4 text-justify">
                    <div className="flex items-baseline flex-wrap">
                        <span>እኔ</span>
                        <span className="w-[35%] border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center ml-1">{employeeName}</span>
                        <span className="ml-[1%]">ቀን</span>
                        <span className="w-[15%] border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center ml-1">{formattedDate}</span>
                        <span className="ml-1">ዓ.ም በቁጥር</span>
                        <span className="flex-1 border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center ml-2"></span>
                        <span className="ml-1">በትእዛዝ</span>
                    </div>
                    <div className="flex items-baseline mt-2">
                        <span>መሰረት ቀጥሎ በዝርዝር የተፃፉትን ዕቃዎች ለ</span>
                        <span className="flex-1 border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center mx-2 relative h-[20px]">{department}</span>
                        <span>አገልግሎት በትክክል</span>
                    </div>
                    <div><span>ቆጥሬ መረከቤን በፊርማየ አረጋግጣለሁ፡፡</span></div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border-[1.5px] border-black mb-10">
                    <thead>
                        <tr>
                            <th rowSpan={2} className={`${thClasses} w-[30px]`}>ተ.ቁ<br /><span className="text-[9px] font-normal italic">Serial<br />No.</span></th>
                            <th rowSpan={2} className={`${thClasses} w-[280px]`}>የዕቃው ወይም የንብረት<br />ዓይነት ዝርዝር<br /><span className="text-[9px] font-normal italic">Detailed Description</span></th>
                            <th rowSpan={2} className={`${thClasses} w-[50px]`}>ሞዴል<br /><span className="text-[9px] font-normal italic">Model</span></th>
                            <th rowSpan={2} className={`${thClasses} w-[45px]`}>ሴሪ<br /><span className="text-[9px] font-normal italic">Serial</span></th>
                            <th colSpan={2} className={`${thClasses} w-[100px]`}>ተከታታይ ቁጥር<br /><span className="text-[9px] font-normal italic">Serial</span></th>
                            <th rowSpan={2} className={`${thClasses} w-[50px]`}>ብዛት<br /><span className="text-[9px] font-normal italic">Quantity</span></th>
                            <th colSpan={2} className={`${thClasses} w-[80px]`}>ያንዱ ዋጋ<br /><span className="text-[9px] font-normal italic">Unit Price</span></th>
                            <th colSpan={2} className={`${thClasses} w-[80px]`}>የዋጋ ድምር<br /><span className="text-[9px] font-normal italic">Total Price</span></th>
                            <th rowSpan={2} className={`${thClasses} w-[80px]`}>ምርመራ<br /><span className="text-[9px] font-normal italic">Remarks</span></th>
                        </tr>
                        <tr>
                            <th className={`${thClasses} w-[45px]`}>ከ<br /><span className="text-[9px] font-normal italic">From</span></th>
                            <th className={`${thClasses} w-[45px]`}>እስከ<br /><span className="text-[9px] font-normal italic">To</span></th>
                            <th className={`${thClasses} w-[45px]`}>ብር<br /><span className="text-[9px] font-normal italic">Birr</span></th>
                            <th className={`${thClasses} w-[20px] p-0`}>ሳ<br /><span className="text-[9px] font-normal italic">C.</span></th>
                            <th className={`${thClasses} w-[45px]`}>ብር<br /><span className="text-[9px] font-normal italic">Birr</span></th>
                            <th className={`${thClasses} w-[20px] p-0`}>ሳ<br /><span className="text-[9px] font-normal italic">C.</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row, idx) => {
                            const isEmpty = !row.materialName;
                            if (isEmpty) {
                                return (
                                    <tr key={idx}>
                                        <td className={tdClasses}>{idx + 1}</td>
                                        <td className={`${tdClasses} text-left px-2`}></td>
                                        {Array(10).fill(0).map((_, ci) => <td key={ci} className={tdClasses}></td>)}
                                    </tr>
                                );
                            }
                            const mat: any = materialDetails[row.materialCode || ''] || materialDetails[row.materialName?.trim().toLowerCase() || ''] || {};
                            const qty = Number(row.quantity) || 0;
                            const rawUnitPrice = Number(mat.unitPrice) || 0;
                            const unitPriceBirr = rawUnitPrice > 0 ? Math.floor(rawUnitPrice).toString() : '';
                            const unitPriceCents = rawUnitPrice > 0 ? Math.round((rawUnitPrice % 1) * 100).toString().padStart(2, '0') : '';
                            const totalVal = rawUnitPrice * qty;
                            const totalPriceBirr = totalVal > 0 ? Math.floor(totalVal).toString() : '';
                            const totalPriceCents = totalVal > 0 ? Math.round((totalVal - Math.floor(totalVal)) * 100).toString().padStart(2, '0') : '';

                            return (
                                <tr key={idx}>
                                    <td className={tdClasses}>{idx + 1}</td>
                                    <td className={`${tdClasses} text-left px-2`}><span className="font-[Kalam] text-[15px]">{row.materialName}</span></td>
                                    <td className={tdClasses}><span className="font-[Kalam] text-[#0033aa] text-[15px]">{mat.model || ''}</span></td>
                                    <td className={tdClasses}><span className="font-[Kalam] text-[#0033aa] text-[15px]">{mat.serie || ''}</span></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}><span className="font-[Kalam] text-[17px] font-bold">{row.quantity}</span></td>
                                    <td className={tdClasses}><span className="font-[Kalam] text-[#0033aa] text-[15px]">{unitPriceBirr}</span></td>
                                    <td className={tdClasses}><span className="font-[Kalam] text-[#0033aa] text-[12px]">{unitPriceCents !== '00' ? unitPriceCents : ''}</span></td>
                                    <td className={tdClasses}><span className="font-[Kalam] text-[#e11d48] text-[15px] font-bold">{totalPriceBirr}</span></td>
                                    <td className={tdClasses}><span className="font-[Kalam] text-[#e11d48] text-[12px] font-bold">{totalPriceCents !== '00' ? totalPriceCents : ''}</span></td>
                                    <td className={tdClasses}></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Signatures Section */}
                <div className="flex justify-between mt-8 px-10">
                    {/* Store Keeper's Signature — empty placeholder */}
                    <div className="flex flex-col items-center">
                        <div style={{ width: 180, height: 70, borderBottom: '1.5px solid #000', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8 }}>
                            <span style={{ fontSize: 10, color: '#ccc', letterSpacing: 2 }}>ለግምጃ ቤት ብቻ</span>
                        </div>
                        <span className="font-bold text-[13px] mt-1">የግምጃ ቤቱ ፊርማ</span>
                        <span className="italic text-[11px]">Store Keeper&apos;s Signature</span>
                    </div>

                    {/* Recipient's Signature — SIGNING AREA */}
                    <div className="flex flex-col items-center">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: 220, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 12 }}>{employeeName}</span>
                            <button onClick={clearSig} className="print-hide" style={{ fontSize: 10, color: '#999', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FiRefreshCw size={10} /> ጽዳ
                            </button>
                        </div>
                        <div style={{ position: 'relative', width: 220, height: 70, borderBottom: '2px solid #000', background: '#fafafa', cursor: 'crosshair' }}>
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDraw} onMouseUp={endDraw} onMouseMove={onDraw} onMouseLeave={endDraw}
                                onTouchStart={startDraw} onTouchEnd={endDraw} onTouchMove={onDraw}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
                            />
                            {!isDrawing && !signatureData && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.15 }}>
                                    <span style={{ fontSize: 16, fontFamily: "'Kalam', cursive", fontStyle: 'italic' }}>እዚህ ይፈርሙ</span>
                                </div>
                            )}
                        </div>
                        <span className="font-bold text-[13px] mt-1">የተቀባዩ ፊርማ</span>
                        <span className="italic text-[11px]">Recipient&apos;s Signature</span>
                    </div>
                </div>

                {/* Confirm Button */}
                <div className="mt-10 flex justify-center print-hide">
                    <button
                        onClick={handleConfirmSign}
                        disabled={isSubmitting || !signatureData}
                        style={{
                            padding: '14px 48px', borderRadius: 12,
                            background: isSubmitting || !signatureData ? '#93c5fd' : '#2563eb',
                            color: '#fff', fontWeight: 700, border: 'none',
                            cursor: isSubmitting || !signatureData ? 'not-allowed' : 'pointer',
                            fontSize: 14, display: 'flex', alignItems: 'center', gap: 10,
                            boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                            textTransform: 'uppercase', letterSpacing: 2
                        }}
                    >
                        {isSubmitting ? (
                            <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div> Processing...</>
                        ) : (
                            <><FiCheck size={18} /> Confirm &amp; Send</>
                        )}
                    </button>
                </div>

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @media print {
                        .print-hide { display: none !important; }
                        .print-reset-bg { background: transparent !important; padding: 0 !important; }
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
}
