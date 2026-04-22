'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { FiSearch, FiFilter, FiBox, FiCheck } from 'react-icons/fi';

interface Material {
    id: string;
    name: string;
    category: string;
    model?: string;
    unit?: string;
    image?: string; // Cloudinary image URL
    materialType?: string; // 'fixed_asset' or 'consumable'
}

interface MaterialSearchProps {
    onSelect: (materialName: string, model?: string, materialType?: string) => void;
    onCancel: () => void;
}

import { useAuth } from '@/contexts/AuthContext';

export default function MaterialSearch({ onSelect, onCancel }: MaterialSearchProps) {
    const { userRole, department } = useAuth();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [categories, setCategories] = useState<string[]>(['All']);
    const [error, setError] = useState('');

    useEffect(() => {
        try {
            const materialsRef = collection(db as any, 'materials');
            const unsubscribe = onSnapshot(materialsRef, (snapshot) => {
                const data: Material[] = [];

                // Helper to check if user has access to a material document
                const hasAccess = (d: any) => {
                    if (d.visibleToAll || d.targetDepartment === 'all' || !d.targetDepartment) {
                        return true; // Global / legacy visibility
                    }
                    if (d.targetDepartment === department) {
                        return true; // Match by exact department (e.g., 'computer_science')
                    }
                    if (d.targetDepartment === userRole) {
                        return true; // Match by exact role (e.g., 'academic_coordinator')
                    }
                    if (userRole && userRole.includes(d.targetDepartment)) {
                        return true; // Match by role prefix (e.g., 'computer_science_teacher' includes 'computer_science')
                    }
                    return false;
                };

                snapshot.docs.forEach(doc => {
                    const d = doc.data();

                    if (!hasAccess(d)) return; // Skip materials registered for other departments/roles

                    // If it's a receipt from Model 19, extract out the individual received items
                    if (d.items && Array.isArray(d.items) && (d.formType === 'receipt_for_articles' || d.items.length > 0 && !d.name)) {
                        d.items.forEach((item: any, idx: number) => {
                            if (item.description && typeof item.description === 'string' && item.description.trim()) {
                                data.push({
                                    id: `${doc.id}_${idx}`, // Create virtual ID for selection
                                    name: item.description.trim(),
                                    category: d.category || d.type || 'Registered Receipt',
                                    model: item.model || '',
                                    unit: item.unit || '',
                                    image: item.imageUrl || item.image || '',
                                    materialType: d.materialType || '',
                                });
                            }
                        });
                    } else if (d.name || d.materialName || d.description || d.itemName) {
                        // Standard single-material document
                        data.push({
                            id: doc.id,
                            name: d.name || d.materialName || d.description || d.itemName,
                            category: d.category || d.type || 'Uncategorized',
                            model: d.model || d.modelNumber || '',
                            unit: d.unit || '',
                            image: d.image || d.imageUrl || d.photo || '',
                            materialType: d.materialType || '',
                        });
                    }
                });
                data.sort((a, b) => a.name.localeCompare(b.name));
                setMaterials(data);
                setLoading(false);
                setError('');

                const cats = Array.from(new Set(data.map(m => m.category)));
                setCategories(['All', ...cats.sort()]);
            }, (err) => {
                console.error('Error fetching materials:', err);
                setError('Failed to load materials. Check console.');
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (err) {
            console.error('Error setting up materials listener:', err);
            setError('Failed to connect to database.');
            setLoading(false);
        }
    }, [userRole, department]);

    useEffect(() => {
        let res = materials;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(m =>
                (m.name?.toLowerCase().startsWith(lower)) ||
                (m.model?.toLowerCase().startsWith(lower)) ||
                (m.category?.toLowerCase().startsWith(lower))
            );
        }
        if (categoryFilter !== 'All') {
            res = res.filter(m => m.category === categoryFilter);
        }
        setFilteredMaterials(res);
    }, [materials, searchTerm, categoryFilter]);

    return (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', minHeight: '100%', display: 'flex', flexDirection: 'column', color: '#000' }}>
            {/* Header */}
            <div style={{ padding: 24, borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>ዕቃ ይምረጡ — Select Material</h2>
                <p style={{ fontSize: 14, color: '#64748b' }}>Search and select the material you want to request.</p>

                <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
                        <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search materials..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
                                border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
                                color: '#000', background: '#fff', fontSize: 14,
                            }}
                        />
                    </div>
                    <div style={{ position: 'relative', minWidth: 200 }}>
                        <FiFilter style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }} />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            style={{
                                width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
                                border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
                                color: '#000', background: '#fff', fontSize: 14, cursor: 'pointer', appearance: 'none' as any,
                            }}
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#fafbfc' }}>
                {!searchTerm.trim() ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, color: '#94a3b8' }}>
                        <FiSearch size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
                        <p style={{ fontSize: 16, fontWeight: 500 }}>Type to search for materials</p>
                        <p style={{ fontSize: 13, marginTop: 4 }}>ዕቃ ለመፈለግ ይጻፉ</p>
                    </div>
                ) : loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: '#94a3b8' }}>
                        Loading materials...
                    </div>
                ) : error ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, color: '#ef4444' }}>
                        <p>{error}</p>
                    </div>
                ) : filteredMaterials.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, color: '#94a3b8' }}>
                        <FiBox size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <p>No materials found.</p>
                        <p style={{ fontSize: 12, marginTop: 8 }}>Total in database: {materials.length}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                        {filteredMaterials.map(material => (
                            <div
                                key={material.id}
                                onClick={() => onSelect(material.name, material.model, material.materialType)}
                                style={{
                                    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                                    cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.15)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                            >
                                {/* Material Image */}
                                <div style={{
                                    width: '100%', height: 100, background: '#f1f5f9',
                                    overflow: 'hidden', position: 'relative',
                                }}>
                                    {material.image ? (
                                        <img
                                            src={material.image}
                                            alt={material.name}
                                            style={{
                                                width: '100%', height: '100%', objectFit: 'cover',
                                                transition: 'transform 0.3s ease',
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                                            onError={(e) => {
                                                // Gracefully hide broken Cloudinary links or non-image files instead of showing 'alt' text
                                                e.currentTarget.style.display = 'none';
                                                if (e.currentTarget.parentElement) {
                                                    e.currentTarget.parentElement.innerHTML = `
                                                        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8;">
                                                            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="48" width="48" xmlns="http://www.w3.org/2000/svg"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                                        </div>
                                                    `;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#cbd5e1',
                                        }}>
                                            <FiBox size={48} />
                                        </div>
                                    )}
                                    {/* Category badge on image */}
                                    <span style={{
                                        position: 'absolute', top: 8, right: 8,
                                        fontSize: 11, fontWeight: 500, padding: '4px 10px',
                                        background: 'rgba(255,255,255,0.9)', color: '#64748b', borderRadius: 12,
                                        backdropFilter: 'blur(4px)',
                                    }}>
                                        {material.category}
                                    </span>
                                </div>

                                {/* Info */}
                                <div style={{ padding: 16 }}>
                                    <h3 style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4, fontSize: 15 }}>{material.name}</h3>
                                    {material.model && (
                                        <p style={{ fontSize: 13, color: '#64748b' }}>Model: {material.model}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                    {filteredMaterials.length} of {materials.length} materials
                </span>
                <button
                    onClick={onCancel}
                    style={{ padding: '8px 24px', color: '#64748b', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
