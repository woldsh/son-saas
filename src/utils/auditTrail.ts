import { addDoc, updateDoc, setDoc, deleteDoc, collection, serverTimestamp, type Firestore, type CollectionReference, type DocumentReference, type WithFieldValue, type UpdateData, type SetOptions, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getClientInfo, generateSessionId } from '@/lib/auditLogger';

export type AuditActor = {
    id: string;
    name: string;
    email?: string | null;
    role?: string | null;
    department?: string | null;
};

export type AuditLogInput = {
    actor: AuditActor;
    action: string;
    targetType: string;
    targetId?: string;
    targetName?: string;
    oldValue?: unknown;
    newValue?: unknown;
    note?: string;
    metadata?: Record<string, unknown>;
    // Enhanced fields
    module?: string;
    status?: 'success' | 'failure' | 'denied' | 'warning';
    impactLevel?: 'low' | 'medium' | 'high' | 'critical';
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    workflowId?: string;
    department?: string;
};

export function buildAuditActor(user: User | null, role?: string | null, department?: string | null, fallbackName = 'System User'): AuditActor {
    return {
        id: user?.uid || 'anonymous',
        name: user?.displayName || user?.email || fallbackName,
        email: user?.email || null,
        role: role || null,
        department: department || null,
    };
}

export async function writeAuditLog(db: Firestore | null, input: AuditLogInput) {
    if (!db) return;

    // Get client information (IP, device, browser)
    const clientInfo = getClientInfo();
    
    // Get or create session ID
    let sessionId = null;
    let realIp = clientInfo.ipAddress || null;
    let locationData = null;
    
    if (typeof window !== 'undefined') {
        sessionId = sessionStorage.getItem('auditSessionId');
        if (!sessionId) {
            sessionId = generateSessionId();
            sessionStorage.setItem('auditSessionId', sessionId);
        }
        
        try {
            const cachedIp = sessionStorage.getItem('clientIp');
            const cachedLocation = sessionStorage.getItem('clientLocation');
            if (cachedIp) {
                realIp = cachedIp;
                if (cachedLocation) locationData = JSON.parse(cachedLocation);
            } else {
                // Fetch IP and basic location without blocking too long
                const ipRes = await fetch('https://ipapi.co/json/').catch(() => null);
                if (ipRes && ipRes.ok) {
                    const ipData = await ipRes.json();
                    realIp = ipData.ip;
                    locationData = { city: ipData.city, country: ipData.country_name, region: ipData.region };
                    sessionStorage.setItem('clientIp', realIp || '');
                    sessionStorage.setItem('clientLocation', JSON.stringify(locationData));
                } else {
                    // Fallback to ipify
                    const fallbackRes = await fetch('https://api.ipify.org?format=json').catch(() => null);
                    if (fallbackRes && fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        realIp = fallbackData.ip;
                        sessionStorage.setItem('clientIp', realIp || '');
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }

    await addDoc(collection(db, 'activity_logs'), {
        // Actor Information
        actorId: input.actor.id,
        actorName: input.actor.name,
        actorEmail: input.actor.email || null,
        actorRole: input.actor.role || null,
        actorDepartment: input.actor.department || input.department || null,
        
        // Action Details
        action: input.action,
        actionCategory: determineActionCategory(input.action),
        status: input.status || 'success',
        
        // Target Information
        targetType: input.targetType,
        targetId: input.targetId || null,
        targetName: input.targetName || null,
        
        // Change Tracking
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        note: input.note || '',
        changedFields: input.oldValue && input.newValue ? getChangedFields(input.oldValue, input.newValue) : null,
        
        // Source Information (from client)
        ipAddress: realIp,
        userAgent: clientInfo.userAgent || navigator?.userAgent || null,
        deviceType: clientInfo.deviceType && clientInfo.deviceType !== 'unknown' ? clientInfo.deviceType : (typeof window !== 'undefined' ? (window.innerWidth < 768 ? 'mobile' : 'desktop') : 'unknown'),
        browser: clientInfo.browser || null,
        location: locationData,
        
        // Session & Transaction
        sessionId: sessionId,
        
        // System Details
        module: input.module || input.targetType || null,
        apiEndpoint: typeof window !== 'undefined' ? window.location.pathname : 'Firestore API',
        serviceName: 'Property Management System',
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        
        // Business Context
        workflowId: input.workflowId || null,
        department: input.department || null,
        impactLevel: input.impactLevel || determineImpactLevel(input.action),
        
        // Compliance
        dataClassification: input.dataClassification || 'internal',
        
        // Metadata
        metadata: input.metadata || {},
        createdAt: serverTimestamp(),
    });
}

// Helper function to determine action category
function determineActionCategory(action: string): string {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('login') || actionLower.includes('logout') || actionLower.includes('password')) {
        return 'authentication';
    }
    if (actionLower.includes('permission') || actionLower.includes('role') || actionLower.includes('access')) {
        return 'authorization';
    }
    if (actionLower.includes('view') || actionLower.includes('read') || actionLower.includes('export')) {
        return 'data_access';
    }
    if (actionLower.includes('create') || actionLower.includes('update') || actionLower.includes('delete') || 
        actionLower.includes('set') || actionLower.includes('modify')) {
        return 'data_modification';
    }
    if (actionLower.includes('security') || actionLower.includes('unauthorized') || actionLower.includes('denied')) {
        return 'security';
    }
    
    return 'system';
}

// Helper function to determine impact level
function determineImpactLevel(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('delete') || actionLower.includes('security') || actionLower.includes('unauthorized')) {
        return 'high';
    }
    if (actionLower.includes('create') || actionLower.includes('update') || actionLower.includes('set')) {
        return 'medium';
    }
    
    return 'low';
}

// Helper function to get changed fields
function getChangedFields(oldValue: unknown, newValue: unknown): string[] | null {
    if (!oldValue || !newValue || typeof oldValue !== 'object' || typeof newValue !== 'object') {
        return null;
    }
    
    const oldObj = oldValue as Record<string, unknown>;
    const newObj = newValue as Record<string, unknown>;
    
    const changedFields: string[] = [];
    
    for (const key in newObj) {
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
            changedFields.push(key);
        }
    }
    
    return changedFields.length > 0 ? changedFields : null;
}

function getCurrentActor(): AuditActor {
    const user = auth?.currentUser || null;
    let role = null;
    let department = null;
    if (typeof window !== 'undefined') {
        role = sessionStorage.getItem('userRole');
        department = sessionStorage.getItem('userDepartment');
        if (!role && sessionStorage.getItem('isAdmin') === 'true') {
            role = 'admin';
        }
    }
    return buildAuditActor(user, role, department);
}

export async function addDocWithAudit<AppModelType, DbModelType extends DocumentData>(
    reference: CollectionReference<AppModelType, DbModelType>,
    data: WithFieldValue<AppModelType>
) {
    const docRef = await addDoc(reference, data);
    try {
        const db = reference.firestore;
        await writeAuditLog(db, {
            actor: getCurrentActor(),
            action: 'CREATE',
            targetType: reference.path,
            targetId: docRef.id,
            newValue: data as any,
            module: reference.path,
            status: 'success',
        });
    } catch(e) { console.error('Audit log failed', e); }
    return docRef;
}

export async function updateDocWithAudit<AppModelType, DbModelType extends DocumentData>(
    reference: DocumentReference<AppModelType, DbModelType>,
    data: UpdateData<DbModelType>
) {
    await updateDoc(reference, data);
    try {
        const db = reference.firestore;
        const pathParts = reference.path.split('/');
        const targetType = pathParts.length > 1 ? pathParts[pathParts.length - 2] : reference.path;
        await writeAuditLog(db, {
            actor: getCurrentActor(),
            action: 'UPDATE',
            targetType: targetType,
            targetId: reference.id,
            newValue: data as any,
            module: targetType,
            status: 'success',
        });
    } catch(e) { console.error('Audit log failed', e); }
}

export async function setDocWithAudit<AppModelType, DbModelType extends DocumentData>(
    reference: DocumentReference<AppModelType, DbModelType>,
    data: WithFieldValue<AppModelType>,
    options?: SetOptions
) {
    if (options) {
        await setDoc(reference, data, options);
    } else {
        await setDoc(reference, data);
    }
    try {
        const db = reference.firestore;
        const pathParts = reference.path.split('/');
        const targetType = pathParts.length > 1 ? pathParts[pathParts.length - 2] : reference.path;
        await writeAuditLog(db, {
            actor: getCurrentActor(),
            action: 'SET',
            targetType: targetType,
            targetId: reference.id,
            newValue: data as any,
            module: targetType,
            status: 'success',
        });
    } catch(e) { console.error('Audit log failed', e); }
}

export async function deleteDocWithAudit<AppModelType, DbModelType extends DocumentData>(
    reference: DocumentReference<AppModelType, DbModelType>
) {
    await deleteDoc(reference);
    try {
        const db = reference.firestore;
        const pathParts = reference.path.split('/');
        const targetType = pathParts.length > 1 ? pathParts[pathParts.length - 2] : reference.path;
        await writeAuditLog(db, {
            actor: getCurrentActor(),
            action: 'DELETE',
            targetType: targetType,
            targetId: reference.id,
            module: targetType,
            status: 'success',
            impactLevel: 'high',
        });
    } catch(e) { console.error('Audit log failed', e); }
}
