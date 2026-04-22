'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiSearch, FiUser, FiPackage, FiCalendar, FiClock,
    FiCheckCircle, FiChevronRight, FiArrowLeft, FiBox,
    FiActivity, FiInfo, FiTag, FiTruck, FiMapPin, FiDollarSign,
    FiLayers, FiShield, FiBriefcase, FiShoppingBag, FiMail
} from 'react-icons/fi';
const FiRole = FiShield; // Use FiShield as FiRole alias
import { getDocs, where } from 'firebase/firestore';
import Image from 'next/image';
import ReadOnlyEmployeeModel22 from './ReadOnlyEmployeeModel22';

interface ReportHistory {
    status: string;
    user: string;
    timestamp: string;
    note: string;
}

interface UserReportDocument {
    id: string;
    requestId: string;
    requesterId: string;
    requesterName: string;
    department: string;
    materialId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    unit: string;
    materialType: string;
    condition: string;
    image?: string;
    withdrawalDate: any;
    acceptedAt?: string; // String ISO format as per user sample
    approvedAt?: any;    // Timestamp
    approvedBy?: string;
    approvedByName?: string;
    createdAt?: any;     // Timestamp
    status: string;      // 'pending', 'accepted', etc.
    processedBy?: string;
    processedByName?: string;
    history?: ReportHistory[];
}

interface EmployeeSummary {
    uid: string;
    name: string;
    department: string;
    totalReports: number;
    lastReportDate: any;
    reportCount: number;
    photoURL?: string;
}

interface MaterialInventoryData {
    category: string;
    condition: string;
    createdAt: string;
    currency: string;
    description: string;
    expiryDate?: string;
    image: string;
    materialCode: string;
    materialName: string;
    materialType: string;
    purchaseDate: string;
    quantity: number;
    remarks: string;
    responsiblePerson: string;
    serialNumber: string;
    shelfNumber: string;
    storeLocation: string;
    tags: string;
    totalPrice: number;
    unit: string;
    unitPrice: number;
    vendorName: string;
}

interface EmployeeReportViewProps {
    filterType?: 'fixed' | 'consumable' | 'all';
    hidePending?: boolean;
    categorizeByType?: boolean;
    onlyAccepted?: boolean;
    userId?: string;
}

