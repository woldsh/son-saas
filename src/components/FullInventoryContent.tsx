'use client';

import React, { useState, useEffect } from 'react';
import MaterialList from './MaterialList';
import AvailableMaterialsList from './AvailableMaterialsList';
import { Layers, GraduationCap, Building2, UserSearch, User, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function FullInventoryContent() {
    const [activeTab, setActiveTab] = useState<'all' | 'academic' | 'admin' | 'user'>('all');
    
    const [searchQuery, setSearchQuery] = useState('');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'user' && allUsers.length === 0) {
            const fetchUsers = async () => {
                setIsLoadingUsers(true);
                try {
                    // 1. Find all user IDs that have at least one material assigned to them
                    const matSnapshot = await getDocs(query(collection(db!, 'materials')));
                    const userIdsWithMaterials = new Set<string>();
                    matSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        if (data.targetUser) {
                            userIdsWithMaterials.add(data.targetUser);
                        }
                    });

                    // 2. Fetch all users and filter to only include those with materials
                    const snapshot = await getDocs(query(collection(db!, 'users')));
                    const usersData = snapshot.docs
                        .map(uDoc => ({ id: uDoc.id, ...uDoc.data() }))
                        .filter(u => userIdsWithMaterials.has(u.id));

                    // Sort users alphabetically by display name
                    usersData.sort((a: any, b: any) => {
                        const nameA = (a.displayName || a.email || '').toLowerCase();
                        const nameB = (b.displayName || b.email || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                    setAllUsers(usersData);
                } catch (error) {
                    console.error("Error fetching users:", error);
                } finally {
                    setIsLoadingUsers(false);
                }
            };
            fetchUsers();
        }
    }, [activeTab]);

    const filteredUsers = allUsers.filter((u: any) => 
        (u.displayName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const handleSelectUser = (u: any) => {
        setSelectedUserId(u.id);
        setSelectedUserName(u.displayName || u.email);
        setSearchQuery('');
    };

    return (
        <div className="bg-slate-50/50 min-h-screen">
            {/* Tab Navigation */}
            <div className="px-6 py-4 md:px-10 md:py-6 border-b border-gray-200 bg-white">
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 bg-gray-100/50 p-1.5 rounded-xl border border-gray-200/80 w-fit">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[14px] font-bold transition-all duration-200 ${
                            activeTab === 'all' 
                            ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                    >
                        <Layers size={18} className={activeTab === 'all' ? 'text-indigo-600' : 'text-gray-400'} />
                        Full Inventory
                    </button>
                    <button
                        onClick={() => setActiveTab('academic')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[14px] font-bold transition-all duration-200 ${
                            activeTab === 'academic' 
                            ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                    >
                        <GraduationCap size={18} className={activeTab === 'academic' ? 'text-blue-600' : 'text-gray-400'} />
                        Academic Staff
                    </button>
                    <button
                        onClick={() => setActiveTab('admin')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[14px] font-bold transition-all duration-200 ${
                            activeTab === 'admin' 
                            ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                    >
                        <Building2 size={18} className={activeTab === 'admin' ? 'text-emerald-600' : 'text-gray-400'} />
                        Administrative Staff
                    </button>
                    <button
                        onClick={() => setActiveTab('user')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[14px] font-bold transition-all duration-200 ${
                            activeTab === 'user' 
                            ? 'bg-white text-purple-700 shadow-sm border border-gray-200/50' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                    >
                        <UserSearch size={18} className={activeTab === 'user' ? 'text-purple-600' : 'text-gray-400'} />
                        Specific User
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="pt-2">
                {activeTab === 'all' && <MaterialList />}
                
                {activeTab === 'academic' && (
                    <div className="px-6 md:px-10 py-6">
                        <AvailableMaterialsList mode="executive_academic" />
                    </div>
                )}
                
                {activeTab === 'admin' && (
                    <div className="px-6 md:px-10 py-6">
                        <AvailableMaterialsList mode="executive_admin" />
                    </div>
                )}
                
                {activeTab === 'user' && (
                    <div className="px-6 md:px-10 py-6 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm max-w-2xl">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                                <UserSearch className="text-purple-600" />
                                Select User
                            </h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or email..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-medium mb-4"
                                />
                                
                                {isLoadingUsers ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="max-h-[300px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50 custom-scrollbar">
                                        {filteredUsers.length > 0 ? (
                                            filteredUsers.map((u) => (
                                                <button 
                                                    key={u.id} 
                                                    onClick={() => handleSelectUser(u)}
                                                    className={`w-full p-3 flex items-center gap-3 transition-colors text-left ${selectedUserId === u.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                                                >
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${selectedUserId === u.id ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600'}`}>
                                                        <User size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-bold truncate ${selectedUserId === u.id ? 'text-purple-900' : 'text-gray-900'}`}>
                                                            {u.displayName || 'Unknown User'}
                                                        </p>
                                                        <p className={`text-xs truncate ${selectedUserId === u.id ? 'text-purple-700' : 'text-gray-500'}`}>
                                                            {u.email} {u.department ? `• ${u.department.replace(/_/g, ' ')}` : ''}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-gray-500 text-sm">
                                                No users found matching "{searchQuery}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {selectedUserName && (
                                <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                        <span className="text-sm font-bold text-purple-900">Viewing materials for: {selectedUserName}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedUserId ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <AvailableMaterialsList mode="specific_user" targetUserId={selectedUserId} />
                            </div>
                        ) : (
                            <div className="text-center p-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-300">
                                <UserSearch className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">Search and select a user to view their assigned materials.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
