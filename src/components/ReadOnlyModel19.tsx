import React from 'react';
import { FaPrint } from 'react-icons/fa';

interface Model19Item {
    description: string;
    model?: string;
    serie?: string;
    pageFrom?: string;
    pageTo?: string;
    quantity: number;
    unitPriceBirr?: string;
    unitPriceCents?: string;
    totalPriceBirr?: string;
    totalPriceCents?: string;
    originalQuantity?: number;
    isEmpty?: boolean;
    [key: string]: unknown;
}

interface ReadOnlyModel19Props {
    receiptNo: string;
    department: string;
    recipientName?: string;
    items: Model19Item[];
    createdAt?: string;
    expenditureRegistryNo?: string;
    incomingGoodsEntryNo?: string;
    classificationOfStock?: string;
    storeNo?: string;
    shelfNo?: string;
    delivererDonor?: string;
    delivererRecipient?: string;
    fromLocation?: string;
    registeredByName?: string;
    showPrintButton?: boolean;
}

export default function ReadOnlyModel19({
    receiptNo, department, recipientName, items, createdAt,
    expenditureRegistryNo, incomingGoodsEntryNo, classificationOfStock,
    storeNo, shelfNo, delivererDonor, delivererRecipient, fromLocation,
    registeredByName, showPrintButton = true
}: ReadOnlyModel19Props) {
    const inputClasses = "absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold px-1 text-[#0033aa] font-[Kalam] w-full text-center";
    const thClasses = "border-[1.5px] border-black p-1 text-center font-bold text-[12px] leading-tight";
    const tdClasses = "border-[1.5px] border-black p-1 text-center text-[12px] h-[30px] font-bold";

    // Pad display to minimum 15 rows
    const displayRows = [...items];
    while (displayRows.length < 15) {
        displayRows.push({ description: '', quantity: 0, isEmpty: true });
    }

    // Calculate totals
    let gBirr = 0, gCents = 0;
    let uBirr = 0, uCents = 0;
    items.forEach(r => {
        gBirr += parseInt(r.totalPriceBirr || '0') || 0;
        gCents += parseInt(r.totalPriceCents || '0') || 0;
        uBirr += parseInt(r.unitPriceBirr || '0') || 0;
        uCents += parseInt(r.unitPriceCents || '0') || 0;
    });
    gBirr += Math.floor(gCents / 100); gCents = gCents % 100;
    uBirr += Math.floor(uCents / 100); uCents = uCents % 100;

    // Parse date
    let dateStr = '';
    if (createdAt) {
        try {
            const d = new Date(createdAt);
            dateStr = d.toLocaleDateString('am-ET');
        } catch { dateStr = createdAt; }
    }

    return (
        <div style={{
            background: '#FDFCF8',
            width: '100%',
            padding: '40px',
            color: '#000',
            position: 'relative',
            borderRadius: 4,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            pageBreakAfter: 'always'
        }} className="print:p-0 print:border-none print:shadow-none mb-6 printable-receipt font-serif">

            {/* Print Button */}
            {showPrintButton && (
                <div className="absolute top-4 right-4 flex gap-2 print-hide font-sans z-50">
                    <button type="button" onClick={() => window.print()} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full shadow-sm" title="Print Form">
                        <FaPrint size={18} />
                    </button>
                </div>
            )}

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
                        <div className={inputClasses}>{receiptNo}</div>
                    </div>
                </div>
            </div>

            {/* Row 2: Emblem + Gov Text | Numbered lines */}
            <div className="flex justify-between gap-8 mb-6">
                {/* Left: Emblem Area */}
                <div className="w-[450px] flex flex-col items-center justify-start mt-[-40px] shrink-0">
                    <div className="w-[70px] h-[70px] rounded-full flex items-center justify-center shrink-0 mb-3" style={{ filter: 'grayscale(1) contrast(1000%) brightness(1.1)', opacity: 0.9 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <div className="flex-1 text-[12px] space-y-4">
                    {[
                        { am: '1. ዋጋው በገንዘብ ወጪ መዝገብ የተመዘገበት ተራ ቁጥር', en: 'Item No. In Expenditure Registry', val: expenditureRegistryNo || '' },
                        { am: '2. ዕቃ ገቢ መዝገብ የገባበት ገጽ', en: 'No. of entry in the register of incoming goods', val: incomingGoodsEntryNo || '' },
                        { am: '3. ለዕቃው የተሰጠው መደብ', en: 'Classification of stock', val: classificationOfStock?.replace(/_/g, ' ') || '' },
                        { am: '4. ዕቃው የሚቀመጥበት መጋዝን ቁጥር', en: 'Store No.', val: storeNo || '' },
                        { am: '5. የመደርደሪያው ቁጥር', en: 'Shelf No.', val: shelfNo || '' },
                    ].map((item, i) => (
                        <React.Fragment key={i}>
                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">{item.am}</span>
                                <div className="flex-1 border-b border-black ml-3 h-[18px] relative">
                                    <div className="absolute inset-0 flex items-center justify-center font-[Kalam] text-[#0033aa] text-[13px] font-bold">
                                        {item.val}
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] italic pl-4 -mt-1">{item.en}</p>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Department Field */}
            <div className="relative w-[450px] mb-6">
                <div className="flex items-end">
                    <span className="text-[14px] font-bold leading-tight mr-2">የ</span>
                    <div className="flex-1 border-b border-black h-[22px] relative">
                        <div className={inputClasses}>{department?.replace(/_/g, ' ')}</div>
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
                <div className="relative">
                    <div className="flex items-end">
                        <span className="text-[14px] font-bold whitespace-nowrap mr-2 leading-tight">ስም</span>
                        <div className="w-[45%] border-b border-black h-[18px] relative">
                            <div className="absolute inset-0 bg-transparent border-none outline-none text-[14px] px-1 font-bold font-[Kalam] text-[#0033aa] text-center">
                                {recipientName || registeredByName || ''}
                            </div>
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
                        <div className="absolute inset-0 bg-transparent border-none outline-none text-center text-[14px] font-bold font-[Kalam] text-[#0033aa]">
                            {dateStr}
                        </div>
                    </div>
                    <span className="text-[14px] font-bold whitespace-nowrap leading-tight">ዓ.ም</span>

                    <span className="text-[14px] font-bold whitespace-nowrap ml-8 leading-tight">ከ</span>
                    <div className="flex-1 border-b border-black h-[18px] relative mx-2">
                        <div className="absolute inset-0 bg-transparent border-none outline-none text-[14px] px-2 font-bold font-[Kalam] text-[#0033aa] text-center">
                            {fromLocation || ''}
                        </div>
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
                        <th rowSpan={2} className={`${thClasses} w-[45px]`}>
                            <div className="font-bold">ተ.ቁ</div>
                            <div className="text-[9px] italic leading-tight">Serial<br />No.</div>
                        </th>
                        <th rowSpan={2} className={`${thClasses} min-w-[250px]`}>
                            <div className="font-bold text-center">የዕቃው ወይም የንብረት ዓይነት ዝርዝር</div>
                            <div className="text-[10px] italic text-center">Detailed Description of Articles or Property</div>
                        </th>
                        <th rowSpan={2} className={`${thClasses} w-[60px]`}>
                            <div className="font-bold">ሞዴል</div>
                            <div className="text-[9px] italic">Model</div>
                        </th>
                        <th rowSpan={2} className={`${thClasses} w-[50px]`}>
                            <div className="font-bold">ሴሪ</div>
                            <div className="text-[9px] italic">Serie</div>
                        </th>
                        <th colSpan={2} className={`${thClasses}`}>
                            <div className="font-bold">ተከታታይ ገ.</div>
                            <div className="text-[9px] italic mt-[-2px]">Page No.</div>
                        </th>
                        <th rowSpan={2} className={`${thClasses} w-[60px]`}>
                            <div className="font-bold">ብዛት</div>
                            <div className="text-[9px] italic">Quantity</div>
                        </th>
                        <th colSpan={2} className={`${thClasses}`}>
                            <div className="font-bold">የአንዱ ዋጋ</div>
                            <div className="text-[9px] italic mt-[-2px]">Unit price</div>
                        </th>
                        <th colSpan={2} className={`${thClasses}`}>
                            <div className="font-bold">የዋጋው ድምር</div>
                            <div className="text-[9px] italic mt-[-2px]">Total price</div>
                        </th>
                    </tr>
                    <tr className="h-[35px]">
                        <th className={`${thClasses} w-[35px]`}>
                            <div className="font-bold">ከ</div>
                            <div className="text-[9px] italic mt-[-2px]">From</div>
                        </th>
                        <th className={`${thClasses} w-[35px]`}>
                            <div className="font-bold">እስከ</div>
                            <div className="text-[9px] italic mt-[-2px]">To</div>
                        </th>
                        <th className={`${thClasses} w-[50px]`}>
                            <div className="font-bold">ብር</div>
                            <div className="text-[9px] italic mt-[-2px]">Birr</div>
                        </th>
                        <th className={`${thClasses} w-[30px]`}>
                            <div className="font-bold">ሳ</div>
                            <div className="text-[9px] italic mt-[-2px]">C</div>
                        </th>
                        <th className={`${thClasses} w-[50px]`}>
                            <div className="font-bold">ብር</div>
                            <div className="text-[9px] italic mt-[-2px]">Birr</div>
                        </th>
                        <th className={`${thClasses} w-[30px]`}>
                            <div className="font-bold">ሳ</div>
                            <div className="text-[9px] italic mt-[-2px]">C</div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {displayRows.map((row, idx) => {
                        if (row.isEmpty) {
                            return (
                                <tr key={idx} className="h-[26px]">
                                    <td className={tdClasses}>{idx + 1}</td>
                                    <td className={`${tdClasses} text-left px-2`}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                    <td className={tdClasses}></td>
                                </tr>
                            );
                        }

                        return (
                            <tr key={idx} className="h-[26px]">
                                <td className={tdClasses}>{idx + 1}</td>
                                <td className={`${tdClasses} text-left px-2`}>
                                    <span className="font-[Kalam] text-[15px]">{row.description}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#0033aa] text-[15px]">{row.model || ''}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#0033aa] text-[15px]">{row.serie || ''}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#0033aa] text-[13px]">{row.pageFrom || ''}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#0033aa] text-[13px]">{row.pageTo || ''}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[17px] font-bold">{row.quantity}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#0033aa] text-[15px]">{row.unitPriceBirr || ''}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#0033aa] text-[12px]">{row.unitPriceCents && row.unitPriceCents !== '00' ? row.unitPriceCents : ''}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#e11d48] text-[15px] font-bold">{row.totalPriceBirr || ''}</span>
                                </td>
                                <td className={tdClasses}>
                                    <span className="font-[Kalam] text-[#e11d48] text-[12px] font-bold">{row.totalPriceCents && row.totalPriceCents !== '00' ? row.totalPriceCents : ''}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="h-[36px]">
                        <td colSpan={6} className="border-none"></td>
                        <td className="border border-black border-t-[1.5px] text-right pr-2 leading-tight" style={{ borderWidth: '1px', borderTopWidth: '1.5px', borderRightWidth: '0' }}>
                            <div className="font-bold text-[13px]">ድምር</div>
                            <div className="text-[11px] italic mt-[-2px]">Total</div>
                        </td>
                        <td className="border border-black border-t-[1.5px] text-center font-bold text-[14px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                            {uBirr > 0 ? uBirr : ''}
                        </td>
                        <td className="border border-black border-t-[1.5px] text-center font-bold text-[12px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                            {uCents > 0 ? uCents.toString().padStart(2, '0') : ''}
                        </td>
                        <td className="border border-black border-t-[1.5px] text-center font-bold text-[15px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                            <span className="font-[Kalam] text-[#e11d48]">{gBirr > 0 ? gBirr.toLocaleString() : ''}</span>
                        </td>
                        <td className="border border-black border-t-[1.5px] text-center font-bold text-[13px]" style={{ borderWidth: '1px', borderTopWidth: '1.5px' }}>
                            <span className="font-[Kalam] text-[#e11d48]">{gCents > 0 ? gCents.toString().padStart(2, '0') : ''}</span>
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Signatures Section */}
            <div className="mt-8 flex justify-between px-10">
                <div className="flex flex-col items-center">
                    <span className="w-[180px] border-b-[1.5px] border-black block h-[60px]"></span>
                    <span className="text-[14px] font-[Kalam] text-[#0033aa] mt-0.5 leading-none mb-1">{delivererDonor || ''}</span>
                    <span className="font-bold text-[13px] mt-1">የሰጪው ፊርማ</span>
                    <span className="italic text-[11px]">Deliverer&apos;s / Donor&apos;s Signature</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="w-[180px] border-b-[1.5px] border-black block h-[60px]"></span>
                    <span className="text-[14px] font-[Kalam] text-[#0033aa] mt-0.5 leading-none mb-1">{delivererRecipient || recipientName || registeredByName || ''}</span>
                    <span className="font-bold text-[13px] mt-1">የተቀባይ ፊርማ</span>
                    <span className="italic text-[11px]">Recipient&apos;s Signature</span>
                </div>
            </div>

            {/* Instructional Texts */}
            <div className="mt-12 px-6 space-y-6">
                <div className="text-[12px] leading-relaxed text-justify border-t border-black pt-4">
                    <span className="font-bold block mb-2 underline">ማመልከቻ</span>
                    <p>ይህ ካርኒ በ፫ ኮፒ ሆኖ በካርቦን ይሠራል :: ከነዚሁም ሁለቱ ተጐራጅ ሆነው ለኛው በክፍሉ መሥሪያ ቤት ሒሳብ ቤት አማካይነት የገንዘብ ሚኒስቴር ጠቅላይ ሒሳብ ቤት ለዕቃ መቆጣጠሪያ ክፍል ይተላለፋል ። ፪ኛው ለዕቃ ወጪ መዝገብ ማስተካከያ ሰነድ እንዲሆነው ለክፍሉ ሒሳብ ቤት ይሰጠዋል ። ፫ኛው ኮፒ ሳይጐረድ እንዳለ ሆኖ የዕቃ ግምጃ ቤት ዕቃውን በትእዛዝ ያወጣው መሆኑን ለመርማሪ ለማስረዳት እንዲችል ከማዘዣው ጋር በሙጫ አያይዞ እንዲኖር ያደርጋል ።</p>
                </div>

                <div className="text-[12px] leading-relaxed text-justify border-t border-black pt-4">
                    <span className="font-bold block mb-2 underline">ማስጠቀቂያ</span>
                    <p>መደባቸው አንድ ዓይነት ለሆኑና ተቀባያቸው አንድ ሰው ብቻ ለሆኑ ልዩ ልዩ ዕቃዎች አንድ አንድ ቅጠል ይበቃል ። መደባቸው ሲለያይ ግን ለየራሳቸው አንዳንድ ደረሰኝ ሊጻፍላቸው ይችላል ። ይኸውም በየመደቡ እየለዩ ለማኖር እንዲመች ነው ። በዋጋው ድምር መጻፊያ ዓምድ ውስጥ የተመለከተው በውርስ ወይም በሌላ ምክንያት የተገኘ ዕቃ ወይም ንብረት የሆነ እንደሆነ ዋጋው በኤክስፐርት ተገምቶ ግምቱ በዋጋው ዓምድ ውስጥ ይገባል ።</p>
                </div>
            </div>
        </div>
    );
}
