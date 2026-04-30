'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    Printer,
    Plus,
} from 'lucide-react';

interface GatePassItem {
    id: string;
    description: string;
    unit: string;
    quantity: string;
    remark: string;
}

export default function GatePassPage() {
    const [publicBody, setPublicBody] = useState('');
    const [date, setDate] = useState('');
    const [serialNo, setSerialNo] = useState('');
    const [reason, setReason] = useState('');
    const [approvedBy, setApprovedBy] = useState('');
    const [receivedBy, setReceivedBy] = useState('');
    
    // Initial 10 rows for the form
    const [items, setItems] = useState<GatePassItem[]>(
        Array.from({ length: 10 }, (_, i) => ({
            id: (i + 1).toString(),
            description: '',
            unit: '',
            quantity: '',
            remark: ''
        }))
    );

    const addItem = () => {
        setItems([...items, {
            id: Math.random().toString(36).substr(2, 9),
            description: '',
            unit: '',
            quantity: '',
            remark: ''
        }]);
    };

    const updateItem = (id: string, field: keyof GatePassItem, value: string) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center py-10 px-8 overflow-y-auto">
            {/* Print Button (Floating) */}
            <div className="fixed top-24 right-12 print:hidden z-50">
                <button 
                    onClick={handlePrint}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 hover:bg-slate-50 transition-all shadow-md font-bold active:scale-95"
                >
                    <Printer size={20} />
                    Print
                </button>
            </div>

            {/* THE FORM (A4) */}
            <div className="bg-white border border-slate-100 shadow-sm print:border-none print:shadow-none print:m-0" 
                 id="gate-pass-print-area"
                 style={{ 
                     width: '210mm', 
                     minHeight: '297mm', 
                     padding: '20mm 25mm', 
                     fontFamily: "'Times New Roman', serif",
                     color: '#000',
                     backgroundColor: '#fff',
                     position: 'relative',
                     display: 'flex',
                     flexDirection: 'column'
                 }}>
                
                {/* Header */}
                <div className="text-center mb-10">
                    <p className="font-bold text-[20px] mb-1">የገንዘብና ኢኮኖሚ ልማት ሚኒስቴር</p>
                    <p className="font-bold text-[18px]">MINISTRY OF FINANACE & ECONOMIC DEVELOPMENT</p>
                </div>

                {/* Title Section */}
                <div className="text-center mb-12">
                    <p className="font-bold text-[20px] mb-1 underline underline-offset-4">የስቶክ ማውጫ ፈቃድ</p>
                    <p className="font-bold text-[18px]">GATE PASS FOR STOCKS</p>
                </div>

                {/* Meta Fields */}
                <div className="flex flex-col gap-6 mb-10">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col w-[45%]">
                            <span className="font-bold text-[15px] mb-0.5 ml-1">የመ/ቤቱ ስም</span>
                            <div className="flex items-end w-full">
                                <span className="font-bold text-[14px] mr-2 whitespace-nowrap">Public Body</span>
                                <input 
                                    type="text"
                                    value={publicBody}
                                    onChange={(e) => setPublicBody(e.target.value)}
                                    className="flex-1 border-b-2 border-black h-6 px-1 font-bold outline-none bg-transparent placeholder:text-slate-100 min-w-0"
                                    placeholder="................................"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col w-[20%]">
                            <span className="font-bold text-[15px] mb-0.5 ml-1">ቀን</span>
                            <div className="flex items-end w-full">
                                <span className="font-bold text-[14px] mr-2">Date</span>
                                <input 
                                    type="text"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="flex-1 border-b-2 border-black h-6 px-1 font-bold outline-none bg-transparent placeholder:text-slate-100 min-w-0"
                                    placeholder="........"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col w-[25%]">
                            <span className="font-bold text-[15px] mb-0.5 ml-1">መለያ ቁጥር</span>
                            <div className="flex items-end w-full">
                                <span className="font-bold text-[14px] mr-2 whitespace-nowrap">Serial No.</span>
                                <input 
                                    type="text"
                                    value={serialNo}
                                    onChange={(e) => setSerialNo(e.target.value)}
                                    className="flex-1 border-b-2 border-black h-6 px-1 font-bold outline-none bg-transparent placeholder:text-slate-100 min-w-0"
                                    placeholder="........"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col w-full">
                        <div className="flex items-end w-full">
                            <span className="font-bold text-[15px] mr-2 whitespace-nowrap">ዕቃው እንዲወጣ የተፈቀደበት ምክንያት</span>
                            <input 
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="flex-1 border-b-2 border-black h-6 px-2 font-bold outline-none bg-transparent placeholder:text-slate-100 min-w-0"
                                placeholder=".................................................................................................................."
                            />
                        </div>
                        <span className="font-bold text-[14px] mt-0.5 ml-1">Reason for dispatching stock</span>
                    </div>

                    <div className="mt-4">
                        <p className="font-bold text-[15px] mb-0.5">ከዚህ በታች የተዘረዘሩት ስቶኮች እንዲወጡ ተፈቅዷል፡፡</p>
                        <p className="font-bold text-[13px] italic">The following goods are authorized to dispatch</p>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border-[2.5px] border-black">
                    <thead>
                        <tr className="bg-slate-50/30">
                            <th className="border-[2.5px] border-black p-2 text-center text-[14px] leading-tight w-[10%]">
                                ተራ ቁጥር <br /> S. No.
                            </th>
                            <th className="border-[2.5px] border-black p-2 text-center text-[14px] leading-tight w-[45%]">
                                የንብረት ዝርዝር <br /> list of Items
                            </th>
                            <th className="border-[2.5px] border-black p-2 text-center text-[14px] leading-tight w-[15%]">
                                መለኪያ <br /> Unit
                            </th>
                            <th className="border-[2.5px] border-black p-2 text-center text-[14px] leading-tight w-[15%]">
                                ብዛት <br /> Quantity
                            </th>
                            <th className="border-[2.5px] border-black p-2 text-center text-[14px] leading-tight w-[15%]">
                                ምርመራ <br /> Remark
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="h-10">
                                <td className="border-[2px] border-black p-2 text-center font-bold">{index + 1}</td>
                                <td className="border-[2px] border-black p-0">
                                    <input 
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                        className="w-full h-full bg-transparent outline-none font-bold uppercase px-2 text-center"
                                    />
                                </td>
                                <td className="border-[2px] border-black p-0 text-center">
                                    <input 
                                        type="text"
                                        value={item.unit}
                                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                        className="w-full h-full bg-transparent outline-none text-center px-1"
                                    />
                                </td>
                                <td className="border-[2px] border-black p-0 text-center font-bold">
                                    <input 
                                        type="text"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                        className="w-full h-full bg-transparent outline-none text-center font-bold px-1"
                                    />
                                </td>
                                <td className="border-[2px] border-black p-0">
                                    <input 
                                        type="text"
                                        value={item.remark}
                                        onChange={(e) => updateItem(item.id, 'remark', e.target.value)}
                                        className="w-full h-full bg-transparent outline-none px-2 text-center"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Add Row Button - Blue, below table, hidden on print */}
                <div className="mt-4 print:hidden flex justify-center">
                    <button 
                        onClick={addItem}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={18} />
                        Add Row
                    </button>
                </div>

                {/* Signatures */}
                <div className="mt-auto pt-24 pb-10 grid grid-cols-2 gap-x-20">
                    <div className="text-center flex flex-col items-center">
                        <input 
                            type="text"
                            value={approvedBy}
                            onChange={(e) => setApprovedBy(e.target.value)}
                            className="w-full border-b-2 border-black mb-2 mx-8 h-8 text-center font-bold outline-none bg-transparent placeholder:text-slate-100"
                            placeholder="................................"
                        />
                        <p className="font-bold text-[14px]">የፈቀደው ስም እና ፊርማ</p>
                        <p className="font-bold text-[13px] italic">Approved by (Name & Signature)</p>
                    </div>
                    <div className="text-center flex flex-col items-center">
                        <input 
                            type="text"
                            value={receivedBy}
                            onChange={(e) => setReceivedBy(e.target.value)}
                            className="w-full border-b-2 border-black mb-2 mx-8 h-8 text-center font-bold outline-none bg-transparent placeholder:text-slate-100"
                            placeholder="................................"
                        />
                        <p className="font-bold text-[14px]">የተረከበው ስም እና ፊርማ</p>
                        <p className="font-bold text-[13px] italic">Received by (Name & Signature)</p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    body * { visibility: hidden; }
                    #gate-pass-print-area, #gate-pass-print-area * { visibility: visible; }
                    #gate-pass-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        height: 100% !important;
                        padding: 20mm 25mm !important;
                    }
                    input { border: none !important; }
                    @page { size: A4; margin: 0; }
                }
            `}</style>
        </div>
    );
}
