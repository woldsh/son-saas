# Audit Log Quick Reference Card

## Import Statements

```typescript
// Main logging function
import { logAuditEvent } from '@/lib/auditLogger';

// Helper functions
import {
    logAuthEvent,
    logDataAccess,
    logDataModification,
    logSecurityEvent,
    logApprovalEvent,
} from '@/lib/auditLogger';

// Utilities
import {
    getClientInfo,
    generateSessionId,
    generateTransactionId,
    generateRequestId,
} from '@/lib/auditLogger';

// Types
import type { AuditLogData } from '@/types/auditLog';

// Constants
import { AuditModules, ComplianceTags } from '@/types/auditLog';
```

## Quick Examples

### Login
```typescript
await logAuthEvent('login', user.id, user.name, user.email, 'success', {
    sessionId: generateSessionId(),
    module: AuditModules.AUTHENTICATION,
});
```

### Failed Login
```typescript
await logAuthEvent('login_failed', 'unknown', 'Unknown', email, 'failure', {
    errorMessage: 'Invalid credentials',
    module: AuditModules.AUTHENTICATION,
});
```

### View Record
```typescript
await logDataAccess(
    user.id, user.name, user.role,
    'material_request', requestId, requestTitle,
    'view',
    { module: AuditModules.MATERIAL_REQUESTS }
);
```

### Create Record
```typescript
await logDataModification(
    user.id, user.name, user.role,
    'material_request', newId, title,
    'create',
    undefined,
    newData,
    Object.keys(newData),
    { module: AuditModules.MATERIAL_REQUESTS }
);
```

### Update Record
```typescript
const changedFields = Object.keys(newData).filter(
    key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
);

await logDataModification(
    user.id, user.name, user.role,
    'material_request', id, title,
    'update',
    oldData,
    newData,
    changedFields,
    { module: AuditModules.MATERIAL_REQUESTS }
);
```

### Delete Record
```typescript
await logDataModification(
    user.id, user.name, user.role,
    'material_request', id, title,
    'delete',
    oldData,
    null,
    undefined,
    {
        module: AuditModules.MATERIAL_REQUESTS,
        impactLevel: 'high',
    }
);
```

### Approve
```typescript
await logApprovalEvent(
    user.id, user.name, user.role,
    'approve',
    workflowId,
    'material_request',
    requestId,
    requestTitle,
    approvalLevel,
    { module: AuditModules.APPROVAL_WORKFLOW }
);
```

### Reject
```typescript
await logApprovalEvent(
    user.id, user.name, user.role,
    'reject',
    workflowId,
    'material_request',
    requestId,
    requestTitle,
    undefined,
    {
        module: AuditModules.APPROVAL_WORKFLOW,
        changeReason: rejectionReason,
    }
);
```

### Unauthorized Access
```typescript
await logSecurityEvent(
    'unauthorized_access',
    user.id,
    user.name,
    'denied',
    `Attempted to access ${resourceName}`,
    {
        targetType: 'resource',
        targetName: resourceName,
        module: AuditModules.SECURITY_MONITORING,
    }
);
```

### Sensitive Data Access
```typescript
await logDataAccess(
    user.id, user.name, user.role,
    'personnel_record', recordId, recordName,
    'view',
    {
        module: AuditModules.PERSONNEL_MANAGEMENT,
        dataClassification: 'confidential',
        complianceTags: [ComplianceTags.GDPR],
        impactLevel: 'high',
    }
);
```

### Custom Event
```typescript
await logAuditEvent({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'custom_action',
    actionCategory: 'system',
    status: 'success',
    targetType: 'custom_target',
    targetId: targetId,
    targetName: targetName,
    note: 'Custom action description',
    module: 'custom_module',
    ...getClientInfo(),
});
```

## Field Reference

### Required Fields
- `actorId` - User ID
- `actorName` - User name
- `action` - Action performed

