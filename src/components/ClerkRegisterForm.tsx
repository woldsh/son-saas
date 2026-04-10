'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { FaCheckCircle, FaTimes, FaSpinner, FaPlus, FaPrint, FaCamera, FaImage } from 'react-icons/fa';

interface ClerkRegisterFormProps {
    type: 'fixed' | 'consumable';
}

interface TableRow {
    id: string;
    description: string;
    model: string;
    serie: string;
    pageFrom: string;
    pageTo: string;
    quantity: string;
    unitPriceBirr: string;
    unitPriceCents: string;
    totalPriceBirr: string;
    totalPriceCents: string;
    imageUrl?: string;
    isUploading?: boolean;
}

const createEmptyRow = (): TableRow => ({
    id: Math.random().toString(36).slice(2),
    description: '', model: '', serie: '', pageFrom: '', pageTo: '',
    quantity: '', unitPriceBirr: '', unitPriceCents: '',
    totalPriceBirr: '', totalPriceCents: '',
});

export default function ClerkRegisterForm({ type }: ClerkRegisterFormProps) {
    const isFixed = type === 'fixed';

    const [headerData, setHeaderData] = useState({
        receiptNo: '',
        expenditureRegistryNo: '',
        incomingGoodsEntryNo: '',
        classificationOfStock: '',
        storeNo: '',
        shelfNo: '',
        department: '',
        recipientName: '',
        day: '',
        fromLocation: '',
    });

    const [rows, setRows] = useState<TableRow[]>(() =>
        Array.from({ length: 15 }, () => createEmptyRow())
    );

    const [delivererDonor, setDelivererDonor] = useState('');
    const [delivererRecipient, setDelivererRecipient] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

    // Target department for material visibility
    const [targetDepartment, setTargetDepartment] = useState('all');

    // Department options (academic + admin)
    const DEFAULT_ACADEMIC_DEPTS = [
        { id: 'accounting_finance', label: 'Accounting and Finance' },
        { id: 'agribusiness', label: 'Agribusiness' },
        { id: 'animal_science', label: 'Animal Science' },
        { id: 'computer_science', label: 'Computer Science' },
        { id: 'economics', label: 'Economics' },
        { id: 'general_forester', label: 'General Forester' },
        { id: 'horticulture', label: 'Horticulture' },
        { id: 'management', label: 'Management' },
        { id: 'natural_resource_management', label: 'Natural Resource' },
        { id: 'plant_science', label: 'Plant Science' },
        { id: 'peace_development', label: 'Peace and Dev' },
        { id: 'veterinary_science', label: 'Veterinary Science' },
        { id: 'common_course', label: 'Common Course' },
    ];

    const DEFAULT_ADMIN_DEPTS = [
        { id: 'hrm', label: 'HRM' },
        { id: 'finance', label: 'Finance' },
        { id: 'procurement_admin', label: 'Procurement Admin' },
        { id: 'resource_development', label: 'Resource Dev & Revenue' },
        { id: 'building_renovation', label: 'Building Renovation' },
        { id: 'general_service_admin', label: 'General Service' },
        { id: 'library_service', label: 'Library Service' },
        { id: 'security', label: 'Security' },
        { id: 'registrar', label: 'Registrar' },
        { id: 'student_service', label: 'Student Service' },
    ];

    const [academicDepts, setAcademicDepts] = useState(DEFAULT_ACADEMIC_DEPTS);
    const [adminDepts, setAdminDepts] = useState(DEFAULT_ADMIN_DEPTS);

    // Fetch dynamic departments from Firestore settings
    useEffect(() => {
        const fetchDepts = async () => {
            if (!db) return;
            try {
                // Fetch academic departments
                const academicSnap = await getDoc(doc(db, 'settings', 'academic_configurations'));
                if (academicSnap.exists()) {
                    const data = academicSnap.data();
                    if (data.departments && Array.isArray(data.departments)) {
                        setAcademicDepts(prev => {
                            const newDepts = [...prev];
                            data.departments.forEach((name: string) => {
                                const id = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                                if (!newDepts.find(d => d.id === id)) {
                                    newDepts.push({ id, label: name });
                                }
                            });
                            return newDepts;
                        });
                    }
                }

                // Fetch admin departments
                const adminSnap = await getDoc(doc(db, 'settings', 'admin_configurations'));
                if (adminSnap.exists()) {
                    const data = adminSnap.data();
                    if (data.departments && Array.isArray(data.departments)) {
                        setAdminDepts(prev => {
                            const newDepts = [...prev];
                            data.departments.forEach((name: string) => {
                                const id = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                                if (!newDepts.find(d => d.id === id)) {
                                    newDepts.push({ id, label: name });
                                }
                            });
                            return newDepts;
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch department settings:', err);
            }
        };
        fetchDepts();
    }, []);

    const calculateRowTotal = useCallback((row: TableRow): TableRow => {
        const qty = parseFloat(row.quantity) || 0;
        const birr = parseFloat(row.unitPriceBirr) || 0;
        const cents = parseFloat(row.unitPriceCents) || 0;
        if (qty > 0 && (birr > 0 || cents > 0)) {
            const unitTotal = birr + cents / 100;
            const total = unitTotal * qty;
            return { ...row, totalPriceBirr: Math.floor(total).toString(), totalPriceCents: Math.round((total - Math.floor(total)) * 100).toString().padStart(2, '0') };
        }
        return { ...row, totalPriceBirr: '', totalPriceCents: '' };
    }, []);

    const compressImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Scale down if larger than max dimensions
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('Canvas context failed')); return; }
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG
                    const compressed = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressed);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            alert("Image is too large. Please upload an image smaller than 10MB.");
            return;
        }

        setRows(prev => prev.map((r, i) => i === index ? { ...r, isUploading: true } : r));

        try {
            // Compress the image client-side to keep Firestore document size manageable
            const compressedBase64 = await compressImage(file);
            setRows(prev => prev.map((r, i) => i === index ? { ...r, imageUrl: compressedBase64, isUploading: false } : r));
        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Image upload failed. Please try a different image.");
            setRows(prev => prev.map((r, i) => i === index ? { ...r, isUploading: false } : r));
        }
    };

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setHeaderData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRowChange = (index: number, field: keyof TableRow, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            updated[index] = calculateRowTotal({ ...updated[index], [field]: value });
            return updated;
        });
    };

    const addRow = () => setRows(prev => [...prev, createEmptyRow()]);

    // Grand totals
    let gBirr = 0, gCents = 0;
    let uBirr = 0, uCents = 0;
    rows.forEach(r => {
        gBirr += parseInt(r.totalPriceBirr) || 0;
        gCents += parseInt(r.totalPriceCents) || 0;
        uBirr += parseInt(r.unitPriceBirr) || 0;
        uCents += parseInt(r.unitPriceCents) || 0;
    });
    gBirr += Math.floor(gCents / 100); gCents = gCents % 100;
    uBirr += Math.floor(uCents / 100); uCents = uCents % 100;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus({ type: null, message: '' });
        const filledRows = rows.filter(r => r.description.trim());
        if (!filledRows.length) {
            setSubmitStatus({ type: 'error', message: 'Add at least one item.' });
            setIsSubmitting(false);
            return;
        }
        try {
            if (!db) throw new Error('Firebase not initialized');
            await addDoc(collection(db, 'materials'), {
                ...headerData,
                materialType: isFixed ? 'clerk_fixed' : 'clerk_consumable',
                formType: 'receipt_for_articles',
                items: filledRows,
                grandTotalBirr: gBirr,
                grandTotalCents: gCents,
                unitPriceTotalBirr: uBirr,
                unitPriceTotalCents: uCents,
                targetDepartment,
                visibleToAll: targetDepartment === 'all',
                delivererDonor,
                delivererRecipient,
                currency: 'ETB',
                createdAt: new Date().toISOString(),
            });
            setSubmitStatus({ type: 'success', message: 'Receipt registered successfully!' });
            setHeaderData({ receiptNo: '', expenditureRegistryNo: '', incomingGoodsEntryNo: '', classificationOfStock: '', storeNo: '', shelfNo: '', department: '', recipientName: '', day: '', fromLocation: '' });
            setRows(Array.from({ length: 15 }, () => createEmptyRow()));
            setDelivererDonor(''); setDelivererRecipient('');
            setTargetDepartment('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            setSubmitStatus({ type: 'error', message: 'Error. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Inline input style for table fields
    const blankInput = "bg-transparent border-none outline-none w-full h-full text-[12px] px-1";
    const blankInputCenter = blankInput + " text-center";

    return (
        <div className="max-w-[1000px] mx-auto pb-16 font-serif">
            {submitStatus.message && (
                <div className={`mb-4 p-3 rounded flex items-center gap-2 text-sm font-sans ${submitStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {submitStatus.type === 'success' ? <FaCheckCircle /> : <FaTimes />}
                    <span className="font-semibold">{submitStatus.message}</span>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* ========== FORM PAPER ========== */}
                <div
                    id="printable-receipt"
                    className="bg-[#FDFCF8] border border-gray-400 p-8 shadow-sm print:shadow-none print:p-0 print:border-none relative"
                    style={{ color: '#1a1a1a' }}
                >
                    {/* Header Row 1: Model / Serial / Receipt No */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-[150px]">
                            <p className="text-[14px] font-bold leading-tight">ሞዴል ፲፱</p>
                            <p className="text-[12px] italic">Model 19</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[14px] font-bold leading-tight">ሴሪ ሀ/13</p>
                            <p className="text-[12px] italic">Serial A/13</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[20px] font-bold">ቁ.</span>
                            <div className="w-[140px] border-b border-black h-[24px] relative">
                                <input
                                    type="text"
                                    name="receiptNo"
                                    value={headerData.receiptNo}
                                    onChange={handleHeaderChange}
                                    className="absolute inset-0 bg-transparent border-none outline-none text-center text-[16px] font-bold tracking-widest"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Emblem + Gov Text | Numbered lines */}
                    <div className="flex justify-between gap-8 mb-6">
                        {/* Left: Emblem Area */}
                        <div className="w-[450px] flex flex-col items-center justify-start mt-[-40px] shrink-0">
                            {/* Official Ethiopian Emblem (from Wikipedia, grayscaled) */}
                            <div className="w-[70px] h-[70px] rounded-full flex items-center justify-center shrink-0 mb-3" style={{ filter: 'grayscale(1) contrast(1000%) brightness(1.1)', opacity: 0.9 }}>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/3/3f/Emblem_of_Ethiopia.svg" alt="Emblem of Ethiopia" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex flex-col text-center justify-center w-full">
                                <p className="text-[14px] font-bold leading-tight">በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</p>
                                <p className="text-[11px] font-bold leading-tight uppercase">The Federal Democratic Republic of Ethiopia</p>
                                <p className="text-[14px] font-bold leading-tight mt-2">የገንዘብና ኢኮኖሚ ትብብር ሚኒስቴር</p>
                                <p className="text-[11px] font-bold leading-tight uppercase">Ministry of Finance and</p>
                                <p className="text-[11px] font-bold leading-tight uppercase">Economic Cooperation</p>
                            </div>
                        </div>

                        {/* Right: Numbered Header Fields */}
                        {/* Right: Numbered Header Fields */}
                        <div className="flex-1 text-[12px] space-y-4">
                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">1. ዋጋው በገንዘብ ወጪ መዝገብ የተመዘገበት ተራ ቁጥር</span>
                                <div className="flex-1 border-b border-black ml-3 h-[18px] relative">
                                    <input type="text" name="expenditureRegistryNo" value={headerData.expenditureRegistryNo} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[12px] font-bold px-2 pb-[2px]" />
                                </div>
                            </div>
                            <p className="text-[10px] italic pl-4 -mt-1">Item No. In Expenditure Registry</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">2. ዕቃ ገቢ መዝገብ የገባበት ገጽ</span>
                                <div className="flex-1 border-b border-black ml-3 h-[18px] relative">
                                    <input type="text" name="incomingGoodsEntryNo" value={headerData.incomingGoodsEntryNo} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[12px] font-bold px-2 pb-[2px]" />
                                </div>
                            </div>
                            <p className="text-[10px] italic pl-4 -mt-1">No. of entry in the register of incoming goods</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">3. ለዕቃው የተሰጠው መደብ</span>
                                <div className="flex-1 border-b border-black ml-3 h-[18px] relative">
                                    <select
                                        name="classificationOfStock"
                                        value={headerData.classificationOfStock}
                                        onChange={handleHeaderChange}
                                        className="absolute inset-0 bg-transparent border-none outline-none text-[11px] font-bold px-2 pb-[2px] appearance-none cursor-pointer w-full"
                                        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                    >
                                        <option value="">-- ይምረጡ / Select --</option>
                                        <optgroup label="── ዋና መደቦች / Main Classifications ──">
                                            <option value="fixed_asset">የማይንቀሳቀስ ንብረት / Fixed Asset</option>
                                            <option value="consumable">ፍጆታ ዕቃ / Consumable Item</option>
                                            <option value="semi_expendable">ከፊል ፍጆታ / Semi-Expendable</option>
                                        </optgroup>
                                        <optgroup label="── ንዑስ መደቦች / Sub-Classifications ──">
                                            <option value="office_supplies">የቢሮ ቁሳቁስ / Office Supplies</option>
                                            <option value="office_furniture">የቢሮ ዕቃ / Office Furniture</option>
                                            <option value="electronics">ኤሌክትሮኒክስ / Electronics</option>
                                            <option value="laboratory">የላቦራቶሪ ዕቃ / Laboratory Equipment</option>
                                            <option value="machinery">ማሽነሪ / Machinery</option>
                                            <option value="vehicle">ተሽከርካሪ / Vehicle</option>
                                            <option value="cleaning">የጽዳት ዕቃ / Cleaning Supplies</option>
                                            <option value="medical">የህክምና ዕቃ / Medical Supplies</option>
                                            <option value="educational">የትምህርት ቁሳቁስ / Educational Materials</option>
                                            <option value="building_material">የግንባታ ዕቃ / Building Material</option>
                                            <option value="food_beverage">ምግብና መጠጥ / Food & Beverage</option>
                                            <option value="fuel_lubricant">ነዳጅና ቅባት / Fuel & Lubricant</option>
                                            <option value="spare_parts">መለዋወጫ / Spare Parts</option>
                                            <option value="other">ሌላ / Other</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                            <p className="text-[10px] italic pl-4 -mt-1">Classification of stock</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">4. ዕቃው የሚቀመጥበት መጋዝን ቁጥር</span>
                                <div className="flex-1 border-b border-black ml-3 h-[18px] relative">
                                    <input type="text" name="storeNo" value={headerData.storeNo} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[12px] font-bold px-2 pb-[2px]" />
                                </div>
                            </div>
                            <p className="text-[10px] italic pl-4 -mt-1">Store No.</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">5. የመደርደሪያው ቁጥር</span>
                                <div className="flex-1 border-b border-black ml-3 h-[18px] relative">
                                    <input type="text" name="shelfNo" value={headerData.shelfNo} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[12px] font-bold px-2 pb-[2px]" />
                                </div>
                            </div>
                            <p className="text-[10px] italic pl-4 -mt-1">Shelf No.</p>
                        </div>
                    </div>

                    {/* Department line - Dropdown Selector */}
                    <div className="mb-8 relative w-[350px]">
                        <div className="flex items-end">
                            <span className="text-[14px] font-bold leading-tight mr-2">የ</span>
                            <div className="flex-1 border-b border-black h-[22px] relative">
                                <select
                                    name="department"
                                    value={headerData.department}
                                    onChange={(e) => {
                                        handleHeaderChange(e);
                                        setTargetDepartment(e.target.value);
                                    }}
                                    className="absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold appearance-none cursor-pointer w-full"
                                    style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                >
                                    <option value="">-- ክፍል ይምረጡ / Select --</option>
                                    <option value="all">✦ ➡️ለሁሉም ክፍሎች / All Departments</option>
                                    <optgroup label="── አካዳሚክ ክፍሎች / Academic ──">
                                        {academicDepts.map(dept => (
                                            <option key={dept.id} value={dept.id}>{dept.label}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="── አስተዳደር ክፍሎች / Administrative ──">
                                        {adminDepts.map(dept => (
                                            <option key={dept.id} value={dept.id}>{dept.label}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="── ሌሎች / Other ──">
                                        <option value="academic_coordinator">Academic Coordinator</option>
                                        <option value="procurement_team_leader">Procurement Team Leader</option>
                                        <option value="fixed_asset_stock_clerk">Stock Clerk (Fixed Assets)</option>
                                        <option value="consumable_item_stock_clerk">Stock Clerk (Consumable)</option>
                                        <option value="fixed_asset_store_keeper">Store Keeper (Fixed Assets)</option>
                                        <option value="consumable_item_store_keeper">Store Keeper (Consumable)</option>
                                        <option value="managing_director">Managing Director</option>
                                        <option value="general_service">General Service</option>
                                        <option value="chief">Chief / Institution Head</option>
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                        <div className="text-[11px] italic ml-10 mt-1 leading-none">
                            Department
                        </div>
                    </div>

                    {/* Main Title Section */}
                    <div className="text-center mb-8 mt-2 relative">
                        <p className="text-[20px] font-bold tracking-[0.2em]">
                            የዕቃ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ወይም &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; የንብረት &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ገቢ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ደረሰኝ
                        </p>
                        <p className="text-[13px] font-bold tracking-[0.05em] mt-1 border-b-[1.5px] border-black inline-block pb-0.5">
                            RECEIPT FOR ARTICLES OR PROPERTY RECEIVED
                        </p>
                    </div>

                    {/* Recipient Details Section */}
                    <div className="space-y-2 mb-6 text-[12px] leading-relaxed">
                        {/* Name row */}
                        <div className="relative">
                            <div className="flex items-end">
                                <span className="text-[14px] font-bold whitespace-nowrap mr-2 leading-tight">ስም</span>
                                <div className="w-[45%] border-b border-black h-[18px] relative">
                                    <input type="text" name="recipientName" value={headerData.recipientName} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[14px] px-1 font-bold" />
                                </div>
                                <span className="text-[14px] font-bold whitespace-nowrap ml-4 leading-tight">ከዚህ በታች በዝርዝር የተመለከተውን</span>
                                <div className="flex-1 border-b border-black h-[18px] ml-2"></div>
                            </div>
                            <div className="flex text-[11px] italic mt-1 leading-none">
                                <span className="ml-[60px]">Name</span>
                                <span className="ml-[45%]">Received the following</span>
                            </div>
                        </div>

                        {/* Date row */}
                        <div className="flex items-end gap-1 relative mt-3">
                            <div className="w-[20%] border-b border-black h-[18px]"></div>
                            <span className="text-[14px] font-bold whitespace-nowrap ml-2 leading-tight">ቀን ፳፻</span>
                            <div className="w-[60px] border-b border-black h-[18px] relative mx-1">
                                <input type="text" name="day" value={headerData.day} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-center text-[14px] font-bold" />
                            </div>
                            <span className="text-[14px] font-bold whitespace-nowrap leading-tight">ዓ.ም</span>

                            <span className="text-[14px] font-bold whitespace-nowrap ml-8 leading-tight">ከ</span>
                            <div className="flex-1 border-b border-black h-[18px] relative mx-2">
                                <input type="text" name="fromLocation" value={headerData.fromLocation} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[14px] px-2 font-bold" />
                            </div>
                            <span className="text-[14px] font-bold whitespace-nowrap leading-tight">ተቀብያለሁ ::</span>
                        </div>
                        <div className="flex text-[11px] italic mt-1 leading-none">
                            <span className="ml-[25%]">Day 20</span>
                            <span className="ml-[24%]">From</span>
                        </div>
                    </div>


                    {/* Main Form Table */}
                    <table className="w-full border-collapse border-[1.5px] border-black text-[12px] mb-2">
                        <thead>
                            <tr className="h-[40px]">
                                <th rowSpan={2} className="border border-black w-[45px] text-center p-0 align-middle">
                                    <div className="font-bold">ተ.ቁ</div>
                                    <div className="text-[9px] italic leading-tight">Serial<br />No.</div>
                                    <div className="text-[8px] mt-1">This</div>
                                </th>
                                <th rowSpan={2} className="border border-black px-2 align-middle min-w-[250px]">
                                    <div className="font-bold text-center">የዕቃው ወይም የንብረት ዓይነት ዝርዝር</div>
                                    <div className="text-[10px] italic text-center">Detailed Description of Articles or Property</div>
                                </th>
                                <th rowSpan={2} className="border border-black w-[60px] text-center align-middle">
                                    <div className="font-bold">ሞዴል</div>
                                    <div className="text-[9px] italic">Model</div>
                                </th>
                                <th rowSpan={2} className="border border-black w-[50px] text-center align-middle">
                                    <div className="font-bold">ሴሪ</div>
                                    <div className="text-[9px] italic">Serie</div>
                                </th>
                                <th colSpan={2} className="border border-black text-center h-[20px]">
                                    <div className="font-bold">ተከታታይ ገ.</div>
                                    <div className="text-[9px] italic mt-[-2px]">Page No.</div>
                                </th>
                                <th rowSpan={2} className="border border-black w-[60px] text-center align-middle">
                                    <div className="font-bold">ብዛት</div>
                                    <div className="text-[9px] italic">Quantity</div>
                                </th>
                                <th colSpan={2} className="border border-black text-center h-[20px]">
                                    <div className="font-bold">የአንዱ ዋጋ</div>
                                    <div className="text-[9px] italic mt-[-2px]">Unit price</div>
                                </th>
                                <th colSpan={2} className="border border-black text-center h-[20px]">
                                    <div className="font-bold">የዋጋው ድምር</div>
                                    <div className="text-[9px] italic mt-[-2px]">Total price</div>
                                </th>
                            </tr>
                            <tr className="h-[35px]">
                                <th className="border border-black w-[35px] text-center">
                                    <div className="font-bold">ከ</div>
                                    <div className="text-[9px] italic mt-[-2px]">From</div>
                                </th>
                                <th className="border border-black w-[35px] text-center">
                                    <div className="font-bold">እስከ</div>
                                    <div className="text-[9px] italic mt-[-2px]">To</div>
                                </th>
                                <th className="border border-black w-[50px] text-center">
                                    <div className="font-bold">ብር</div>
                                    <div className="text-[9px] italic mt-[-2px]">Birr</div>
                                </th>
                                <th className="border border-black w-[30px] text-center">
                                    <div className="font-bold">ሳ</div>
                                    <div className="text-[9px] italic mt-[-2px]">C</div>
                                </th>
                                <th className="border border-black w-[50px] text-center">
                                    <div className="font-bold">ብር</div>
                                    <div className="text-[9px] italic mt-[-2px]">Birr</div>
                                </th>
                                <th className="border border-black w-[30px] text-center">
                                    <div className="font-bold">ሳ</div>
                                    <div className="text-[9px] italic mt-[-2px]">C</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={row.id} className="h-[26px]">
                                    <td className="border border-black text-center">{i + 1}</td>
                                    <td className="border border-black p-0 relative">
                                        <div className="flex w-full items-center h-full">
                                            <input type="text" value={row.description} onChange={e => handleRowChange(i, 'description', e.target.value)} className={`${blankInput} pr-8`} />
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 print-hide z-10 bg-white">
                                                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 p-1.5 rounded transition-colors text-slate-500 shadow-sm flex items-center justify-center border border-slate-200">
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(i, e)} />
                                                    {row.isUploading ? <FaSpinner className="animate-spin text-xs text-blue-500" /> : row.imageUrl ? <FaImage className="text-green-600 text-xs" title="Image Uploaded" /> : <FaCamera className="text-xs text-slate-600" title="Attach Image" />}
                                                </label>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="border border-black p-0 relative">
                                        <input type="text" value={row.model} onChange={e => handleRowChange(i, 'model', e.target.value)} className={blankInputCenter} />
                                    </td>
                                    <td className="border border-black p-0 relative">
                                        <input type="text" value={row.serie} onChange={e => handleRowChange(i, 'serie', e.target.value)} className={blankInputCenter} />
                                    </td>
                                    <td className="border border-black p-0 relative">
                                        <input type="text" value={row.pageFrom} onChange={e => handleRowChange(i, 'pageFrom', e.target.value)} className={blankInputCenter} />
                                    </td>
                                    <td className="border border-black p-0 relative">
                                        <input type="text" value={row.pageTo} onChange={e => handleRowChange(i, 'pageTo', e.target.value)} className={blankInputCenter} />
                                    </td>
                                    <td className="border border-black p-0 relative">
                                        <input type="text" value={row.quantity} onChange={e => handleRowChange(i, 'quantity', e.target.value)} className={blankInputCenter} />
                                    </td>
                                    <td className="border border-black p-0 relative">
                                        <input type="text" value={row.unitPriceBirr} onChange={e => handleRowChange(i, 'unitPriceBirr', e.target.value)} className={blankInputCenter} />
                                    </td>
                                    <td className="border border-black p-0 relative">
                                        <input type="text" value={row.unitPriceCents} onChange={e => handleRowChange(i, 'unitPriceCents', e.target.value)} className={blankInputCenter} />
                                    </td>
                                    <td className="border border-black text-center text-[13px] font-bold bg-[#fcfcfc]">{row.totalPriceBirr}</td>
                                    <td className="border border-black text-center text-[11px] bg-[#fcfcfc]">{row.totalPriceCents}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="h-[36px]">
                                {/* Empty space for first 6 columns */}
                                <td colSpan={6} className="border-none"></td>
                                {/* Total label at column 7 (Quantity) */}
                                <td className="border border-black border-t-[1.5px] border-r-0 text-right pr-2 leading-tight" style={{ borderWidth: '1px', borderTopWidth: '1.5px', borderRightWidth: '0' }}>
                                    <div className="font-bold text-[13px]">ድምር</div>
                                    <div className="text-[11px] italic mt-[-2px]">Total</div>
                                </td>
                                {/* Unit Price Totals */}
                                <td className="border border-black border-t-[1.5px] text-center font-bold text-[14px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                                    {uBirr > 0 ? uBirr : ''}
                                </td>
                                <td className="border border-black border-t-[1.5px] text-center font-bold text-[12px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                                    {uCents > 0 ? uCents.toString().padStart(2, '0') : ''}
                                </td>
                                {/* Total Price Totals */}
                                <td className="border border-black border-t-[1.5px] text-center font-bold text-[15px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                                    {gBirr > 0 ? gBirr : ''}
                                </td>
                                <td className="border border-black border-t-[1.5px] text-center font-bold text-[13px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                                    {gCents > 0 ? gCents.toString().padStart(2, '0') : ''}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Row control - print hidden */}
                    <div className="flex justify-between print:hidden mb-12">
                        <button type="button" onClick={addRow} className="text-blue-600 font-bold flex items-center gap-1 hover:underline text-[12px]">
                            <FaPlus /> Add Row
                        </button>
                    </div>

                    {/* Signature Lines */}
                    <div className="flex justify-between mb-12">
                        <div className="w-[280px] text-center">
                            <p className="font-bold text-[15px]">አስረካቢው</p>
                            <p className="text-[12px] italic mb-8">Deliverer (Donor)</p>
                            <div className="border-b-[1.5px] border-black pb-1 relative h-[30px]">
                                <input type="text" value={delivererDonor} onChange={e => setDelivererDonor(e.target.value)} className="absolute inset-0 bg-transparent border-none outline-none text-center font-bold" />
                            </div>
                        </div>
                        <div className="w-[280px] text-center">
                            <p className="font-bold text-[15px]">ተረካቢው</p>
                            <p className="text-[12px] italic mb-8">Deliverer (Recipient)</p>
                            <div className="border-b-[1.5px] border-black pb-1 relative h-[30px]">
                                <input type="text" value={delivererRecipient} onChange={e => setDelivererRecipient(e.target.value)} className="absolute inset-0 bg-transparent border-none outline-none text-center font-bold" />
                            </div>
                        </div>
                    </div>

                    {/* Footer Notice Section */}
                    <div className="border-t-[1.5px] border-black pt-4">
                        <div className="flex items-start gap-4 text-[11px] leading-relaxed text-justify">
                            <span className="font-bold shrink-0 text-[13px]">ማሳሰቢያ:-</span>
                            <p>
                                ይህ ካርቲ ሦስት ኮፒ ያለው ስለሆነ ሀ/ የመጀመሪያው ኮፒ ለሂሳብ ክፍል ለ/ ሁለተኛው ለገንዘብ ወጪ ክፍል ሐ/ ሦስተኛው ዋናው ለዕቃ ገቢ ክፍል ይላካ :: ገንዘብ ከመሣሪያ ሰነድ ጋር ተያይዞ በወጪ መዝገብ ለገንዘብና ኢኮኖሚ ትብብር ሚኒስቴር ለሒሳብ ማቅረቢያ ይላካል ተያያዘ :: ያዙው ለአስረካቢ ያጣቃ :: ሦስተኛው በማይነቀል ሆኖ ከካርዱ ጋር እንደሆነ ለገባው ማስረጃ ዕቃ ግምጃ ቤት ይቀመጣል :: የዋጋው ድምር በሚለው ውስጥ በብርና ወይም በሌላ ምክንያት የተገኘ ዕቃ ወይም ንብረት የሆነ እንደሆነ ዋጋው ኤክስፐርት ተገምቶ በዋጋው ምትክ ውስጥ ይገባል ::
                            </p>
                        </div>
                        <p className="text-right text-[10px] mt-6 font-bold tracking-wider">
                            አርቲስቲክ ማተሚያ ድርጅት 000988/10
                        </p>
                    </div>
                </div>

                {/* Form Buttons */}
                <div className="mt-8 flex justify-end gap-4 print:hidden font-sans">
                    <button type="button" onClick={() => window.print()} className="px-6 py-2 bg-gray-100 border border-gray-300 text-slate-800 rounded hover:bg-gray-200 transition-colors flex items-center gap-2 font-bold shadow-sm">
                        <FaPrint /> Print Form
                    </button>
                    <button type="submit" disabled={isSubmitting} className="px-10 py-2 bg-emerald-700 text-white rounded hover:bg-emerald-800 transition-colors font-bold shadow-sm flex items-center gap-2">
                        {isSubmitting ? <FaSpinner className="animate-spin" /> : 'Save Receipt'}
                    </button>
                </div>
            </form>
        </div>
    );
}