export default function EmployeeReportView({
    filterType = 'all',
    hidePending = false,
    categorizeByType = false,
    onlyAccepted = false,
    userId = ''
}: EmployeeReportViewProps) {
    const [allReports, setAllReports] = useState<UserReportDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
    const [employeeProfiles, setEmployeeProfiles] = useState<Record<string, { photoURL?: string; email?: string; role?: string; mainRole?: string }>>({});
    const [materialDetails, setMaterialDetails] = useState<Record<string, MaterialInventoryData>>({});

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

    // Filter reports based on component props
    const reports = useMemo(() => {
        return allReports.filter(report => {
            const matchesStatus = hidePending ? report.status !== 'pending' : true;

            // Apply onlyAccepted filter (Show only 'accepted' records, hide 'completed' and 'pending')
            const matchesAcceptedOnly = onlyAccepted ? report.status === 'accepted' : true;

            const matchesType = filterType === 'all' ? true :
                filterType === 'fixed' ? (report.materialType === 'fixed_asset' || report.materialType === 'fixed') :
                    filterType === 'consumable' ? (report.materialType === 'consumable_item' || report.materialType === 'consumable') : true;

            const matchesUser = userId ? report.requesterId === userId : true;

            return matchesStatus && matchesAcceptedOnly && matchesType && matchesUser;
        });
    }, [allReports, filterType, hidePending, onlyAccepted, userId]);

    // Real-time tracking of User-Report collection
    useEffect(() => {
        if (!db) return;
        const q = query(
            collection(db!, 'User-Report'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UserReportDocument[];

            setAllReports(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching User-Report:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Derive unique employees and their stats
    const employees = useMemo(() => {
        const empMap = new Map<string, EmployeeSummary>();

        reports.forEach(report => {
            if (!report.requesterId) return;

            const existing = empMap.get(report.requesterId);
            if (existing) {
                existing.totalReports += 1;
                // Update last report date if this one is newer
                const currentLast = existing.lastReportDate?.toDate?.() || new Date(0);
                const reportDate = report.createdAt?.toDate?.() || new Date(0);
                if (reportDate > currentLast) {
                    existing.lastReportDate = report.createdAt;
                }
            } else {
                empMap.set(report.requesterId, {
                    uid: report.requesterId,
                    name: report.requesterName || 'Unknown Employee',
                    department: report.department || 'General Staff',
                    totalReports: 1,
                    lastReportDate: report.createdAt,
                    reportCount: 1
                });
            }
        });

        return Array.from(empMap.values());
    }, [reports]);

    // Automatically select the specific user if userId is provided
    useEffect(() => {
        if (userId && employees.length > 0 && !selectedEmployee) {
            const mySelf = employees.find(e => e.uid === userId);
            if (mySelf) {
                setSelectedEmployee(mySelf);
            }
        }
    }, [userId, employees, selectedEmployee]);

    // Fetch material inventory details for the reports shown
    useEffect(() => {
        const fetchMaterialDetails = async () => {
            const uniqueCodes = Array.from(new Set(reports.map(r => r.materialCode).filter(Boolean)));
            const newDetails: Record<string, MaterialInventoryData> = { ...materialDetails };
            let updated = false;

            const codesToFetch = uniqueCodes.filter(code => !newDetails[code]);

            if (codesToFetch.length > 0) {
                try {
                    // Firestore 'in' query supports up to 10-30 items depending on version, 
                    // splitting into chunks of 10 for safety
                    for (let i = 0; i < codesToFetch.length; i += 10) {
                        const chunk = codesToFetch.slice(i, i + 10);
                        const q = query(
                            collection(db!, 'materials'),
                            where('materialCode', 'in', chunk)
                        );
                        const snap = await getDocs(q);
                        snap.forEach(doc => {
                            const data = doc.data() as MaterialInventoryData;
                            newDetails[data.materialCode] = data;
                            updated = true;
                        });
                    }
                } catch (e) {
                    console.error("Error fetching material details:", e);
                }
            }

            if (updated) {
                setMaterialDetails(newDetails);
            }
        };

        if (reports.length > 0) {
            fetchMaterialDetails();
        }
    }, [reports]);

    // Fetch employee profiles (avatars, emails, roles)
    useEffect(() => {
        const fetchProfiles = async () => {
            const newProfiles: Record<string, { photoURL?: string; email?: string; role?: string; mainRole?: string }> = { ...employeeProfiles };
            let updated = false;

            for (const emp of employees) {
                if (!newProfiles[emp.uid]) {
                    try {
                        const userDoc = await getDoc(doc(db!, 'users', emp.uid));
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            newProfiles[emp.uid] = {
                                photoURL: data.photoURL,
                                email: data.email,
                                role: data.userRole,
                                mainRole: data.mainRole
                            };
                            updated = true;
                        }
                    } catch (e) {
                        console.error("Error fetching profile for", emp.uid, e);
                    }
                }
            }

            if (updated) {
                setEmployeeProfiles(newProfiles);
            }
        };

        if (employees.length > 0) {
            fetchProfiles();
        }
    }, [employees]);

    const [activeTab, setActiveTab] = useState<'all' | 'academic' | 'administrative'>('all');

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.department.toLowerCase().includes(searchTerm.toLowerCase());
        
        const profile = employeeProfiles[emp.uid];
        const roleMatch = 
            activeTab === 'all' ? true :
            activeTab === 'academic' ? profile?.mainRole === 'academic_staff' :
            activeTab === 'administrative' ? profile?.mainRole === 'admin_staff' : true;

        return matchesSearch && roleMatch;
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab]);

    const employeeReports = useMemo(() => {
        if (!selectedEmployee) return [];
        return reports.filter(r => r.requesterId === selectedEmployee.uid);
    }, [reports, selectedEmployee]);

    const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string | null>(null);

    const uniqueMaterials = useMemo(() => {
        return Array.from(new Set(employeeReports.map(r => r.materialName || 'Unknown Material')));
    }, [employeeReports]);

    useEffect(() => {
        if (uniqueMaterials.length > 0 && (!selectedMaterialFilter || !uniqueMaterials.includes(selectedMaterialFilter))) {
            setSelectedMaterialFilter(uniqueMaterials[0]);
        }
    }, [uniqueMaterials, selectedMaterialFilter]);

    const filteredReportsForModel22 = useMemo(() => {
        if (!selectedMaterialFilter) return [];
        return employeeReports.filter(r => (r.materialName || 'Unknown Material') === selectedMaterialFilter);
    }, [employeeReports, selectedMaterialFilter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-700">
            <AnimatePresence mode="wait">
                {!selectedEmployee ? (
                    /* Directory View */
                    <motion.div
                        key="directory"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-4"
                    >
                        {/* Streamlined Header & Controls */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-2">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 leading-tight">
                                    Employee Directory
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    Material Withdrawal Intelligence Tracking
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                {/* Segmented Controls for Categories */}
                                <div className="flex items-center p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'academic', label: 'Academic' },
                                        { id: 'administrative', label: 'Admin' }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                activeTab === tab.id
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Compact Search */}
                                <div className="relative w-full sm:w-64">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                                    <input
                                        type="text"
                                        placeholder="Search employee or dept..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xs font-medium text-slate-700 shadow-sm h-[32px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Table View */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-slate-600 text-[10px] uppercase tracking-wider w-12 text-center">#</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600">Employee</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600">Department</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600">Role</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600 text-center">Total Items</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600 text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((emp, index) => {
                                            const profile = employeeProfiles[emp.uid];
                                            const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                            return (
                                                <tr 
                                                    key={emp.uid} 
                                                    onClick={() => setSelectedEmployee(emp)}
                                                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                                                >
                                                    <td className="px-4 py-2 text-center text-slate-400 font-mono text-xs border-r border-slate-50">
                                                        {globalIndex}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                                                {profile?.photoURL ? (
                                                                    <img src={profile.photoURL} alt={emp.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <FiUser className="text-slate-400 text-sm" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-slate-800 text-[13px]">{emp.name}</p>
                                                                {profile?.email && (
                                                                    <p className="text-[10px] text-slate-500">{profile.email}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold capitalize">
                                                            {emp.department?.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {profile?.role ? (
                                                            <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold uppercase tracking-wider">
                                                                {profile.role.replace(/_/g, ' ')}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-[11px]">Unknown Role</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full text-[11px]">
                                                            {emp.totalReports}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button className="text-indigo-600 hover:text-indigo-800 font-semibold text-[13px] flex items-center justify-end gap-1 ml-auto">
                                                            View <FiChevronRight />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredEmployees.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-12 text-center">
                                                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                                                        <FiSearch className="text-3xl text-slate-300" />
                                                        <p className="font-medium text-sm">No employees match this filter</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                                <span className="text-xs text-slate-500 font-medium">
                                    Showing {filteredEmployees.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} personnel
                                </span>
                                
                                {(() => {
                                    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
                                    return (
                                            <div className="flex items-center gap-1">
                                                {/* Previous Button */}
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                                        currentPage === 1 
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                                    }`}
                                                >
                                                    Previous
                                                </button>

                                                {/* Page Indicators (Max 3 to stay compact) */}
                                                <div className="hidden sm:flex gap-1 mx-1">
                                                    {Array.from({ length: totalPages }).map((_, idx) => {
                                                        const page = idx + 1;
                                                        // Only show first, last, current, and adjacent pages
                                                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                                            return (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => setCurrentPage(page)}
                                                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all ${
                                                                        currentPage === page 
                                                                        ? 'bg-indigo-600 text-white shadow-sm' 
                                                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                                                    }`}
                                                                >
                                                                    {page}
                                                                </button>
                                                            );
                                                        }
                                                        if (page === currentPage - 2 || page === currentPage + 2) {
                                                            return <span key={idx} className="flex items-end justify-center w-5 text-slate-400 text-xs">...</span>;
                                                        }
                                                        return null;
                                                    })}
                                                </div>

                                                {/* Next Button */}
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                                        currentPage === totalPages 
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                                    }`}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                        </div>
                    </motion.div>
                ) : (
                    /* Detailed View */
                    <motion.div
                        key="details"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        {/* Detail Header (Compact) */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6 relative">
                            <button
                                onClick={() => setSelectedEmployee(null)}
                                className="absolute top-6 right-6 p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                title="Back to Directory"
                            >
                                <FiArrowLeft className="text-xl" />
                            </button>

                            {(() => {
                                const profile = employeeProfiles[selectedEmployee.uid];
                                return (
                                    <>
                                        <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {profile?.photoURL ? (
                                                <img src={profile.photoURL} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <FiUser className="text-3xl text-slate-300" />
                                            )}
                                        </div>

                                        <div className="flex-1 text-center md:text-left space-y-3 pt-2">
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-800">
                                                    {selectedEmployee.name}
                                                </h3>
                                                {profile?.email && (
                                                    <p className="text-sm text-slate-500 flex items-center justify-center md:justify-start gap-1 mt-0.5">
                                                        <FiMail /> {profile.email}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold capitalize flex items-center gap-1.5">
                                                    <FiMapPin className="text-slate-400" /> {selectedEmployee.department?.replace(/_/g, ' ')}
                                                </span>
                                                {profile?.role && (
                                                    <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                                        <FiRole className="text-green-500" /> {profile.role.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-xs font-semibold flex items-center gap-1.5">
                                                    <FiBox className="text-indigo-400" /> {selectedEmployee.totalReports} Items
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Material Selection Tabs */}
                        {uniqueMaterials.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1">Materials History</h4>
                                <div className="flex flex-wrap gap-2">
                                    {uniqueMaterials.map(mat => (
                                        <button
                                            key={mat}
                                            onClick={() => setSelectedMaterialFilter(mat)}
                                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                                                selectedMaterialFilter === mat 
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
                                                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                                            }`}
                                        >
                                            <FiPackage className={selectedMaterialFilter === mat ? 'text-indigo-200' : 'text-slate-400'} />
                                            {mat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center text-slate-500 font-medium">
                                No material history found for this employee.
                            </div>
                        )}

                        {/* Model 22 Format Document */}
                        {uniqueMaterials.length > 0 && (
                            <div className="mt-8 overflow-hidden rounded-2xl bg-[#f0f2f5] p-8 border border-slate-200">
                                <div className="max-w-[210mm] mx-auto bg-white shadow-xl">
                                    <ReadOnlyEmployeeModel22 
                                        employeeName={selectedEmployee.name} 
                                        department={selectedEmployee.department?.replace(/_/g, ' ') || 'General'} 
                                        reports={filteredReportsForModel22} 
                                    />
                                </div>
                            </div>
                        )}


                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