### Common Optional Fields
- `actorEmail` - User email
- `actorRole` - User role
- `actorDepartment` - User department
- `actionCategory` - authentication | authorization | data_access | data_modification | system | security
- `status` - success | failure | denied | warning
- `targetType` - Type of resource
- `targetId` - Resource ID
- `targetName` - Resource name
- `note` - Description
- `module` - Module name
- `impactLevel` - low | medium | high | critical
- `dataClassification` - public | internal | confidential | restricted
- `complianceTags` - Array of tags
- `sessionId` - Session ID
- `workflowId` - Workflow ID
- `errorMessage` - Error message
- `errorCode` - Error code
- `oldValue` - Previous value
- `newValue` - New value
- `changedFields` - Array of changed fields

## Status Values
- `success` - Operation completed successfully
- `failure` - Operation failed
- `denied` - Access denied
- `warning` - Warning condition

## Action Categories
- `authentication` - Login, logout, password changes
- `authorization` - Permission checks, role changes
- `data_access` - Viewing, reading, exporting
- `data_modification` - Creating, updating, deleting
- `system` - System configuration, maintenance
- `security` - Security events, suspicious activity

## Impact Levels
- `low` - Routine operations
- `medium` - Important operations
- `high` - Critical operations
- `critical` - Security-critical operations

## Data Classifications
- `public` - Publicly accessible
- `internal` - Internal use only
- `confidential` - Restricted access
- `restricted` - Highly sensitive

## Module Names (Constants)
```typescript
AuditModules.AUTHENTICATION
AuditModules.AUTHORIZATION
AuditModules.MATERIAL_REQUESTS
AuditModules.ASSET_MANAGEMENT
AuditModules.PERSONNEL_MANAGEMENT
AuditModules.APPROVAL_WORKFLOW
AuditModules.REPORTING
AuditModules.SYSTEM_SETTINGS
AuditModules.DATA_EXPORT
AuditModules.API
AuditModules.SECURITY_MONITORING
```

## Compliance Tags (Constants)
```typescript
ComplianceTags.GDPR
ComplianceTags.HIPAA
ComplianceTags.SOX
ComplianceTags.PCI_DSS
ComplianceTags.ISO_27001
ComplianceTags.DATA_PROTECTION
ComplianceTags.SECURITY
ComplianceTags.PRIVACY
```

## Utility Functions

### Get Client Info
```typescript
const clientInfo = getClientInfo(); // client-side
const clientInfo = getClientInfo(request); // server-side
```

### Generate IDs
```typescript
const sessionId = generateSessionId();
const transactionId = generateTransactionId();
const requestId = generateRequestId();
```

### Session Tracking
```typescript
// On login
const sessionId = generateSessionId();
sessionStorage.setItem('auditSessionId', sessionId);

// In subsequent logs
const sessionId = sessionStorage.getItem('auditSessionId');
```

## Error Handling
```typescript
try {
    await logAuditEvent({ /* ... */ });
} catch (error) {
    console.error('Failed to log audit event:', error);
    // Continue with operation
}
```

## Best Practices

### ✅ DO:
- Log all authentication events
- Log all data modifications
- Log security events
- Include meaningful notes
- Set appropriate impact levels
- Use data classification
- Track changed fields
- Capture client information
- Use helper functions
- Handle errors gracefully

### ❌ DON'T:
- Log passwords or credentials
- Log unnecessary PII
- Block operations waiting for logs
- Update or delete audit logs
- Log routine health checks
- Ignore logging errors

## View Logs

Navigate to: `/admin/audit-logs`

### Features:
- Search across all fields
- Filter by action, status, date
- View detailed information
- Export to CSV
- Pagination

## Troubleshooting

### Logs not appearing?
1. Check Firebase connection
2. Verify collection name: `activity_logs`
3. Check browser console
4. Verify Firestore permissions

### Missing information?
1. Use `getClientInfo()`
2. Check user data availability
3. Use helper functions
4. Verify required fields

### Performance issues?
1. Create Firestore indexes
2. Reduce query limit
3. Archive old logs

## Quick Links

- Full Documentation: `AUDIT_LOG_DOCUMENTATION.md`
- Migration Guide: `AUDIT_LOG_MIGRATION.md`
- Code Examples: `src/lib/auditLoggerExamples.ts`
- Type Definitions: `src/types/auditLog.ts`
