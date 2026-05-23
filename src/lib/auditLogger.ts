import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type {
    AuditLogData,
    DeviceType,
    ClientInfo,
    AuthAction,
    DataModificationAction,
    ApprovalAction,
} from '@/types/auditLog';

/**
 * Log an audit event to Firestore
 * @param data - Audit log data
 * @returns Promise with the document ID
 */
export async function logAuditEvent(data: AuditLogData): Promise<string> {
    if (!db) {
        console.error('Firebase not initialized');
        throw new Error('Firebase not initialized');
    }

    try {
        let realIp = data.ipAddress;
        let locationData = data.location;
        let sessionId = data.sessionId;
        
        if (typeof window !== 'undefined') {
            if (!sessionId) {
                sessionId = sessionStorage.getItem('auditSessionId');
                if (!sessionId) {
                    sessionId = generateSessionId();
                    sessionStorage.setItem('auditSessionId', sessionId);
                }
            }
            
            try {
                const cachedIp = sessionStorage.getItem('clientIp');
                const cachedLocation = sessionStorage.getItem('clientLocation');
                if (cachedIp) {
                    realIp = realIp || cachedIp;
                    if (cachedLocation && !locationData) locationData = JSON.parse(cachedLocation);
                } else if (!realIp) {
                    const ipRes = await fetch('https://ipapi.co/json/').catch(() => null);
                    if (ipRes && ipRes.ok) {
                        const ipData = await ipRes.json();
                        realIp = ipData.ip;
                        locationData = { city: ipData.city, country: ipData.country_name, region: ipData.region };
                        sessionStorage.setItem('clientIp', realIp || '');
                        sessionStorage.setItem('clientLocation', JSON.stringify(locationData));
                    } else {
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
        
        const docRef = await addDoc(collection(db, 'activity_logs'), {
            ...data,
            ipAddress: realIp || null,
            location: locationData || null,
            sessionId: sessionId || null,
            apiEndpoint: data.apiEndpoint || (typeof window !== 'undefined' ? window.location.pathname : 'Firestore API'),
            serviceName: data.serviceName || 'Property Management System',
            appVersion: data.appVersion || process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
            createdAt: serverTimestamp(),
        });
        
        return docRef.id;
    } catch (error) {
        console.error('Failed to log audit event:', error);
        throw error;
    }
}

/**
 * Get device type from user agent
 */
export function getDeviceType(userAgent: string): DeviceType {
    const ua = userAgent.toLowerCase();
    
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
        return 'mobile';
    }
    if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
        return 'desktop';
    }
    
    return 'unknown';
}

/**
 * Get browser name from user agent
 */
export function getBrowserName(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('edg/')) return 'Edge';
    if (ua.includes('chrome/')) return 'Chrome';
    if (ua.includes('firefox/')) return 'Firefox';
    if (ua.includes('safari/') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('opera/') || ua.includes('opr/')) return 'Opera';
    if (ua.includes('trident/')) return 'Internet Explorer';
    
    return 'Unknown';
}

/**
 * Get client information from request (for use in API routes)
 */
export function getClientInfo(request?: Request): ClientInfo {
    if (typeof window !== 'undefined') {
        // Client-side
        return {
            userAgent: navigator.userAgent,
            deviceType: getDeviceType(navigator.userAgent),
            browser: getBrowserName(navigator.userAgent),
        };
    }
    
    if (request) {
        // Server-side with request
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ipAddress = request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         'Unknown';
        
        return {
            userAgent,
            ipAddress,
            deviceType: getDeviceType(userAgent),
            browser: getBrowserName(userAgent),
        };
    }
    
    return {
        userAgent: 'Unknown',
        deviceType: 'unknown',
        browser: 'Unknown',
    };
}

/**
 * Generate a session ID (call once per session and store)
 */
export function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a transaction ID (call for each transaction)
 */
export function generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a request ID (call for each API request)
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Helper function to log authentication events
 */
export async function logAuthEvent(
    action: AuthAction,
    actorId: string,
    actorName: string,
    actorEmail: string,
    status: 'success' | 'failure' | 'denied',
    additionalData?: Partial<AuditLogData>
) {
    const clientInfo = getClientInfo();
    
    return logAuditEvent({
        actorId,
        actorName,
        actorEmail,
        action,
        actionCategory: 'authentication',
        status,
        targetType: 'user_session',
        targetId: actorId,
        targetName: actorName,
        impactLevel: status === 'failure' ? 'high' : 'low',
        ...clientInfo,
        ...additionalData,
    });
}

/**
 * Helper function to log data access events
 */
export async function logDataAccess(
    actorId: string,
    actorName: string,
    actorRole: string,
    targetType: string,
    targetId: string,
    targetName: string,
    action: string = 'view',
    additionalData?: Partial<AuditLogData>
) {
    const clientInfo = getClientInfo();
    
    return logAuditEvent({
        actorId,
        actorName,
        actorRole,
        action: `${targetType}_${action}`,
        actionCategory: 'data_access',
        status: 'success',
        targetType,
        targetId,
        targetName,
        impactLevel: 'low',
        ...clientInfo,
        ...additionalData,
    });
}

/**
 * Helper function to log data modification events
 */
export async function logDataModification(
    actorId: string,
    actorName: string,
    actorRole: string,
    targetType: string,
    targetId: string,
    targetName: string,
    action: DataModificationAction,
    oldValue?: unknown,
    newValue?: unknown,
    changedFields?: string[],
    additionalData?: Partial<AuditLogData>
) {
    const clientInfo = getClientInfo();
    
    return logAuditEvent({
        actorId,
        actorName,
        actorRole,
        action: `${targetType}_${action}`,
        actionCategory: 'data_modification',
        status: 'success',
        targetType,
        targetId,
        targetName,
        oldValue,
        newValue,
        changedFields,
        impactLevel: action === 'delete' ? 'high' : 'medium',
        ...clientInfo,
        ...additionalData,
    });
}

/**
 * Helper function to log security events
 */
export async function logSecurityEvent(
    action: string,
    actorId: string,
    actorName: string,
    status: 'success' | 'failure' | 'denied' | 'warning',
    note: string,
    additionalData?: Partial<AuditLogData>
) {
    const clientInfo = getClientInfo();
    
    return logAuditEvent({
        actorId,
        actorName,
        action,
        actionCategory: 'security',
        status,
        note,
        impactLevel: 'critical',
        ...clientInfo,
        ...additionalData,
    });
}

/**
 * Helper function to log approval workflow events
 */
export async function logApprovalEvent(
    actorId: string,
    actorName: string,
    actorRole: string,
    action: ApprovalAction,
    workflowId: string,
    targetType: string,
    targetId: string,
    targetName: string,
    approvalChainPosition?: number,
    additionalData?: Partial<AuditLogData>
) {
    const clientInfo = getClientInfo();
    
    return logAuditEvent({
        actorId,
        actorName,
        actorRole,
        action: `${targetType}_${action}`,
        actionCategory: 'data_modification',
        status: 'success',
        targetType,
        targetId,
        targetName,
        workflowId,
        approvalChainPosition,
        impactLevel: 'medium',
        ...clientInfo,
        ...additionalData,
    });
}
