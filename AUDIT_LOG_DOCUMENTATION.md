# Audit Log System Documentation

## Overview

The audit log system provides comprehensive tracking of all actions and events in the property management system. It captures who did what, when, where, and how, ensuring full accountability and compliance.

## Features

### Core Capabilities

1. **Comprehensive Event Tracking**
   - User authentication (login, logout, password changes)
   - Data access (viewing, exporting)
   - Data modifications (create, update, delete)
   - Approval workflows
   - Security events
   - System configuration changes

2. **Rich Context Information**
   - Actor details (who performed the action)
   - Source information (IP address, device, browser, location)
   - Session and transaction tracking
   - System details (module, API endpoint, version)
   - Performance metrics (duration)
   - Business context (workflow, department, approval chain)

3. **Advanced Filtering**
   - Search across all fields
   - Filter by action type
   - Filter by status (success, failure, denied, warning)
   - Date range filtering (today, last 7 days, 30 days, 90 days, all time)
   - Pagination support

4. **Export Capabilities**
   - Export filtered logs to CSV
   - Includes all relevant fields for compliance reporting

5. **Visual Status Indicators**
   - Color-coded status badges
   - Impact level indicators
   - Compliance tags
   - Changed field tracking

## Data Structure

### Audit Log Fields

#### Actor Information
- `actorId` - Unique identifier of the user
- `actorName` - Display name of the user
- `actorEmail` - Email address
- `actorRole` - User's role at time of action
- `actorDepartment` - User's department

#### Action Details
- `action` - Action performed (e.g., "login", "material_request_create")
- `actionCategory` - Category: authentication, authorization, data_access, data_modification, system, security
- `status` - Result: success, failure, denied, warning

#### Target Information
- `targetType` - Type of resource affected
- `targetId` - Unique identifier of the resource
- `targetName` - Display name of the resource

#### Source Information
- `ipAddress` - IP address of the client
- `userAgent` - Browser user agent string
- `deviceType` - desktop, mobile, tablet, unknown
- `browser` - Browser name
- `location` - Geographic location (city, country, region)

#### Session & Transaction
- `sessionId` - Session identifier
- `transactionId` - Transaction identifier
- `requestId` - API request identifier

#### System Details
- `module` - Application module (e.g., "material_requests", "authentication")
- `apiEndpoint` - API endpoint called
- `serviceName` - Microservice name
- `appVersion` - Application version

#### Change Tracking
- `note` - Human-readable description
- `oldValue` - Previous value (for updates)
- `newValue` - New value (for creates/updates)
- `changedFields` - Array of field names that changed
- `changeReason` - Reason for the change

#### Business Context
- `workflowId` - Workflow identifier
- `approvalChainPosition` - Position in approval chain
- `department` - Department involved
- `impactLevel` - low, medium, high, critical

#### Performance
- `duration` - Action duration in milliseconds

#### Compliance
- `dataClassification` - public, internal, confidential, restricted
- `complianceTags` - Array of compliance tags (e.g., ["GDPR", "HIPAA"])
- `retentionPeriod` - Retention period in days

#### Metadata
- `metadata` - Additional custom data
- `createdAt` - Timestamp (auto-generated)

## Usage

### Basic Logging

```typescript
import { logAuditEvent } from '@/lib/auditLogger';

await logAuditEvent({
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'material_request_create',
    actionCategory: 'data_modification',
    status: 'success',
    targetType: 'material_request',
    targetId: requestId,
    targetName: requestTitle,
    note: 'Created new material request',
    module: 'material_requests',
});
```

### Helper Functions

#### Authentication Events
```typescript
import { logAuthEvent } from '@/lib/auditLogger';

// Login success
await logAuthEvent('login', userId, userName, userEmail, 'success', {
    note: 'User logged in successfully',
    module: 'authentication',
});

// Login failure
await logAuthEvent('login_failed', 'unknown', 'Unknown User', email, 'failure', {
    note: 'Invalid credentials',
    errorMessage: 'Invalid email or password',
});
```

#### Data Access
```typescript
import { logDataAccess } from '@/lib/auditLogger';

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
    }
);
```

#### Data Modification
```typescript
import { logDataModification } from '@/lib/auditLogger';

// Create
await logDataModification(
    userId, userName, userRole,
    'material_request', requestId, requestTitle,
    'create',
    undefined, // no old value
    newData,
    Object.keys(newData),
    { note: 'Created new material request' }
);

// Update
await logDataModification(
    userId, userName, userRole,
    'material_request', requestId, requestTitle,
    'update',
    oldData,
    newData,
    changedFields,
    { note: 'Updated material request' }
);

// Delete
await logDataModification(
    userId, userName, userRole,
    'material_request', requestId, requestTitle,
    'delete',
    oldData,
    null,
    undefined,
    { note: 'Deleted material request' }
);
```

#### Security Events
```typescript
import { logSecurityEvent } from '@/lib/auditLogger';

await logSecurityEvent(
    'unauthorized_access_attempt',
    userId,
    userName,
    'denied',
    'User attempted to access restricted resource',
    {
        targetType: 'resource',
        targetName: resourceName,
    }
);
```

#### Approval Workflow
```typescript
import { logApprovalEvent } from '@/lib/auditLogger';

await logApprovalEvent(
    userId, userName, userRole,
    'approve',
    workflowId,
    'material_request',
    requestId,
    requestTitle,
    approvalPosition,
    { note: 'Approved material request' }
);
```

