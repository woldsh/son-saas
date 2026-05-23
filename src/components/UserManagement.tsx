'use client';
import { updateDocWithAudit, deleteDocWithAudit } from '@/utils/auditTrail';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs,  doc,  orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { FiUsers, FiSearch, FiTrash2, FiAlertTriangle, FiCheckCircle, FiChevronRight, FiChevronLeft, FiFilter, FiUser, FiCheck, FiX, FiActivity, FiEdit2, FiBookOpen, FiUserCheck, FiDownload } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UserData {
    uid: string;
    displayName: string;
    email: string;
    username?: string;
    password?: string;
    userRole: string;
    mainRole: string;
    department?: string;
    status?: 'active' | 'inactive';
    createdAt?: any;
}

export default function UserManagement() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [editForm, setEditForm] = useState({
        displayName: '',
        email: '',
        username: '',
        password: ''
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'academic' | 'admin' | 'procurement' | 'executive'>('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ROWS_PER_PAGE = 8;

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            if (!db) return;
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const userData = querySnapshot.docs.map(doc => ({
                status: 'active', // Default fallback
                ...doc.data(),
                uid: doc.id
            } as UserData));
            setUsers(userData);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserStatus = async (uid: string, currentStatus: string | undefined) => {
        const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
        setUpdatingStatusId(uid);
        try {
            if (!db) return;
            const userRef = doc(db, 'users', uid);
            await updateDocWithAudit(userRef, { status: newStatus });
            setUsers(users.map(u => u.uid === uid ? { ...u, status: newStatus } : u));
            setNotification({ type: 'success', message: `${t('personnel_identity')} status updated to ${newStatus.toUpperCase()}.` });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            console.error("Error updating status:", error);
            setNotification({ type: 'error', message: 'Failed to update personnel status.' });
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleDelete = async (uid: string) => {
        setDeletingId(uid);
        try {
            if (!db) return;
            await deleteDocWithAudit(doc(db, 'users', uid));
            setUsers(users.filter(u => u.uid !== uid));
            setNotification({ type: 'success', message: 'User deleted successfully from Firestore.' });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            console.error("Error deleting user:", error);
            setNotification({ type: 'error', message: 'Failed to delete user.' });
        } finally {
            setDeletingId(null);
            setConfirmDelete(null);
        }
    };

    const handleEditClick = (user: UserData) => {
        setEditingUser(user);
        setEditForm({
            displayName: user.displayName || '',
            email: user.email || '',
            username: user.username || '',
            password: '' // Don't show password
        });
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setIsUpdating(true);
        try {
            const response = await fetch('/api/auth/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: editingUser.uid,
                    displayName: editForm.displayName,
                    email: editForm.email,
                    username: editForm.username,
                    password: editForm.password || undefined // Only send if not empty
                }),
            });

            const result = await response.json();
            if (result.success) {
                setUsers(users.map(u => u.uid === editingUser.uid ? {
                    ...u,
                    displayName: editForm.displayName,
                    email: editForm.email,
                    username: editForm.username
                } : u));
                setNotification({ type: 'success', message: 'Personnel record updated successfully.' });
                setEditingUser(null);
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            console.error("Error updating user:", error);
            setNotification({ type: 'error', message: error.message || 'Failed to update personnel record.' });
        } finally {
            setIsUpdating(false);
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const getComputedDepartment = (user: UserData): string => {
        // If department is explicitly set (like Academic Staff), return it
        if (user.department) return user.department;

        // For Admin Staff, department is typically embedded in userRole
        if (user.mainRole === 'admin_staff' && user.userRole) {
            if (user.userRole.endsWith('_leader')) {
                return user.userRole.replace('_leader', '');
            }
            if (user.userRole.endsWith('_employee')) {
                return user.userRole.replace('_employee', '');
            }
            // Handle specific sub-categories like student_service
            if (user.userRole.startsWith('student_service_')) {
                return 'student_service';
            }
        }

        // Group Procurement and Store operations
        if (user.mainRole === 'procurement_management') {
            return 'procurement_and_stores';
        }

        // Group Executives
        if (user.mainRole === 'managing_director' || user.mainRole === 'chief') {
            return 'executive_management';
        }

        return 'global';
    };

    const exportToCSV = () => {
        if (filteredUsers.length === 0) {
            setNotification({ type: 'error', message: 'No records to export.' });
            return;
        }

        const headers = ['Full Name', 'Username', 'Email', 'Role', 'Department', 'Status'];
        const csvRows = [headers.join(',')];

        filteredUsers.forEach(user => {
            const row = [
                `"${user.displayName || ''}"`,
                `"${user.username || ''}"`,
                `"${user.email || ''}"`,
                `"${(user.userRole || '').replace(/_/g, ' ')}"`,
                `"${getComputedDepartment(user).replace(/_/g, ' ')}"`,
                `"${user.status || 'active'}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `DMU_Directory_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setNotification({ type: 'success', message: 'CSV export downloaded successfully.' });
        setTimeout(() => setNotification(null), 3000);
    };

    const exportToPDF = () => {
        if (filteredUsers.length === 0) {
            setNotification({ type: 'error', message: 'No records to export.' });
            return;
        }

        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(30, 27, 75); // Dark Indigo
        doc.text('DMU Burie Campus - Personnel Directory', 14, 22);

        // Subheader
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
        doc.text(`Total Records: ${filteredUsers.length}`, 14, 36);

        const tableColumn = ['Name', 'Username', 'Email', 'Role', 'Department'];
        const tableRows: any[] = [];

        filteredUsers.forEach(user => {
            const rowData = [
                user.displayName || '-',
                user.username || '-',
                user.email || '-',
                (user.userRole || '-').replace(/_/g, ' '),
                getComputedDepartment(user).replace(/_/g, ' ')
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 42,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        });

        doc.save(`DMU_Directory_Export_${new Date().toISOString().split('T')[0]}.pdf`);

        setNotification({ type: 'success', message: 'PDF export downloaded successfully.' });
        setTimeout(() => setNotification(null), 3000);
    };

    const uniqueDepartments = Array.from(new Set(users.map(u => getComputedDepartment(u)).filter(d => d !== 'global'))) as string[];

    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (user.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (user.userRole?.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (filterType === 'academic' && user.mainRole !== 'academic_staff') return false;
        if (filterType === 'admin' && user.mainRole !== 'admin_staff') return false;
        if (filterType === 'procurement' && user.mainRole !== 'procurement_management') return false;
        if (filterType === 'executive' && (user.mainRole !== 'managing_director' && user.mainRole !== 'chief')) return false;

        if (departmentFilter !== 'all' && getComputedDepartment(user) !== departmentFilter) return false;

        return true;
    });

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, departmentFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

    return (
        <div className="w-full max-w-6xl mx-auto space-y-1.5">
            {/* Header & Search - single compact row */}
            <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg">
                <h2 className="text-sm font-semibold text-gray-900 mr-1">{t('employee_directory')}</h2>

                {/* Export Buttons */}
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50 hover:text-blue-600 transition-colors"
                    title="Export to CSV"
                >
                    <FiDownload className="w-3 h-3" />
                    CSV
                </button>
                <button
                    onClick={exportToPDF}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50 hover:text-blue-600 transition-colors"
                    title="Export to PDF"
                >
                    <FiDownload className="w-3 h-3" />
                    PDF
                </button>

                {/* Department Filter */}
                <div className="relative">
                    <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="pl-2 pr-6 py-1 appearance-none border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 bg-white capitalize"
                    >
                        <option value="all">All Departments</option>
                        {uniqueDepartments.map(dept => (
                            <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
                        ))}
                        <option value="global">Global / Other</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                        <FiFilter className="w-3 h-3" />
                    </div>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[160px] max-w-xs ml-auto">
                    <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <input
                        type="text"
                        placeholder={t('search_personnel_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-7 pr-3 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                </div>
            </div>

            {/* Filter Tabs - compact single row */}
            <div className="flex gap-1 bg-white px-2 py-1 border border-gray-200 rounded-lg overflow-x-auto">
                {[
                    { id: 'all', label: t('all_personnel'), icon: FiUsers },
                    { id: 'executive', label: 'Executive', icon: FiActivity },
                    { id: 'academic', label: t('academic_staff'), icon: FiBookOpen },
                    { id: 'admin', label: t('admin_staff'), icon: FiUserCheck },
                    { id: 'procurement', label: 'Procurement & Stores', icon: FiSearch }
                ].map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => setFilterType(filter.id as any)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${filterType === filter.id
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <filter.icon className={`w-3 h-3 ${filterType === filter.id ? 'text-blue-500' : 'text-gray-400'}`} />
                        {filter.label}
                        <span className={`ml-0.5 px-1.5 py-px rounded-full text-[10px] ${filterType === filter.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                            {filter.id === 'all' ? users.filter(u => departmentFilter === 'all' || getComputedDepartment(u) === departmentFilter).length :
                                filter.id === 'executive' ? users.filter(u => (u.mainRole === 'managing_director' || u.mainRole === 'chief') && (departmentFilter === 'all' || getComputedDepartment(u) === departmentFilter)).length :
                                    filter.id === 'procurement' ? users.filter(u => u.mainRole === 'procurement_management' && (departmentFilter === 'all' || getComputedDepartment(u) === departmentFilter)).length :
                                        filter.id === 'academic' ? users.filter(u => u.mainRole === 'academic_staff' && (departmentFilter === 'all' || getComputedDepartment(u) === departmentFilter)).length :
                                            users.filter(u => u.mainRole === 'admin_staff' && (departmentFilter === 'all' || getComputedDepartment(u) === departmentFilter)).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Notification */}
            {notification && (
                <div className={`p-4 rounded-lg flex items-center gap-3 text-sm border ${notification.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {notification.type === 'success' ? <FiCheckCircle className="text-lg shrink-0" /> : <FiAlertTriangle className="text-lg shrink-0" />}
                    {notification.message}
                </div>
            )}

            {/* Users List */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                            <tr>
                                <th className="px-3 py-4 font-medium text-center w-10">#</th>
                                <th className="px-6 py-4 font-medium">{t('personnel_identity')}</th>
                                <th className="px-6 py-4 font-medium">{t('institutional_role')}</th>
                                <th className="px-6 py-4 font-medium">{t('account_status')}</th>
                                <th className="px-6 py-4 font-medium text-right">{t('access_protocol')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex justify-center mb-2">
                                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                        </div>
                                        <p>{t('syncing_employees')}...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <FiUsers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                        <p>No matching personnel records found.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user, index) => (
                                    <tr key={user.uid} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-3 py-4 text-center text-xs text-gray-400 font-medium">
                                            {(currentPage - 1) * ROWS_PER_PAGE + index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                                                    <FiUser />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{user.displayName}</p>
                                                    <p className="text-gray-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="text-gray-900 capitalize">{user.userRole?.replace(/_/g, ' ')}</p>
                                                <p className="text-gray-500 text-xs capitalize mt-0.5">
                                                    {user.department?.replace(/_/g, ' ') || user.mainRole?.replace(/_/g, ' ') || 'Global'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.status === 'inactive' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'inactive' ? 'bg-red-500' : 'bg-green-500'}`} />
                                                {user.status === 'inactive' ? t('deactivated') : t('authorized')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end items-center gap-2">
                                                <button
                                                    onClick={() => toggleUserStatus(user.uid, user.status)}
                                                    disabled={updatingStatusId === user.uid}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${user.status === 'inactive'
                                                        ? 'text-green-600 hover:bg-green-50'
                                                        : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                                                        }`}
                                                    title={user.status === 'inactive' ? 'Activate Personnel' : 'Deactivate Personnel'}
                                                >
                                                    {updatingStatusId === user.uid ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : user.status === 'inactive' ? (
                                                        <FiCheck />
                                                    ) : (
                                                        <FiX />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => handleEditClick(user)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="Edit Record"
                                                >
                                                    <FiEdit2 />
                                                </button>


                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredUsers.length > ROWS_PER_PAGE && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <FiChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${currentPage === page
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <FiChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Warning Message */}
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3 text-sm">
                <FiAlertTriangle className="text-orange-600 text-lg shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-medium text-orange-900">Access Revocation Protocol</h4>
                    <p className="text-orange-800 mt-1">
                        Deleting a user here only removes their profile record from Firestore. The primary authentication account remains active in Firebase Auth. To fully terminate institutional access, a central authentication sweep is required.
                    </p>
                </div>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{t('modify_identity')}</h3>
                                <p className="text-sm text-gray-500">{t('update_credentials')}</p>
                            </div>
                            <button onClick={() => setEditingUser(null)} className="w-8 h-8 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('full_name')}</label>
                                <input
                                    type="text"
                                    value={editForm.displayName}
                                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('account_email')}</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Username (Login identifier)</label>
                                <input
                                    type="text"
                                    value={editForm.username}
                                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    {t('reset_password')} <span className="font-normal text-gray-500">({t('leave_blank_keep')})</span>
                                </label>
                                <input
                                    type="password"
                                    value={editForm.password}
                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
                                >
                                    {t('cancel_protocol')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex justify-center items-center gap-2"
                                >
                                    {isUpdating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('syncing')}...
                                        </>
                                    ) : t('commit_changes')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
