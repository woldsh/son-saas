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
    [key: string]: any;
}

interface EmployeeSummary {
    uid: string;
    name: string;
    department: string;
    totalReports: number;
    lastReportDate: any;
    reportCount: number;
    photoURL?: string;
    materialNames: string[];
    itemsBreakdown: Record<string, number>;
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
    items?: any[];
    expenditureRegistryNo?: string;
    receiptNo?: string;
    incomingGoodsEntryNo?: string;
    classificationOfStock?: string;
    storeNo?: string;
    shelfNo?: string;
    outgoingGoodsEntryNo?: string;
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
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');

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

    const employees = useMemo(() => {
        const empMap = new Map<string, EmployeeSummary>();

        reports.forEach(report => {
            if (!report.requesterId) return;

            const existing = empMap.get(report.requesterId);
            const qty = Number(report.quantity) || 1;
            const matName = report.materialName || 'Unknown Material';

            if (existing) {
                existing.totalReports += 1;
                if (!existing.materialNames.includes(matName)) {
                    existing.materialNames.push(matName);
                }

                // Track item counts
                existing.itemsBreakdown[matName] = (existing.itemsBreakdown[matName] || 0) + qty;

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
                    reportCount: 1,
                    materialNames: [matName],
                    itemsBreakdown: { [matName]: qty }
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
            if (!db) return;

            try {
                // To be robust, we fetch all unique materials once. 
                // In a larger system, we'd be more selective, but for this form, 
                // we need to ensure we find the inventory metadata (store no, shelf no, etc.)
                const materialsSnap = await getDocs(collection(db!, 'materials'));
                const newDetails: Record<string, MaterialInventoryData> = {};

                materialsSnap.forEach(doc => {
                    const data = doc.data() as MaterialInventoryData;
                    // Index by materialCode for direct lookup
                    if (data.materialCode) {
                        newDetails[data.materialCode] = data;
                    }
                    // Index by top-level name
                    if (data.materialName) {
                        newDetails[data.materialName.trim().toLowerCase()] = data;
                    }
                    // Index by sub-item names (Model 19 structure)
                    const matAny = data as any;
                    if (matAny.items && Array.isArray(matAny.items)) {
                        matAny.items.forEach((subItem: any) => {
                            const subName = subItem.description || subItem.materialName;
                            if (subName) {
                                newDetails[subName.trim().toLowerCase()] = data; // Link sub-item name to parent doc
                            }
                        });
                    }
                });

                setMaterialDetails(prev => ({ ...prev, ...newDetails }));
            } catch (e) {
                console.error("Error fetching material details:", e);
            }
        };

        fetchMaterialDetails();
    }, []); // Run once on mount to cache material info

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
        const term = searchTerm.toLowerCase();
        const matchesSearch =
            emp.name.toLowerCase().includes(term) ||
            emp.department.toLowerCase().includes(term) ||
            emp.materialNames.some(m => m.toLowerCase().includes(term));

        const profile = employeeProfiles[emp.uid];
        const roleStr = profile?.role || '';
        const isAcademic = roleStr === 'academic_coordinator' || roleStr.endsWith('_teacher') || roleStr.endsWith('_head');

        const roleMatch =
            activeTab === 'all' ? true :
                activeTab === 'academic' ? isAcademic :
                    activeTab === 'administrative' ? !isAcademic : true;

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
        <div className="max-w-[1600px] mx-auto p-2 md:p-4 space-y-4 animate-in fade-in duration-700">
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
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 leading-tight">
                                    Employee Directory
                                </h2>
                                <p className="text-xs text-slate-500 mt-1 font-medium text-indigo-600">
                                    Material Withdrawal Intelligence Tracking
                                </p>
                            </div>

                            {/* Prominent Search */}
                            <div className="relative w-full lg:w-96">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 text-base" />
                                <input
                                    type="text"
                                    placeholder="Search name, department, or material name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-semibold text-slate-700 shadow-sm"
                                />
                            </div>
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
                                        className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === tab.id
                                            ? 'bg-white text-indigo-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
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
                                                        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[250px] mx-auto">
                                                            {Object.entries(emp.itemsBreakdown).slice(0, 3).map(([name, qty]) => (
                                                                <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 whitespace-nowrap">
                                                                    {qty} {name}
                                                                </span>
                                                            ))}
                                                            {Object.keys(emp.itemsBreakdown).length > 3 && (
                                                                <span className="text-[10px] text-slate-400 font-medium italic">
                                                                    +{Object.keys(emp.itemsBreakdown).length - 3} more
                                                                </span>
                                                            )}
                                                        </div>
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
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currentPage === 1
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
                                                                className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all ${currentPage === page
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
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currentPage === totalPages
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
                        className="space-y-4"
                    >
                        {/* Detail Header (Condensed) */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-5 relative">
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
                                        <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {profile?.photoURL ? (
                                                <img src={profile.photoURL} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <FiUser className="text-2xl text-slate-300" />
                                            )}
                                        </div>

                                        <div className="flex-1 text-center md:text-left space-y-2 pt-1">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800">
                                                    {selectedEmployee.name}
                                                </h3>
                                                {profile?.email && (
                                                    <p className="text-xs text-slate-500 flex items-center justify-center md:justify-start gap-1 mt-0.5">
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
                                                    <FiBox className="text-indigo-400" /> {Object.values(selectedEmployee.itemsBreakdown).reduce((a, b) => a + b, 0)} Total Items
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Material Selection & Search */}
                        {uniqueMaterials.length > 0 ? (
                            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 px-2 border-r border-slate-100 hidden md:flex">
                                    <FiPackage className="text-indigo-500 text-lg" />
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        Material View:
                                    </h4>
                                </div>

                                <select
                                    value={selectedMaterialFilter || ''}
                                    onChange={(e) => setSelectedMaterialFilter(e.target.value)}
                                    className="w-full md:w-80 bg-white border-2 border-indigo-50 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="">Select a material to view Model 22...</option>
                                    {uniqueMaterials
                                        .filter(mat => mat.toLowerCase().includes(materialSearchTerm.toLowerCase()))
                                        .map(mat => (
                                            <option key={mat} value={mat}>{mat}</option>
                                        ))}
                                </select>

                                {/* Search Materials within Employee */}
                                <div className="relative flex-1">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search materials..."
                                        value={materialSearchTerm}
                                        onChange={(e) => setMaterialSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    />
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
                                        materialDetails={materialDetails}
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
