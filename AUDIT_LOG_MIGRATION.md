# Audit Log Migration Guide

## Overview

This guide helps you migrate from the basic audit log system to the comprehensive audit log system with enhanced fields.

## What's New

### New Fields Added

1. **Actor Information**
   - `actorDepartment` - User's department

2. **Action Details**
   - `actionCategory` - Categorizes actions (authentication, authorization, data_access, data_modification, system, security)
   - `status` - Result status (success, failure, denied, warning)
   - `errorMessage` - Error message for failures
   - `errorCode` - Error code for failures

3. **Source Information**
   - `ipAddress` - Client IP address
   - `userAgent` - Browser user agent
   - `deviceType` - Device type (desktop, mobile, tablet)
   - `browser` - Browser name
   - `location` - Geographic location

4. **Session & Transaction**
   - `sessionId` - Session identifier
   - `transactionId` - Transaction identifier
   - `requestId` - Request identifier

5. **System Details**
   - `module` - Application module
   - `apiEndpoint` - API endpoint
   - `serviceName` - Service name
   - `appVersion` - Application version

6. **Change Tracking**
   - `changedFields` - Array of changed field names
   - `changeReason` - Reason for change

7. **Business Context**
   - `workflowId` - Workflow identifier
   - `approvalChainPosition` - Position in approval chain
   - `department` - Department involved
   - `impactLevel` - Impact level (low, medium, high, critical)

8. **Performance**
   - `duration` - Action duration in milliseconds

9. **Compliance**
   - `dataClassification` - Data classification level
   - `complianceTags` - Compliance tags array
   - `retentionPeriod` - Retention period in days

## Migration Steps

### Step 1: Backup Existing Logs

Before making changes, export your existing audit logs:

1. Go to `/admin/audit-logs`
2. Click "Export to CSV"
3. Save the file as backup

### Step 2: Update Firestore Security Rules (Optional)

If you have strict security rules, update them to allow the new fields:

```javascript
match /activity_logs/{logId} {
  allow read: if request.auth != null && 
              request.auth.token.role in ['admin', 'system_admin'];
  allow create: if request.auth != null;
  allow update, delete: if false; // Audit logs should be immutable
}
```

### Step 3: Update Existing Code

#### Before (Old Code)
```typescript
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

await addDoc(collection(db, 'activity_logs'), {
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'material_request_create',
    targetType: 'material_request',
    targetId: requestId,
    targetName: requestTitle,
    note: 'Created new material request',
    createdAt: serverTimestamp(),
});
```

#### After (New Code)
```typescript
import { logDataModification } from '@/lib/auditLogger';

await logDataModification(
    user.id,
    user.name,
    user.role,
    'material_request',
    requestId,
    requestTitle,
    'create',
    undefined, // old value
    requestData, // new value
    Object.keys(requestData), // changed fields
    {
        note: 'Created new material request',
        module: 'material_requests',
        dataClassification: 'internal',
    }
);
```

### Step 4: Add Client Information

Update your code to capture client information:

```typescript
import { logAuditEvent, getClientInfo } from '@/lib/auditLogger';

const clientInfo = getClientInfo();

await logAuditEvent({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'material_request_view',
    actionCategory: 'data_access',
    status: 'success',
    targetType: 'material_request',
    targetId: requestId,
    targetName: requestTitle,
    module: 'material_requests',
    ...clientInfo, // Adds IP, device, browser info
});
```

### Step 5: Add Session Tracking

Generate and store session IDs:

```typescript
import { generateSessionId } from '@/lib/auditLogger';

// On login, generate and store session ID
const sessionId = generateSessionId();
sessionStorage.setItem('auditSessionId', sessionId);

// Use in subsequent logs
const sessionId = sessionStorage.getItem('auditSessionId');

await logAuditEvent({
    // ... other fields
    sessionId,
});
```

### Step 6: Update Authentication Logs

Replace manual authentication logging with helper:

#### Before
```typescript
await addDoc(collection(db, 'activity_logs'), {
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: 'login',
    createdAt: serverTimestamp(),
});
```

#### After
```typescript
import { logAuthEvent, generateSessionId } from '@/lib/auditLogger';

const sessionId = generateSessionId();
sessionStorage.setItem('auditSessionId', sessionId);

await logAuthEvent('login', user.id, user.name, user.email, 'success', {
    sessionId,
    module: 'authentication',
});
```

### Step 7: Add Error Logging

Track failures and errors:

```typescript
try {
    // Perform operation
    await updateMaterialRequest(requestId, data);
    
    await logDataModification(
        user.id, user.name, user.role,
        'material_request', requestId, requestTitle,
        'update',
        oldData, newData, changedFields,
        {
            status: 'success',
            module: 'material_requests',
        }
    );
} catch (error) {
    await logDataModification(
        user.id, user.name, user.role,
        'material_request', requestId, requestTitle,
        'update',
        oldData, newData, changedFields,
        {
            status: 'failure',
            errorMessage: error.message,
            errorCode: error.code || 'UNKNOWN',
            module: 'material_requests',
        }
    );
    throw error;
}
```

