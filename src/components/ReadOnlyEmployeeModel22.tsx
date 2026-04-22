import React from 'react';
import { FaPrint } from 'react-icons/fa';

interface ReportItem {
    materialName?: string;
    quantity?: number;
    status?: string;
    isEmpty?: boolean;
    [key: string]: unknown;
}

interface ReadOnlyEmployeeModel22Props {
    employeeName: string;
    department: string;
    reports: ReportItem[];
}

export default function ReadOnlyEmployeeModel22({ employeeName, department, reports }: ReadOnlyEmployeeModel22Props) {
    const inputClasses = "absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold px-1 text-[#0033aa] font-[Kalam] w-full text-center";
    const thClasses = "border-[1.5px] border-black p-1 text-center font-bold text-[12px] leading-tight";
    const tdClasses = "border-[1.5px] border-black p-1 text-center text-[12px] h-[30px] font-bold";

    // Group reports by materialName
    const groupedReports = reports.reduce((acc, report) => {
        const name = report.materialName || 'Unknown Material';
        if (!acc[name]) {
            acc[name] = [];
        }
        acc[name].push(report);
        return acc;
    }, {} as Record<string, ReportItem[]>);

    return (
        <div className="flex flex-col gap-12 font-serif relative">
            <div className="absolute top-4 right-4 flex gap-2 print-hide font-sans z-50">
                <button type="button" onClick={() => window.print()} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full shadow-sm" title="Print Forms">
                    <FaPrint size={18} />
                </button>
            </div>

            {Object.entries(groupedReports).map(([, materialReports], formIdx) => {
                const displayRows = [...materialReports];
                while (displayRows.length < 6) {
                    displayRows.push({ isEmpty: true });
                }

                return (
                    <div key={formIdx} style={{
                        background: '#FDFCF8',
                        width: '100%',
                        padding: '40px',
                        color: '#000',
                        position: 'relative',
                        borderRadius: 4,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        pageBreakAfter: 'always'
                    }} className="print:p-0 print:border-none print:shadow-none mb-6 printable-receipt">

                        {/* Row 1: Headers */}
                        <div className="flex justify-between items-start mb-4 w-full">
                            <div className="w-[150px]">
                                <p className="text-[14px] font-bold leading-tight">ሞዴል ፳፪</p>
                                <p className="text-[12px] italic">Model 22</p>
                            </div>
                            <div className="flex flex-col items-center ml-20">
                                <div className="flex items-center gap-2 text-[20px] font-black">
                                    <span className="italic">No.</span>
                                    <span className="font-[Kalam] text-[#0033aa]">------</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[14px] font-bold leading-tight mr-16">ሴሪ ሀ/2ኛ</p>
                                <p className="text-[12px] italic mr-16">Serial B-2nd</p>
                            </div>
                        </div>

                        {/* Row 2: Emblem and Numbered Info List */}
                        <div className="flex justify-between gap-8 mb-6">
                            <div className="w-[400px] flex flex-col items-center justify-start mt-[-20px] shrink-0">
                                <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0 mb-3" style={{ filter: 'grayscale(1) contrast(1000%) brightness(1.1)', opacity: 0.9 }}>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/3f/Emblem_of_Ethiopia.svg" alt="Emblem of Ethiopia" className="w-full h-full object-contain" />
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
                                    { am: '1. ገንዘብ ወጪ መዝገብ የተመዘገበት ተራ ቁጥር', en: 'Item No. in Expenditure Registery' },
                                    { am: '2. ዕቃ ገቢ መዝገብ የገባበት ገጽ', en: 'No. of entry in the register of incoming goods' },
                                    { am: '3. ዕቃው የተሰጠው መደብ', en: 'Classification of Stock' },
                                    { am: '4. ዕቃው የተቀመጠበት መጋዘን ቁጥር', en: 'Store No.' },
                                    { am: '5. የመደርደሪያው ቁጥር', en: 'Shelf No.' },
                                    { am: '6. ዕቃው የወጣበት የወጪ መዝገብ የተመዘገበት ተራ ቁጥር', en: 'No. of entry in the register of outgoing goods' }
                                ].map((item, i) => (
                                    <React.Fragment key={i}>
                                        <div className="flex items-end">
                                            <span className="shrink-0 whitespace-nowrap">{item.am}</span>
                                            <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative"></div>
                                        </div>
                                        <p className="text-[9px] italic pl-4 -mt-1 font-normal">{item.en}</p>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* Main Title Section */}
                        <div className="text-center mb-6 relative">
                            <p className="text-[20px] font-bold tracking-[0.2em] mb-1">የዕቃ &nbsp;&nbsp;ወይም &nbsp;&nbsp;የንብረት &nbsp;&nbsp;ወጪ &nbsp;&nbsp;ደረሰኝ</p>
                            <p className="text-[13px] font-bold tracking-[0.05em] border-b-[1.5px] border-black pb-0.5 inline-block">RECEIPT FOR ARTICLES OR PROPERTY ISSUED</p>
                        </div>

                        {/* Sentence block */}
                        <div className="text-[13px] leading-[26px] mb-8 font-semibold w-full pr-4 text-justify">
                            <div className="flex items-baseline flex-wrap">
                                <span>እኔ</span>
                                <span className="w-[30%] border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center">{employeeName}</span>
                                <span className="ml-[2%]">ቀን</span>
                                <span className="w-[10%] border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center">{new Date().getDate()}</span>
                                <span>ዓ.ም በቁጥር</span>
                                <span className="flex-1 border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center ml-2"></span>
                            </div>
                            <div className="flex justify-between text-[11px] font-normal italic -mt-2">
                                <span className="ml-10">In accordance with the</span>
                                <span className="ml-[35%]">order No.</span>
                                <span className="mr-[15%]">dated of</span>
                            </div>

                            <div className="flex items-baseline mt-2">
                                <span>መሰረት ቀጥሎ በዝርዝር የተፃፉትን ዕቃዎች ለ</span>
                                <span className="flex-1 border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center mx-2 relative h-[20px]">
                                    {department}
                                </span>
                                <span>አገልግሎት በትክክል</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-normal italic -mt-2">
                                <span>20&nbsp;<span className="inline-block w-[30px] border-b border-black text-[#0033aa] text-[14px] text-center -mb-2">{String(new Date().getFullYear()).substring(2)}</span> here by certify that I have counted correctly and received the articles enumerated below for the use of</span>
                            </div>

                            <div>
                                <span>ቆጥሬ መረከቤን በፊርማየ አረጋግጣለሁ፡፡</span>
                            </div>
                        </div>

                        {/* Table */}
                        <table className="w-full border-collapse border-[1.5px] border-black mb-10">
                            <thead>
                                <tr>
                                    <th rowSpan={2} className={`${thClasses} w-[40px]`}>ተ.ቁ<br /><span className="text-[9px] font-normal italic">Serial<br />No.</span></th>
                                    <th rowSpan={2} className={`${thClasses} w-[300px]`}>የዕቃው ወይም የንብረት<br />ዓይነት ዝርዝር<br /><span className="text-[9px] font-normal italic">Detailed Description of Articles<br />or property</span></th>
                                    <th rowSpan={2} className={`${thClasses} w-[60px]`}>ሞዴል<br /><span className="text-[9px] font-normal italic">Model</span></th>
                                    <th colSpan={2} className={`${thClasses}`}>ተከታታይ ቁጥር<br /><span className="text-[9px] font-normal italic">Serial</span></th>
                                    <th rowSpan={2} className={`${thClasses} w-[60px]`}>ብዛት<br /><span className="text-[9px] font-normal italic">Quantity</span></th>
                                    <th colSpan={2} className={`${thClasses}`}>ያንዱ ዋጋ<br /><span className="text-[9px] font-normal italic">Unit Price</span></th>
                                    <th colSpan={2} className={`${thClasses}`}>የዋጋ ድምር<br /><span className="text-[9px] font-normal italic">Total Price</span></th>
                                    <th rowSpan={2} className={`${thClasses} w-[70px]`}>ምርመራ<br /><span className="text-[9px] font-normal italic">Remarks</span></th>
                                </tr>
                                <tr>
                                    <th className={`${thClasses} w-[45px]`}>ከ<br /><span className="text-[9px] font-normal italic">From</span></th>
                                    <th className={`${thClasses} w-[45px]`}>እስከ<br /><span className="text-[9px] font-normal italic">To</span></th>
                                    <th className={`${thClasses} w-[45px]`}>ብር<br /><span className="text-[9px] font-normal italic">Birr</span></th>
                                    <th className={`${thClasses} w-[20px] p-0`}>ሳ<br /><span className="text-[9px] font-normal italic text-[#000]">C.</span></th>
                                    <th className={`${thClasses} w-[45px]`}>ብር<br /><span className="text-[9px] font-normal italic">Birr</span></th>
                                    <th className={`${thClasses} w-[20px] p-0`}>ሳ<br /><span className="text-[9px] font-normal italic text-[#000]">C.</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRows.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className={tdClasses}>{idx + 1}</td>
                                        <td className={`${tdClasses} text-left px-2`}>
                                            <span className="font-[Kalam] text-[15px]">{row.isEmpty ? '' : row.materialName}</span>
                                        </td>
                                        <td className={tdClasses}>
                                            <span className="font-[Kalam] text-[#0033aa] text-[15px]">{row.isEmpty ? '' : ''}</span>
                                        </td>
                                        <td className={tdClasses}></td>
                                        <td className={tdClasses}></td>
                                        <td className={tdClasses}>
                                            <span className="font-[Kalam] text-[17px] font-bold">{row.isEmpty ? '' : row.quantity}</span>
                                        </td>
                                        <td className={tdClasses}></td>
                                        <td className={tdClasses}></td>
                                        <td className={tdClasses}></td>
                                        <td className={tdClasses}></td>
                                        <td className={tdClasses}>
                                            <span className="font-[Kalam] text-[#0033aa] text-[13px]">{row.isEmpty ? '' : row.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Signatures Section */}
                        <div className="flex justify-between mt-12 px-10">
                            <div className="flex flex-col items-center">
                                <span className="w-[180px] border-b-[1.5px] border-black block"></span>
                                <span className="font-bold text-[13px] mt-1">የግምጃ ቤቱ ፊርማ</span>
                                <span className="italic text-[11px]">Store Keeper's Signature</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="w-[180px] border-b-[1.5px] border-black block"></span>
                                <span className="font-bold text-[13px] mt-1">የተቀባይ ፊርማ</span>
                                <span className="italic text-[11px]">Recipient's Signature</span>
                            </div>
                        </div>

                    </div>
                );
            })}
        </div>
    );
}
