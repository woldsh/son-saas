'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import {
    ArrowLeft,
    BadgeCheck,
    Briefcase,
    Calendar,
    FileText,
    Lock,
    MapPin,
    Package,
    Printer,
    QrCode,
    ShieldCheck,
    User,
    Wrench,
    type LucideIcon
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { getAssetCode, getQrCodeImageUrl } from '@/utils/assetIdentity';
import { buildAuditActor, writeAuditLog } from '@/utils/auditTrail';

type AssetRecord = {
    id: string;
    assetCode?: string;
    assetStatus?: string;
    materialName?: string;
    materialCode?: string;
    materialType?: string;
    category?: string;
    condition?: string;
    image?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
    currency?: string;
    purchaseDate?: string;
    warrantyDate?: string;
    vendorName?: string;
    responsiblePerson?: string;
    serialNumber?: string;
    model?: string;
    serie?: string;
    storeLocation?: string;
    shelfNumber?: string;
    department?: string;
    remarks?: string;
    createdAt?: string;
    registeredBy?: string;
    assignedToUid?: string;
    holderId?: string;
};

type ReceiptItem = {
    description?: string;
    condition?: string;
    imageUrl?: string;
    image?: string;
    itemNo?: string;
    quantity?: number | string;
    originalQuantity?: number | string;
    remark?: string;
    unit?: string;
    unitPriceBirr?: number | string;
    model?: string;
    serie?: string;
    pageFrom?: string;
    pageTo?: string;
    unitPriceCents?: number | string;
    totalPriceCents?: number | string;
};

const FULL_ACCESS_ROLES = new Set([
    'chief',
    'managing_director_leader',
    'procurement_team_leader',
    'admin'
]);

function normalizeRole(role: string | null) {
    return (role || '').toLowerCase().replace(/\s+/g, '_');
}

function normalizeUnit(value?: string | null) {
    return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function getActorUnitCandidates(role: string, department?: string | null) {
    const candidates = new Set<string>();
    const normalizedDepartment = normalizeUnit(department);
    if (normalizedDepartment) candidates.add(normalizedDepartment);

    if (role.endsWith('_head')) {
        candidates.add(role.replace(/_head$/, ''));
    }

    if (role.endsWith('_leader')) {
        candidates.add(role.replace(/_leader$/, ''));
    }

    if (role.endsWith('_employee')) {
        candidates.add(role.replace(/_employee$/, ''));
    }

    return candidates;
}

function assetBelongsToActorUnit(asset: AssetRecord | null, role: string, department?: string | null) {
    if (!asset) return false;
    const actorUnits = getActorUnitCandidates(role, department);
    const assetUnits = [
        asset.department,
        asset.category,
    ].map(normalizeUnit).filter(Boolean);

    return assetUnits.some((unit) => actorUnits.has(unit));
}

function getAccessLevel(role: string, isAdmin: boolean, asset: AssetRecord | null, userId?: string, department?: string | null) {
    if (isAdmin || FULL_ACCESS_ROLES.has(role) || role.includes('stock_clerk')) return 'full';
    if (role.includes('store_keeper')) return 'operations';
    if (asset && userId && (asset.assignedToUid === userId || asset.holderId === userId)) return 'owner';
    if ((role.endsWith('_leader') || role.endsWith('_head') || role === 'academic_coordinator') && assetBelongsToActorUnit(asset, role, department)) return 'department';
    if (role) return 'basic';
    return 'public';
}

function formatCurrency(value?: number, currency = 'ETB') {
    if (!value || value <= 0) return 'Not recorded';
    return `${value.toLocaleString()} ${currency}`;
}

function receiptItemToAssetRecord(baseId: string, idx: number, parent: Record<string, unknown>, item: ReceiptItem): AssetRecord {
    return {
        id: `${baseId}_${idx}`,
        assetCode: String(item.itemNo || parent.receiptNo || `${baseId}_${idx}`),
        assetStatus: 'registered',
        materialName: item.description || 'Receipt item',
        materialCode: String(item.itemNo || parent.receiptNo || ''),
        materialType: String(parent.materialType || 'fixed_asset'),
        category: String(parent.classificationOfStock || parent.category || 'Receipt Item'),
        condition: item.condition || 'New',
        image: item.imageUrl || item.image || '',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'pcs',
        unitPrice: Number(item.unitPriceBirr) || 0,
        totalPrice: (Number(item.unitPriceBirr) || 0) * (Number(item.quantity) || 0),
        purchaseDate: String(parent.day || parent.createdAt || ''),
        vendorName: String(parent.delivererDonor || ''),
        responsiblePerson: String(parent.recipientName || ''),
        serialNumber: item.serie || item.itemNo || '',
        model: item.model || '',
        serie: item.serie || '',
        storeLocation: String(parent.storeNo || ''),
        shelfNumber: String(parent.shelfNo || ''),
        department: String(parent.department || parent.category || ''),
        remarks: item.remark || '',
        createdAt: String(parent.createdAt || ''),
    };
}

function getSyntheticReceiptParts(id: string | null) {
    if (!id) return null;

    const itemStyleMatch = id.match(/^(.+)_item_(\d+)$/);
    if (itemStyleMatch) {
        return { baseId: itemStyleMatch[1], index: Number(itemStyleMatch[2]) };
    }

    const simpleMatch = id.match(/^(.+)_(\d+)$/);
    if (simpleMatch) {
        return { baseId: simpleMatch[1], index: Number(simpleMatch[2]) };
    }

    return null;
}

function Field({ label, value, icon: Icon }: { label: string; value?: string | number | null; icon?: LucideIcon }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {label}
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900">{value || 'Not recorded'}</p>
        </div>
    );
}