### Step 8: Add Approval Workflow Tracking

Track approval chains:

```typescript
import { logApprovalEvent } from '@/lib/auditLogger';

await logApprovalEvent(
    user.id,
    user.name,
    user.role,
    'approve', // or 'reject'
    workflowId,
    'material_request',
    requestId,
    requestTitle,
    approvalLevel, // e.g., 1, 2, 3
    {
        note: `Approved at level ${approvalLevel}`,
        module: 'approval_workflow',
        department: user.department,
    }
);
```

## Common Migration Patterns

### Pattern 1: Simple View Action

**Before:**
```typescript
await addDoc(collection(db, 'activity_logs'), {
    actorId: user.id,
    actorName: user.name,
    action: 'view_request',
    targetId: requestId,
    createdAt: serverTimestamp(),
});
```

**After:**
```typescript
import { logDataAccess } from '@/lib/auditLogger';

await logDataAccess(
    user.id, user.name, user.role,
    'material_request', requestId, requestTitle,
    'view',
    { module: 'material_requests' }
);
```

### Pattern 2: Create Action

**Before:**
```typescript
await addDoc(collection(db, 'activity_logs'), {
    actorId: user.id,
    actorName: user.name,
    action: 'create_request',
    targetId: newRequest.id,
    newValue: newRequest,
    createdAt: serverTimestamp(),
});
```

**After:**
```typescript
import { logDataModification } from '@/lib/auditLogger';

await logDataModification(
    user.id, user.name, user.role,
    'material_request', newRequest.id, newRequest.title,
    'create',
    undefined,
    newRequest,
    Object.keys(newRequest),
    { module: 'material_requests' }
);
```

### Pattern 3: Update Action

**Before:**
```typescript
await addDoc(collection(db, 'activity_logs'), {
    actorId: user.id,
    actorName: user.name,
    action: 'update_request',
    targetId: requestId,
    oldValue: oldData,
    newValue: newData,
    createdAt: serverTimestamp(),
});
```

**After:**
```typescript
import { logDataModification } from '@/lib/auditLogger';

const changedFields = Object.keys(newData).filter(
    key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
);

await logDataModification(
    user.id, user.name, user.role,
    'material_request', requestId, requestTitle,
    'update',
    oldData,
    newData,
    changedFields,
    {
        module: 'material_requests',
        changeReason: 'User requested update',
    }
);
```

## Backward Compatibility

The new audit log viewer is backward compatible with old logs. Old logs will display with:
- Missing fields shown as "N/A"
- Default status of "success" if not specified
- No impact level indicator if not set

## Testing Migration

1. **Test with existing logs:**
   - Open `/admin/audit-logs`
   - Verify old logs still display correctly
   - Check that filters work with old logs

2. **Test new logs:**
   - Perform an action that creates a new log
   - Verify all new fields are captured
   - Check that expanded view shows all details

3. **Test filtering:**
   - Filter by status (should work with new logs)
   - Filter by action (should work with both old and new)
   - Search functionality (should work with both)

4. **Test export:**
   - Export logs to CSV
   - Verify all fields are included
   - Check that old logs export correctly

## Rollback Plan

If you need to rollback:

1. **Keep the old component:**
   ```bash
   # Rename the new component
   mv src/components/AuditLogView.tsx src/components/AuditLogViewNew.tsx
   
   # Restore from backup (if you made one)
   # Or revert the changes in git
   ```

2. **Remove new dependencies:**
   - Delete `src/lib/auditLogger.ts`
   - Delete `src/lib/auditLoggerExamples.ts`

3. **Restore old logging code:**
   - Revert to direct Firestore calls
   - Remove helper function imports

## Performance Considerations

### Firestore Indexes

Create composite indexes for better query performance:

1. Go to Firebase Console → Firestore → Indexes
2. Create composite index:
   - Collection: `activity_logs`
   - Fields: `createdAt` (Descending), `status` (Ascending)
   - Fields: `createdAt` (Descending), `action` (Ascending)
   - Fields: `createdAt` (Descending), `actorId` (Ascending)

### Query Optimization

The new component loads 500 logs by default (increased from 150). If performance is an issue:

1. Reduce the limit in `AuditLogView.tsx`:
   ```typescript
   limit(200) // Instead of 500
   ```

2. Implement server-side pagination
3. Add date range to Firestore query (not just client-side filter)

## Support

If you encounter issues during migration:

1. Check the console for errors
2. Verify Firebase permissions
3. Review the examples in `auditLoggerExamples.ts`
4. Refer to `AUDIT_LOG_DOCUMENTATION.md`

## Checklist

- [ ] Backup existing audit logs
- [ ] Update Firestore security rules (if needed)
- [ ] Install new audit log component
- [ ] Update authentication logging
- [ ] Update CRUD operation logging
- [ ] Add client information capture
- [ ] Implement session tracking
- [ ] Add error logging
- [ ] Update approval workflow logging
- [ ] Test with existing logs
- [ ] Test new log creation
- [ ] Test filtering and search
- [ ] Test CSV export
- [ ] Create Firestore indexes
- [ ] Update documentation for your team
