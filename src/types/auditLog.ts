/**
 * Audit Log Type Definitions
 * 
 * Centralized type definitions for the audit log system.
 * Import these types throughout your application for type safety.
 */

/**
 * Action categories for audit logs
 */
export type AuditActionCategory = 
    | 'authentication'    // Login, logout, password changes
    | 'authorization'     // Permission checks, role changes
    | 'data_access'       // Viewing, reading, exporting data
    | 'data_modification' // Creating, updating, deleting data
    | 'system'           // System configuration, maintenance
    | 'security';        // Security events, suspicious activity

/**
 * Status of the audit log event
 */
export type AuditStatus = 
    | 'success'  // Operation completed successfully
    | 'failure'  // Operation failed
    | 'denied'   // Access denied
    | 'warning'; // Warning condition

/**
 * Device type
 */
export type DeviceType = 
    | 'desktop' 
    | 'mobile' 
    | 'tablet' 
    | 'unknown';

/**
 * Impact level of the action
 */
export type ImpactLevel = 
    | 'low'      // Routine operations
    | 'medium'   // Important operations
    | 'high'     // Critical operations
    | 'critical'; // Security-critical operations

/**
 * Data classification level
 */
export type DataClassification = 
    | 'public'       // Publicly accessible
    | 'internal'     // Internal use only
    | 'confidential' // Restricted access
    | 'restricted';  // Highly sensitive

/**
 * Geographic location information
 */
export interface AuditLocation {
    city?: string;
    country?: string;
    region?: string;
}

/**
 * Complete audit log entry structure
 */
export interface AuditLog {
    id: string;
    
    // Actor Information
    actorId: string;
    actorName: string;
    actorEmail?: string | null;
    actorRole?: string | null;
    actorDepartment?: string | null;
    
    // Action Details
    action: string;
    actionCategory?: AuditActionCategory;
    
    // Target Information
    targetType?: string;
    targetId?: string | null;
    targetName?: string | null;
    
    // Result & Status
    status?: AuditStatus;
    errorMessage?: string | null;
    errorCode?: string | null;
    
    // Source Information
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceType?: DeviceType;
    browser?: string | null;
    location?: AuditLocation | null;
    
    // Session & Transaction
    sessionId?: string | null;
    transactionId?: string | null;
    requestId?: string | null;
    
    // System Details
    module?: string | null;
    apiEndpoint?: string | null;
    serviceName?: string | null;
    appVersion?: string | null;
    
    // Change Tracking
    note?: string;
    oldValue?: unknown;
    newValue?: unknown;
    changedFields?: string[];
    changeReason?: string | null;
    
    // Business Context
    workflowId?: string | null;
    approvalChainPosition?: number | null;
    department?: string | null;
    impactLevel?: ImpactLevel;
    
    // Performance
    duration?: number | null; // in milliseconds
    
    // Compliance
    dataClassification?: DataClassification;
    complianceTags?: string[];
    retentionPeriod?: number | null; // in days
    
    // Metadata
    metadata?: Record<string, unknown>;
    createdAt?: {
        toDate?: () => Date;
        seconds?: number;
    } | string | null;
}

/**
 * Audit log data for creating new entries (without id and createdAt)
 */
export type AuditLogData = Omit<AuditLog, 'id' | 'createdAt'> & {
    actorId: string;
    actorName: string;
    action: string;
};

/**
 * Authentication action types
 */
export type AuthAction = 
    | 'login'
    | 'logout'
    | 'login_failed'
    | 'password_change'
    | 'password_reset'
    | 'mfa_enabled'
    | 'mfa_disabled'
    | 'session_timeout'
    | 'account_locked';

/**
 * Data modification action types
 */
export type DataModificationAction = 
    | 'create'
    | 'update'
    | 'delete';

/**
 * Approval action types
 */
export type ApprovalAction = 
    | 'approve'
    | 'reject'
    | 'submit';

/**
 * Client information structure
 */
export interface ClientInfo {
    userAgent: string;
    ipAddress?: string;
    deviceType: DeviceType;
    browser: string;
    location?: AuditLocation;
}

/**
 * Audit log filter options
 */
export interface AuditLogFilters {
    searchTerm?: string;
    action?: string;
    status?: AuditStatus | 'all';
    dateRange?: 'all' | 'today' | 'week' | 'month' | '3months';
    actorId?: string;
    targetType?: string;
    module?: string;
    impactLevel?: ImpactLevel;
}

/**
 * Audit log statistics
 */
export interface AuditLogStats {
    total: number;
    success: number;
    failure: number;
    denied: number;
    authentication: number;
    security: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

/**
 * Export options
 */
export interface ExportOptions {
    format: 'csv' | 'json' | 'pdf';
    filters?: AuditLogFilters;
    includeFields?: (keyof AuditLog)[];
    dateRange?: {
        start: Date;
        end: Date;
    };
}

/**
 * Common module names (for consistency)
 */
export const AuditModules = {
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    MATERIAL_REQUESTS: 'material_requests',
    ASSET_MANAGEMENT: 'asset_management',
    PERSONNEL_MANAGEMENT: 'personnel_management',
    APPROVAL_WORKFLOW: 'approval_workflow',
    REPORTING: 'reporting',
    SYSTEM_SETTINGS: 'system_settings',
    DATA_EXPORT: 'data_export',
    API: 'api',
    SECURITY_MONITORING: 'security_monitoring',
} as const;

/**
 * Common compliance tags
 */
export const ComplianceTags = {
    GDPR: 'GDPR',
    HIPAA: 'HIPAA',
    SOX: 'SOX',
    PCI_DSS: 'PCI DSS',
    ISO_27001: 'ISO 27001',
    DATA_PROTECTION: 'Data Protection',
    SECURITY: 'Security',
    PRIVACY: 'Privacy',
} as const;

/**
 * Common error codes
 */
export const AuditErrorCodes = {
    AUTH_001: 'AUTH_001', // Invalid credentials
    AUTH_002: 'AUTH_002', // Account locked
    AUTH_003: 'AUTH_003', // Session expired
    SEC_403: 'SEC_403',   // Forbidden
    SEC_401: 'SEC_401',   // Unauthorized
    DATA_001: 'DATA_001', // Validation error
    DATA_002: 'DATA_002', // Not found
    SYS_001: 'SYS_001',   // System error
    SYS_002: 'SYS_002',   // Database error
} as const;

/**
 * Type guard to check if a value is a valid AuditStatus
 */
export function isAuditStatus(value: unknown): value is AuditStatus {
    return typeof value === 'string' && 
           ['success', 'failure', 'denied', 'warning'].includes(value);
}

/**
 * Type guard to check if a value is a valid AuditActionCategory
 */
export function isAuditActionCategory(value: unknown): value is AuditActionCategory {
    return typeof value === 'string' && 
           ['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security'].includes(value);
}

/**
 * Type guard to check if a value is a valid ImpactLevel
 */
export function isImpactLevel(value: unknown): value is ImpactLevel {
    return typeof value === 'string' && 
           ['low', 'medium', 'high', 'critical'].includes(value);
}

/**
 * Type guard to check if a value is a valid DataClassification
 */
export function isDataClassification(value: unknown): value is DataClassification {
    return typeof value === 'string' && 
           ['public', 'internal', 'confidential', 'restricted'].includes(value);
}
