/**
 * AUDIT LOGGER USAGE EXAMPLES
 * 
 * This file contains examples of how to use the audit logger throughout your application.
 * Copy these patterns into your actual code where needed.
 */

import {
    logAuditEvent,
    logAuthEvent,
    logDataAccess,
    logDataModification,
    logSecurityEvent,
    logApprovalEvent,
    getClientInfo,
    generateSessionId,
    generateTransactionId,
} from './auditLogger';

// ============================================================================
// EXAMPLE 1: Login Event
// ============================================================================
export async function exampleLoginSuccess(userId: string, userEmail: string, userName: string) {
    await logAuthEvent(
        'login',
        userId,
        userName,
        userEmail,
        'success',
        {
            note: 'User logged in successfully',
            module: 'authentication',
            sessionId: generateSessionId(), // Store this in session storage
        }
    );
}

export async function exampleLoginFailure(email: string) {
    await logAuthEvent(
        'login_failed',
        'unknown',
        'Unknown User',
        email,
        'failure',
        {
            note: 'Invalid credentials provided',
            errorMessage: 'Invalid email or password',
            errorCode: 'AUTH_001',
            module: 'authentication',
        }
    );
}

// ============================================================================
// EXAMPLE 2: Data Access (Viewing Records)
// ============================================================================
export async function exampleViewMaterialRequest(
    userId: string,
    userName: string,
    userRole: string,
    requestId: string,
    requestTitle: string
) {
    await logDataAccess(
        userId,
        userName,
        userRole,
        'material_request',
        requestId,
        requestTitle,
        'view',
        {
            note: 'Viewed material request details',
            module: 'material_requests',
            dataClassification: 'internal',
        }
    );
}

export async function exampleViewSensitiveData(
    userId: string,
    userName: string,
    userRole: string,
    recordId: string
) {
    await logDataAccess(
        userId,
        userName,
        userRole,
        'personnel_record',
        recordId,
        'Personnel Information',
        'view',
        {
            note: 'Accessed sensitive personnel information',
            module: 'personnel_management',
            dataClassification: 'confidential',
            impactLevel: 'high',
            complianceTags: ['GDPR', 'Data Protection'],
        }
    );
}

// ============================================================================
// EXAMPLE 3: Creating Records
// ============================================================================
export async function exampleCreateMaterialRequest(
    userId: string,
    userName: string,
    userRole: string,
    requestId: string,
    requestData: any
) {
    await logDataModification(
        userId,
        userName,
        userRole,
        'material_request',
        requestId,
        requestData.title || 'New Material Request',
        'create',
        undefined, // no old value for create
        requestData, // new value
        Object.keys(requestData), // all fields are new
        {
            note: 'Created new material request',
            module: 'material_requests',
            dataClassification: 'internal',
        }
    );
}

// ============================================================================
// EXAMPLE 4: Updating Records
// ============================================================================
export async function exampleUpdateMaterialRequest(
    userId: string,
    userName: string,
    userRole: string,
    requestId: string,
    requestTitle: string,
    oldData: any,
    newData: any
) {
    // Determine which fields changed
    const changedFields = Object.keys(newData).filter(
        key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
    );

    await logDataModification(
        userId,
        userName,
        userRole,
        'material_request',
        requestId,
        requestTitle,
        'update',
        oldData,
        newData,
        changedFields,
        {
            note: `Updated ${changedFields.length} field(s) in material request`,
            module: 'material_requests',
            changeReason: 'User requested modification',
        }
    );
}

// ============================================================================
// EXAMPLE 5: Deleting Records
// ============================================================================
export async function exampleDeleteMaterialRequest(
    userId: string,
    userName: string,
    userRole: string,
    requestId: string,
    requestTitle: string,
    requestData: any
) {
    await logDataModification(
        userId,
        userName,
        userRole,
        'material_request',
        requestId,
        requestTitle,
        'delete',
        requestData, // old value
        null, // no new value
        undefined,
        {
            note: 'Deleted material request',
            module: 'material_requests',
            impactLevel: 'high',
            changeReason: 'User requested deletion',
        }
    );
}

// ============================================================================
// EXAMPLE 6: Approval Workflow
// ============================================================================
export async function exampleApproveMaterialRequest(
    userId: string,
    userName: string,
    userRole: string,
    requestId: string,
    requestTitle: string,
    workflowId: string,
    position: number
) {
    await logApprovalEvent(
        userId,
        userName,
        userRole,
        'approve',
        workflowId,
        'material_request',
        requestId,
        requestTitle,
        position,
        {
            note: `Approved material request at approval level ${position}`,
            module: 'approval_workflow',
            department: 'Academic Affairs',
        }
    );
}

