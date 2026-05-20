import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';

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
