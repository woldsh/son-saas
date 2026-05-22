import { addDoc, updateDoc, setDoc, deleteDoc, collection, serverTimestamp, type Firestore, type CollectionReference, type DocumentReference, type WithFieldValue, type UpdateData, type SetOptions, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export type AuditActor = {
    id: string;
    name: string;
    email?: string | null;
    role?: string | null;
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
};

export function buildAuditActor(user: User | null, role?: string | null, fallbackName = 'System User'): AuditActor {
    return {
        id: user?.uid || 'anonymous',
        name: user?.displayName || user?.email || fallbackName,
        email: user?.email || null,
        role: role || null,
    };
}

export async function writeAuditLog(db: Firestore | null, input: AuditLogInput) {
    if (!db) return;

    await addDoc(collection(db, 'activity_logs'), {
        actorId: input.actor.id,
        actorName: input.actor.name,
        actorEmail: input.actor.email || null,
        actorRole: input.actor.role || null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId || null,
        targetName: input.targetName || null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        note: input.note || '',
        metadata: input.metadata || {},
        createdAt: serverTimestamp(),
    });
}

function getCurrentActor(): AuditActor {
    const user = auth?.currentUser || null;
    return buildAuditActor(user);
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
        });
    } catch(e) { console.error('Audit log failed', e); }
}