export default function AssetProfilePage() {
    const params = useParams<{ assetCode: string }>();
    const searchParams = useSearchParams();
    const { user, userRole, department, isAdmin, loading: authLoading } = useAuth();
    const [asset, setAsset] = useState<AssetRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profileUrl, setProfileUrl] = useState('');
    const [viewLogged, setViewLogged] = useState(false);

    const assetCode = decodeURIComponent(params.assetCode || '');
    const documentId = searchParams.get('id');
    const role = normalizeRole(userRole);

    useEffect(() => {
        setProfileUrl(window.location.href);
    }, []);

    useEffect(() => {
        const fetchAsset = async () => {
            if (!db) {
                setError('Database connection is unavailable.');
                setLoading(false);
                return;
            }

            try {
                const syntheticReceipt = getSyntheticReceiptParts(documentId);
                if (syntheticReceipt) {
                    const parentSnap = await getDoc(doc(db, 'materials', syntheticReceipt.baseId));
                    const parent = parentSnap.exists() ? parentSnap.data() : null;
                    const item = Array.isArray(parent?.items) ? parent.items[syntheticReceipt.index] as ReceiptItem | undefined : undefined;

                    if (parent && item) {
                        setAsset(receiptItemToAssetRecord(syntheticReceipt.baseId, syntheticReceipt.index, parent, item));
                        setLoading(false);
                        return;
                    }
                }

                if (documentId) {
                    const directSnap = await getDoc(doc(db, 'materials', documentId));
                    if (directSnap.exists()) {
                        setAsset({ id: directSnap.id, ...directSnap.data() } as AssetRecord);
                        setLoading(false);
                        return;
                    }
                }

                const assetCodeQuery = query(collection(db, 'materials'), where('assetCode', '==', assetCode));
                const assetCodeSnap = await getDocs(assetCodeQuery);
                if (!assetCodeSnap.empty) {
                    const found = assetCodeSnap.docs[0];
                    setAsset({ id: found.id, ...found.data() } as AssetRecord);
                    setLoading(false);
                    return;
                }

                const materialCodeQuery = query(collection(db, 'materials'), where('materialCode', '==', assetCode));
                const materialCodeSnap = await getDocs(materialCodeQuery);
                if (!materialCodeSnap.empty) {
                    const found = materialCodeSnap.docs[0];
                    setAsset({ id: found.id, ...found.data() } as AssetRecord);
                    setLoading(false);
                    return;
                }

                const allMaterialsSnap = await getDocs(collection(db, 'materials'));
                for (const materialDoc of allMaterialsSnap.docs) {
                    const parent = materialDoc.data();
                    if (!Array.isArray(parent.items)) continue;

                    const matchIndex = parent.items.findIndex((item: ReceiptItem) => {
                        const itemCode = String(item.itemNo || '').toLowerCase();
                        const itemName = String(item.description || '').toLowerCase();
                        const lookup = assetCode.toLowerCase();
                        return itemCode === lookup || itemName === lookup;
                    });

                    if (matchIndex >= 0) {
                        setAsset(receiptItemToAssetRecord(materialDoc.id, matchIndex, parent, parent.items[matchIndex] as ReceiptItem));
                        setLoading(false);
                        return;
                    }
                }

                setError('Asset was not found.');
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load asset profile.');
            } finally {
                setLoading(false);
            }
        };

        fetchAsset();
    }, [assetCode, documentId]);

    const accessLevel = useMemo(
        () => getAccessLevel(role, isAdmin, asset, user?.uid, department),
        [role, isAdmin, asset, user?.uid, department]
    );

    const canSeeCustody = ['owner', 'department', 'operations', 'full'].includes(accessLevel);
    const canSeeFinancials = accessLevel === 'full';
    const canSeeStore = ['operations', 'full'].includes(accessLevel);
    const canSeeDocuments = ['department', 'operations', 'full'].includes(accessLevel);

    useEffect(() => {
        if (!asset || viewLogged || !db) return;

        setViewLogged(true);
        void writeAuditLog(db, {
            actor: buildAuditActor(user, userRole, accessLevel === 'public' ? 'QR Scanner' : 'System User'),
            action: 'asset_qr_profile_viewed',
            targetType: 'asset',
            targetId: asset.id,
            targetName: asset.materialName || getAssetCode(asset),
            newValue: {
                assetCode: getAssetCode(asset),
                accessLevel,
                actorRole: userRole || 'public',
            },
            note: 'Asset QR profile opened',
        }).catch((err) => {
            console.error('Failed to write asset profile audit log:', err);
        });
    }, [accessLevel, asset, user, userRole, viewLogged]);

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin" />
            </div>
        );
    }

    if (error || !asset) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <Package className="mx-auto h-10 w-10 text-slate-300" />
                    <h1 className="mt-4 text-lg font-black text-slate-900">Asset Profile Unavailable</h1>
                    <p className="mt-2 text-sm text-slate-500">{error || 'Asset was not found.'}</p>
                    <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600">
                        <ArrowLeft className="h-4 w-4" /> Back to system
                    </Link>
                </div>
            </div>
        );
    }

    const displayCode = getAssetCode(asset);
    const status = asset.assetStatus || asset.condition || 'registered';

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <div className="border-b border-slate-200 bg-white print:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Link>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <Printer className="h-4 w-4" /> Print Label
                    </button>
                </div>
            </div>

            <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[340px_1fr] print:block print:px-0 print:py-0">
                <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-black print:shadow-none">
                    <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 relative">
                        {asset.image ? (
                            <Image src={asset.image} alt={asset.materialName || 'Asset'} fill className="object-contain p-4" />
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <Package className="h-16 w-16 text-slate-300" />
                            </div>
                        )}
                    </div>

                    <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                        {profileUrl ? (
                            <img
                                src={getQrCodeImageUrl(profileUrl, 220)}
                                alt={`QR code for ${displayCode}`}
                                className="mx-auto h-[220px] w-[220px]"
                            />
                        ) : (
                            <QrCode className="mx-auto h-20 w-20 text-slate-300" />
                        )}
                        <p className="mt-3 font-mono text-sm font-black tracking-wider text-slate-900">{displayCode}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Scan for asset profile</p>
                    </div>

                    <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-700">
                            <ShieldCheck className="h-4 w-4" />
                            {accessLevel} access
                        </div>
                        <p className="mt-1 text-xs font-medium text-indigo-700">
                            {accessLevel === 'public'
                                ? 'Login is required to view custody, financial, and document records.'
                                : 'Visible information is filtered by your system role.'}
                        </p>
                    </div>
                </aside>

                <section className="space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Fixed Asset Profile</p>
                                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{asset.materialName || 'Unnamed asset'}</h1>
                                <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                                    Official QR profile for asset identity, custody, location, lifecycle status, and audit review.
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-700">
                                <BadgeCheck className="h-4 w-4" /> {status}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Asset Code" value={displayCode} icon={QrCode} />
                        <Field label="Material Code" value={asset.materialCode} icon={FileText} />
                        <Field label="Category" value={asset.category} icon={Briefcase} />
                        <Field label="Condition" value={asset.condition} icon={BadgeCheck} />
                        <Field label="Serial Number" value={asset.serialNumber || asset.serie} icon={Package} />
                        <Field label="Model" value={asset.model} icon={Package} />
                    </div>

                    {canSeeCustody ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700">
                                <User className="h-4 w-4" /> Custody
                            </h2>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <Field label="Current Holder" value={asset.responsiblePerson} />
                                <Field label="Department" value={asset.department} />
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 shadow-sm">
                            <Lock className="mr-2 inline h-4 w-4" />
                            Custody details are hidden for this actor.
                        </div>
                    )}

                    {canSeeStore && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700">
                                <MapPin className="h-4 w-4" /> Store Location
                            </h2>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <Field label="Store" value={asset.storeLocation} />
                                <Field label="Shelf / Bin" value={asset.shelfNumber} />
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Purchase Date" value={asset.purchaseDate} icon={Calendar} />
                        <Field label="Warranty Date" value={asset.warrantyDate} icon={Wrench} />
                        {canSeeFinancials && <Field label="Asset Value" value={formatCurrency(asset.totalPrice || asset.unitPrice, asset.currency)} icon={Briefcase} />}
                        {canSeeFinancials && <Field label="Vendor" value={asset.vendorName} icon={Briefcase} />}
                    </div>

                    {canSeeDocuments && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700">
                                <FileText className="h-4 w-4" /> Document References
                            </h2>
                            <div className="mt-4 grid gap-4 md:grid-cols-3">
                                <Field label="Model 19" value={asset.materialCode} />
                                <Field label="Model 22" value="Linked after handout" />
                                <Field label="Handover" value="Linked after custody change" />
                            </div>
                        </div>
                    )}

                    {asset.remarks && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Remarks</h2>
                            <p className="mt-3 text-sm font-medium text-slate-600">{asset.remarks}</p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