export async function exampleRejectMaterialRequest(
    userId: string,
    userName: string,
    userRole: string,
    requestId: string,
    requestTitle: string,
    workflowId: string,
    rejectionReason: string
) {
    await logApprovalEvent(
        userId,
        userName,
        userRole,
        'reject',
        workflowId,
        'material_request',
        requestId,
        requestTitle,
        undefined,
        {
            note: `Rejected material request: ${rejectionReason}`,
            module: 'approval_workflow',
            changeReason: rejectionReason,
        }
    );
}

// ============================================================================
// EXAMPLE 7: Security Events
// ============================================================================
export async function exampleUnauthorizedAccess(
    userId: string,
    userName: string,
    attemptedResource: string
) {
    await logSecurityEvent(
        'unauthorized_access_attempt',
        userId,
        userName,
        'denied',
        `User attempted to access ${attemptedResource} without proper permissions`,
        {
            targetType: 'resource',
            targetName: attemptedResource,
            module: 'authorization',
            errorCode: 'SEC_403',
        }
    );
}

export async function exampleSuspiciousActivity(
    userId: string,
    userName: string,
    activityDescription: string
) {
    await logSecurityEvent(
        'suspicious_activity_detected',
        userId,
        userName,
        'warning',
        activityDescription,
        {
            module: 'security_monitoring',
            impactLevel: 'critical',
            complianceTags: ['Security Alert'],
        }
    );
}

// ============================================================================
// EXAMPLE 8: Bulk Operations
// ============================================================================
export async function exampleBulkExport(
    userId: string,
    userName: string,
    userRole: string,
    recordCount: number,
    exportType: string
) {
    await logDataAccess(
        userId,
        userName,
        userRole,
        'bulk_export',
        generateTransactionId(),
        `${exportType} Export`,
        'export',
        {
            note: `Exported ${recordCount} records as ${exportType}`,
            module: 'data_export',
            metadata: {
                recordCount,
                exportType,
                exportFormat: exportType,
            },
            dataClassification: 'internal',
            impactLevel: 'medium',
        }
    );
}

// ============================================================================
// EXAMPLE 9: System Events
// ============================================================================
export async function exampleSystemConfiguration(
    userId: string,
    userName: string,
    configKey: string,
    oldValue: any,
    newValue: any
) {
    await logAuditEvent({
        actorId: userId,
        actorName: userName,
        actorRole: 'admin',
        action: 'system_configuration_change',
        actionCategory: 'system',
        status: 'success',
        targetType: 'system_config',
        targetId: configKey,
        targetName: configKey,
        oldValue,
        newValue,
        note: `Changed system configuration: ${configKey}`,
        module: 'system_settings',
        impactLevel: 'high',
        ...getClientInfo(),
    });
}

// ============================================================================
// EXAMPLE 10: API Request Logging (for use in API routes)
// ============================================================================
export async function exampleAPIRequest(
    request: Request,
    userId: string,
    userName: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
) {
    const clientInfo = getClientInfo(request);
    
    await logAuditEvent({
        actorId: userId,
        actorName: userName,
        action: `api_${method.toLowerCase()}_${endpoint.replace(/\//g, '_')}`,
        actionCategory: 'system',
        status: statusCode < 400 ? 'success' : 'failure',
        targetType: 'api_endpoint',
        targetName: endpoint,
        apiEndpoint: endpoint,
        module: 'api',
        duration,
        requestId: generateTransactionId(),
        ...clientInfo,
        metadata: {
            method,
            statusCode,
            endpoint,
        },
    });
}

// ============================================================================
// EXAMPLE 11: Password Change
// ============================================================================
export async function examplePasswordChange(
    userId: string,
    userName: string,
    userEmail: string,
    isReset: boolean = false
) {
    await logAuthEvent(
        isReset ? 'password_reset' : 'password_change',
        userId,
        userName,
        userEmail,
        'success',
        {
            note: isReset ? 'Password reset completed' : 'Password changed by user',
            module: 'authentication',
            impactLevel: 'medium',
            complianceTags: ['Security'],
        }
    );
}

// ============================================================================
// EXAMPLE 12: QR Code Scan
// ============================================================================
export async function exampleQRCodeScan(
    userId: string,
    userName: string,
    userRole: string,
    assetId: string,
    assetName: string
) {
    await logDataAccess(
        userId,
        userName,
        userRole,
        'asset',
        assetId,
        assetName,
        'qr_scan',
        {
            note: 'Scanned asset QR code',
            module: 'asset_management',
            actionCategory: 'data_access',
        }
    );
}

// ============================================================================
// EXAMPLE 13: Report Generation
// ============================================================================
export async function exampleReportGeneration(
    userId: string,
    userName: string,
    userRole: string,
    reportType: string,
    reportParams: any
) {
    await logAuditEvent({
        actorId: userId,
        actorName: userName,
        actorRole: userRole,
        action: 'report_generated',
        actionCategory: 'data_access',
        status: 'success',
        targetType: 'report',
        targetName: reportType,
        note: `Generated ${reportType} report`,
        module: 'reporting',
        metadata: reportParams,
        dataClassification: 'internal',
        ...getClientInfo(),
    });
}
