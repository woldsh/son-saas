'use client';
import { setDocWithAudit, deleteDocWithAudit } from '@/utils/auditTrail';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs,  doc,  serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useInventory, Material } from '@/contexts/InventoryContext';
import {
    FaSearch, FaBoxOpen, FaSave, FaSpinner, FaCheckCircle,
    FaExclamationTriangle, FaClock, FaTrash, FaEdit, FaTimes
} from 'react-icons/fa';

interface CooldownRule {
    id: string;
    materialId: string;
    materialName: string;
    materialCode: string;
    cooldownDays: number;
    cooldownLabel: string;
    maxRequestedQuantity?: number;
    image?: string;
    updatedAt?: any;
}

const COOLDOWN_OPTIONS = [
    { label: '1 ሳምንት (1 Week)', days: 7 },
    { label: '2 ሳምንት (2 Weeks)', days: 14 },
    { label: '1 ወር (1 Month)', days: 30 },
    { label: '3 ወር (3 Months)', days: 90 },
    { label: '6 ወር (6 Months)', days: 180 },
    { label: '1 ዓመት (1 Year)', days: 365 },
    { label: '2 ዓመት (2 Years)', days: 730 },
];

export default function RequestCooldownPage() {
    const { materials } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [selectedDays, setSelectedDays] = useState(30);
    const [isCustom, setIsCustom] = useState(false);
    const [customValue, setCustomValue] = useState(1);
    const [customUnit, setCustomUnit] = useState<'days' | 'months' | 'years'>('months');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
    const [existingRules, setExistingRules] = useState<CooldownRule[]>([]);
    const [loadingRules, setLoadingRules] = useState(true);
    const [maxRequestedQuantity, setMaxRequestedQuantity] = useState<number | ''>('');
    const [editingRule, setEditingRule] = useState<CooldownRule | null>(null);

    const [enableCooldown, setEnableCooldown] = useState(true);
    const [enableQuantityLimits, setEnableQuantityLimits] = useState(false);

    // Listen to existing cooldown rules
    useEffect(() => {
        if (!db) return;
        const unsubscribe = onSnapshot(collection(db!, 'request_cooldown_rules'), (snapshot) => {
            const rules = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CooldownRule[];
            setExistingRules(rules);
            setLoadingRules(false);
        });
        return () => unsubscribe();
    }, []);

    // Map of material IDs to their existing rules
    const ruledMap = new Map(existingRules.map(r => [r.materialId, r]));

    const filteredMaterials = materials.filter(m =>
        (m.materialName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.materialCode || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get label for days
    const getLabelForDays = (days: number) => {
        const opt = COOLDOWN_OPTIONS.find(o => o.days === days);
        return opt ? opt.label : `${days} ቀን (${days} Days)`;
    };

    const initializeCooldownDaysState = (days: number) => {
        setSelectedDays(days);
        if (days === 0) {
            setIsCustom(false);
            return;
        }
        const opt = COOLDOWN_OPTIONS.find(o => o.days === days);
        if (opt) {
            setIsCustom(false);
        } else {
            setIsCustom(true);
            if (days % 365 === 0) {
                setCustomValue(days / 365);
                setCustomUnit('years');
            } else if (days % 30 === 0) {
                setCustomValue(days / 30);
                setCustomUnit('months');
            } else {
                setCustomValue(days);
                setCustomUnit('days');
            }
        }
    };

    const handleSubmit = async () => {
        const target = editingRule || selectedMaterial;
        if (!target || !db) return;

        setIsSubmitting(true);
        setStatus({ type: null, message: '' });

        const materialId = editingRule ? editingRule.materialId : selectedMaterial!.id;
        const materialName = editingRule ? editingRule.materialName : selectedMaterial!.materialName;
        const materialCode = editingRule ? editingRule.materialCode : (selectedMaterial!.materialCode || '');
        const image = editingRule ? editingRule.image : (selectedMaterial!.image || '');

        const cooldownDaysToSave = enableCooldown ? selectedDays : 0;
        const cooldownLabelToSave = enableCooldown 
            ? (getLabelForDays(selectedDays).split('(')[1]?.replace(')', '').trim() || `${selectedDays} Days`)
            : 'No Cooldown';
        const maxRequestedQtyToSave = enableQuantityLimits && maxRequestedQuantity !== '' ? Number(maxRequestedQuantity) : 0;

        try {
            await setDocWithAudit(doc(db!, 'request_cooldown_rules', materialId), {
                materialId,
                materialName,
                materialCode,
                cooldownDays: cooldownDaysToSave,
                cooldownLabel: cooldownLabelToSave,
                maxRequestedQuantity: maxRequestedQtyToSave,
                image: image || '',
                updatedAt: serverTimestamp()
            });
            setStatus({ type: 'success', message: `✅ "${materialName}" — rule saved successfully.` });
            setSelectedMaterial(null);
            setEditingRule(null);
            setSelectedDays(30);
            setIsCustom(false);
            setMaxRequestedQuantity('');
            setEnableCooldown(true);
            setEnableQuantityLimits(false);
        } catch (err) {
            console.error("Error saving cooldown rule:", err);
            setStatus({ type: 'error', message: 'Failed to save. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (rule: CooldownRule) => {
        if (!db) return;
        if (!confirm(`"${rule.materialName}" cooldown rule ይሰረዝ?`)) return;
        try {
            await deleteDocWithAudit(doc(db!, 'request_cooldown_rules', rule.materialId));
        } catch (err) {
            console.error("Error deleting rule:", err);
        }
    };

    const handleEdit = (rule: CooldownRule) => {
        setEditingRule(rule);
        setSelectedMaterial(null);
        
        const hasCooldown = rule.cooldownDays !== undefined && rule.cooldownDays > 0;
        setEnableCooldown(hasCooldown);
        if (hasCooldown) {
            initializeCooldownDaysState(rule.cooldownDays);
        } else {
            setSelectedDays(30);
            setIsCustom(false);
        }

        const reqQtyVal = rule.maxRequestedQuantity !== undefined && rule.maxRequestedQuantity > 0 ? rule.maxRequestedQuantity : '';
        setMaxRequestedQuantity(reqQtyVal);
        setEnableQuantityLimits(reqQtyVal !== '');
        setStatus({ type: null, message: '' });
    };

    const handleSelectMaterial = (m: Material) => {
        setSelectedMaterial(m);
        setEditingRule(null);
        setStatus({ type: null, message: '' });
        const existingRule = ruledMap.get(m.id);
        if (existingRule) {
            const hasCooldown = existingRule.cooldownDays !== undefined && existingRule.cooldownDays > 0;
            setEnableCooldown(hasCooldown);
            if (hasCooldown) {
                initializeCooldownDaysState(existingRule.cooldownDays);
            } else {
                setSelectedDays(30);
                setIsCustom(false);
            }

            const reqQtyVal = existingRule.maxRequestedQuantity !== undefined && existingRule.maxRequestedQuantity > 0 ? existingRule.maxRequestedQuantity : '';
            setMaxRequestedQuantity(reqQtyVal);
            setEnableQuantityLimits(reqQtyVal !== '');
        } else {
            setSelectedDays(30);
            setIsCustom(false);
            setEnableCooldown(true);
            setMaxRequestedQuantity('');
            setEnableQuantityLimits(false);
        }
    };

    const activeTarget = editingRule || selectedMaterial;
    const activeTargetName = editingRule ? editingRule.materialName : selectedMaterial?.materialName;

    return (
        <div className="min-h-full bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 lg:px-10 py-6">
                <div className="flex items-center gap-3 mb-1">
                     <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <FaClock className="text-lg" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Request Cooldown</h1>
                        <p className="text-sm text-gray-500">ተጠቃሚዎች ተመሳሳይ ዕቃ እንደገና ከመጠየቃቸው በፊት ምን ያህል ጊዜ መጠበቅ እንዳለባቸው ያስቀምጡ</p>
                    </div>
                </div>
            </div>

            <div className="px-6 lg:px-10 pt-6">
                {/* Status Message */}
                {status.message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {status.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
                        <span className="font-medium">{status.message}</span>
                        <button onClick={() => setStatus({ type: null, message: '' })} className="ml-auto text-gray-400 hover:text-gray-600"><FaTimes /></button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Left: Material Selection + Set Cooldown */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <FaBoxOpen className="text-blue-500" />
                                ዕቃ ይምረጡ (Select Material)
                            </h3>
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                                <input
                                    type="text"
                                    placeholder="ፈልግ... Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3">
                            {filteredMaterials.length > 0 ? (
                                <div className="space-y-1">
                                    {filteredMaterials.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleSelectMaterial(m)}
                                            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${selectedMaterial?.id === m.id
                                                ? 'bg-blue-50 border border-blue-200'
                                                : 'hover:bg-gray-50 border border-transparent'
                                                }`}
                                        >
                                            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50">
                                                {m.image ? (
                                                    <img src={m.image} alt={m.materialName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                                                        <FaBoxOpen />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-semibold text-sm truncate ${selectedMaterial?.id === m.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                                    {m.materialName}
                                                </p>
                                                {m.materialCode && <p className="text-xs text-gray-400">{m.materialCode}</p>}
                                            </div>
                                            {ruledMap.has(m.id) && (
                                                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">
                                                    {ruledMap.get(m.id)!.cooldownLabel}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                                    <FaBoxOpen className="text-3xl mb-2 opacity-40" />
                                    <p className="text-sm">No materials found</p>
                                </div>
                            )}
                        </div>

                        {/* Set Cooldown Section - appears when a material is selected */}
                        {activeTarget && (
                            <div className="border-t-2 border-blue-100 bg-blue-50/50 p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-gray-700">
                                        Configure Rules for: <span className="text-blue-600">{activeTargetName}</span>
                                    </p>
                                    <button
                                        onClick={() => { 
                                            setSelectedMaterial(null); 
                                            setEditingRule(null); 
                                            setMaxRequestedQuantity(''); 
                                            setEnableCooldown(true);
                                            setEnableQuantityLimits(false);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 text-sm"
                                    >
                                        <FaTimes />
                                    </button>
                                </div>

                                {/* Feature Toggles */}
                                <div className="flex flex-wrap gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={enableCooldown} 
                                            onChange={(e) => setEnableCooldown(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                        />
                                        <span>⏱️ Cooldown Period (የጊዜ ገደብ)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={enableQuantityLimits} 
                                            onChange={(e) => setEnableQuantityLimits(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                        />
                                        <span>📊 Quantity Limits (የመጠን ገደብ)</span>
                                    </label>
                                </div>

                                {/* Cooldown Duration Section */}
                                {enableCooldown && (
                                    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                                        <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                                            ⏱️ Cooldown Duration (የመጠባበቂያ ጊዜ)
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={isCustom ? 'custom' : selectedDays}
                                                onChange={(e) => {
                                                    if (e.target.value === 'custom') {
                                                        setIsCustom(true);
                                                        const multiplier = customUnit === 'years' ? 365 : customUnit === 'months' ? 30 : 1;
                                                        setSelectedDays(customValue * multiplier);
                                                    } else {
                                                        setIsCustom(false);
                                                        setSelectedDays(Number(e.target.value));
                                                    }
                                                }}
                                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                            >
                                                {COOLDOWN_OPTIONS.map(opt => (
                                                    <option key={opt.days} value={opt.days}>{opt.label}</option>
                                                ))}
                                                <option value="custom">✏️ ሌላ ያስገቡ (Custom)...</option>
                                            </select>
                                        </div>
                                        {isCustom && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={customValue}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setCustomValue(val);
                                                        const multiplier = customUnit === 'years' ? 365 : customUnit === 'months' ? 30 : 1;
                                                        setSelectedDays(val * multiplier);
                                                    }}
                                                    placeholder="ቁጥር"
                                                    className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                />
                                                <select
                                                    value={customUnit}
                                                    onChange={(e) => {
                                                        const unit = e.target.value as 'days' | 'months' | 'years';
                                                        setCustomUnit(unit);
                                                        const multiplier = unit === 'years' ? 365 : unit === 'months' ? 30 : 1;
                                                        setSelectedDays(customValue * multiplier);
                                                    }}
                                                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                >
                                                    <option value="days">ቀን (Days)</option>
                                                    <option value="months">ወር (Months)</option>
                                                    <option value="years">ዓመት (Years)</option>
                                                </select>
                                                <span className="text-xs text-gray-400">= {selectedDays} ቀን</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Quantity Limits Section */}
                                {enableQuantityLimits && (
                                    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
                                        <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                                            📊 Max Quantity Limits (የመጠን ገደብ)
                                        </label>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                Max Requested Qty (የሚፈቀደው ከፍተኛ መጠን)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={maxRequestedQuantity}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setMaxRequestedQuantity(val === '' ? '' : Math.max(0, parseInt(val) || 0));
                                                }}
                                                placeholder="Unlimited (ገደብ የለውም)"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons Row */}
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || (!enableCooldown && !enableQuantityLimits) || (enableCooldown && isCustom && customValue < 1)}
                                        className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                                    >
                                        {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
                                        {isSubmitting ? 'Saving...' : 'Save Rule'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Active Cooldown Rules Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: '520px' }}>
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <FaClock className="text-blue-500" />
                                ንቁ Cooldown ህጎች ({existingRules.length})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {loadingRules ? (
                                <div className="flex items-center justify-center p-12">
                                    <FaSpinner className="animate-spin text-xl text-blue-500" />
                                </div>
                            ) : existingRules.length > 0 ? (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-gray-50 z-10">
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">ዕቃ (Material)</th>
                                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Cooldown</th>
                                            <th className="text-right px-4 py-3 text-xs font-bold text-gray-500">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existingRules.map(rule => (
                                            <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50">
                                                            {rule.image ? (
                                                                <img src={rule.image} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs"><FaBoxOpen /></div>
                                                            )}
                                                        </div>
                                                        <span className="font-semibold text-gray-700 text-sm">{rule.materialName}</span>
                                                    </div>
                                                </td>
                                                 <td className="px-4 py-3">
                                                     <div className="flex flex-col gap-1">
                                                         {rule.cooldownDays > 0 ? (
                                                             <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md w-fit">
                                                                 {rule.cooldownLabel} ({rule.cooldownDays} days)
                                                             </span>
                                                         ) : (
                                                             <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-md w-fit border border-gray-200">
                                                                 No Cooldown (ገደብ የለውም)
                                                             </span>
                                                         )}
                                                        {rule.maxRequestedQuantity ? (
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-100">
                                                                    Req Max: {rule.maxRequestedQuantity}
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => handleEdit(rule)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                            <FaEdit className="text-sm" />
                                                        </button>
                                                        <button onClick={() => handleDelete(rule)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                            <FaTrash className="text-sm" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                                    <FaClock className="text-3xl mb-2 opacity-30" />
                                    <p className="font-medium text-sm">ገና cooldown rule አልተቀመጠም</p>
                                    <p className="text-xs mt-1">No cooldown rules set yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