### Utility Functions

```typescript
import {
    getClientInfo,
    generateSessionId,
    generateTransactionId,
    generateRequestId,
    getDeviceType,
    getBrowserName,
} from '@/lib/auditLogger';

// Get client information
const clientInfo = getClientInfo(); // client-side
const clientInfo = getClientInfo(request); // server-side

// Generate IDs
const sessionId = generateSessionId();
const transactionId = generateTransactionId();
const requestId = generateRequestId();

// Parse user agent
const deviceType = getDeviceType(navigator.userAgent);
const browser = getBrowserName(navigator.userAgent);
```

## Implementation Guide

### Step 1: Add to Authentication Flow

In your login/logout handlers:

```typescript
// On successful login
await logAuthEvent('login', user.id, user.name, user.email, 'success', {
    sessionId: generateSessionId(), // Store in session
});

// On logout
await logAuthEvent('logout', user.id, user.name, user.email, 'success');

// On failed login
await logAuthEvent('login_failed', 'unknown', 'Unknown', email, 'failure', {
    errorMessage: 'Invalid credentials',
});
```

### Step 2: Add to CRUD Operations

In your create/update/delete functions:

```typescript
// After creating a record
await logDataModification(
    user.id, user.name, user.role,
    'material_request', newRecord.id, newRecord.title,
    'create',
    undefined,
    newRecord,
    Object.keys(newRecord)
);

// After updating a record
await logDataModification(
    user.id, user.name, user.role,
    'material_request', record.id, record.title,
    'update',
    oldRecord,
    updatedRecord,
    changedFields
);
```

### Step 3: Add to Approval Workflows

In your approval handlers:

```typescript
await logApprovalEvent(
    user.id, user.name, user.role,
    'approve',
    workflow.id,
    'material_request',
    request.id,
    request.title,
    currentApprovalLevel
);
```

### Step 4: Add to Security-Sensitive Operations

```typescript
// Unauthorized access
if (!hasPermission) {
    await logSecurityEvent(
        'unauthorized_access',
        user.id, user.name,
        'denied',
        `Attempted to access ${resourceName}`
    );
    throw new Error('Unauthorized');
}

// Sensitive data access
await logDataAccess(
    user.id, user.name, user.role,
    'personnel_record', recordId, recordName,
    'view',
    {
        dataClassification: 'confidential',
        complianceTags: ['GDPR'],
        impactLevel: 'high',
    }
);
```

## Best Practices

### 1. Always Log These Events
- Authentication (login, logout, password changes)
- Authorization failures
- Data modifications (create, update, delete)
- Sensitive data access
- Approval decisions
- System configuration changes
- Bulk operations

### 2. Include Sufficient Context
- Always include actor information
- Add meaningful notes
- Track old and new values for updates
- Include business context (workflow, department)
- Set appropriate impact levels

### 3. Security Considerations
- Never log passwords or sensitive credentials
- Be careful with PII in logs
- Use data classification appropriately
- Set retention periods based on compliance requirements

### 4. Performance
- Log asynchronously when possible
- Don't block user operations waiting for logs
- Use try-catch to prevent logging failures from breaking functionality

```typescript
try {
    await logAuditEvent({ /* ... */ });
} catch (error) {
    console.error('Failed to log audit event:', error);
    // Continue with the operation
}
```

### 5. Consistency
- Use consistent action naming (e.g., `{resource}_{action}`)
- Use consistent module names
- Use helper functions for common patterns
- Document custom action types

## Viewing Audit Logs

Access the audit log viewer at: `/admin/audit-logs`

### Features:
- Search across all fields
- Filter by action type, status, and date range
- View detailed information by clicking on any log entry
- Export filtered results to CSV
- Pagination for large datasets

### Statistics Dashboard:
- Total logs
- Success count
- Failure count
- Denied access count
- Authentication events
- Security events

## Compliance

### Data Retention
- Default: Logs are retained indefinitely
- Configurable: Set `retentionPeriod` field for automatic cleanup
- Manual: Export and archive old logs periodically

### Compliance Tags
Use compliance tags to mark logs for specific regulations:
- GDPR (General Data Protection Regulation)
- HIPAA (Health Insurance Portability and Accountability Act)
- SOX (Sarbanes-Oxley Act)
- PCI DSS (Payment Card Industry Data Security Standard)

### Data Classification
Mark logs with appropriate classification:
- `public` - No restrictions
- `internal` - Internal use only
- `confidential` - Restricted access
- `restricted` - Highly sensitive

## Troubleshooting

### Logs Not Appearing
1. Check Firebase connection
2. Verify collection name is `activity_logs`
3. Check browser console for errors
4. Verify user has permission to write to Firestore

### Performance Issues
1. Add indexes in Firestore for `createdAt` field
2. Reduce the limit in the query (currently 500)
3. Implement server-side pagination
4. Archive old logs

### Missing Information
1. Ensure `getClientInfo()` is called
2. Check that user information is available
3. Verify all required fields are provided
4. Use helper functions for consistency

## Future Enhancements

- Real-time alerts for security events
- Anomaly detection
- Advanced analytics and reporting
- Integration with SIEM systems
- Automated compliance reports
- Log integrity verification (checksums)
- Geographic visualization
- User activity timelines
- Automated log archival
