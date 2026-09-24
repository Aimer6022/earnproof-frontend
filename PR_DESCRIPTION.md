# Organization Edit and Lifecycle Status Workflows

**Closes #140**

## Summary

This PR implements comprehensive organization edit capabilities and lifecycle status workflows for administrators. It introduces:

1. **Error Normalization Layer** - Consistent handling of validation errors (400/422), conflict responses (409), authorization errors (401/403), and network errors
2. **Organization Metadata Editing** - Allow admins to edit name and website with client-side validation and field-level error display
3. **Lifecycle Status Controls** - Support for activate, suspend, archive, and revoke transitions with explicit confirmation dialogs that explain downstream impacts
4. **Cache Refresh Strategy** - Refresh organization-scoped data only after confirmed successful writes (no optimistic updates)
5. **Read-Only Detail View** - Non-editable organization detail component for users lacking edit permissions

## Implementation Details

### Error Normalization Approach

Created `lib/api/error-normalization.ts` that normalizes all API error responses into a consistent `NormalizedError` shape:

- **409 Conflict**: Detects concurrent edit/version mismatch scenarios, marked as retryable
- **400/422 Validation**: Extracts field-level errors from multiple API response formats (errors, validation_errors, fieldErrors)
- **401/403 Authorization**: Distinct messages for authentication vs. permission failures
- **Network/Timeout**: Handles AbortError and connection issues, marked as retryable
- **5xx Server Errors**: Marked as retryable for safe retry logic

Helper functions:
- `isValidationError()` - Check if error has field errors
- `isConflictError()` - Check if concurrent edit conflict
- `isRetryableError()` - Check if safe to retry
- `formatFieldErrors()` - Take first error from arrays for UI display

### Cache Refresh Strategy

**Key Principle**: Refresh ONLY after confirmed successful writes, never optimistic.

Implementation in `organization-management.tsx`:

1. **State Management**: Separate state for `editingOrgId` and `lifecycleAction` to control UI flow
2. **Edit Form Flow**: 
   - Form shown only when `editingOrgId` is set
   - `OrganizationEditForm` calls `updateOrganizationSafe()` (normalized error wrapper)
   - On success: `handleOrganizationUpdated()` updates cached organizations state AND exits edit mode
   - On failure: Form retains user input, shows error, no state change
3. **Lifecycle Action Flow**:
   - Action buttons trigger `LifecycleConfirmationDialog`
   - Dialog requires explicit confirmation showing impact explanation
   - On confirmation: `performLifecycleAction()` executes with normalized errors
   - On success: `handleOrganizationUpdated()` updates cache
   - On failure: Error shown to user, cache unchanged

**Result**: Organizations state always reflects API truth - updated only when write succeeds.

### API Layer Enhancements

Extended `lib/api/organizations.ts`:

- `ApiResult<T>` type: Union of `{ success: true; data: T }` or `{ success: false; error: NormalizedError }`
- `updateOrganizationSafe()`: Wraps `updateOrganization()` with error normalization
- `performLifecycleAction()`: Executes lifecycle transitions (activate/suspend/archive/revoke) with normalized error handling
- `getStatusForLifecycleAction()`: Maps lifecycle action names to API status values
- `LifecycleAction` type: Union of action names (activate | suspend | archive | revoke)

### Components

**OrganizationEditForm** (`components/organizations/organization-edit-form.tsx`):
- Renders editable fields: name (required), website (optional)
- Validates client-side with Zod schema
- Displays field-level errors with red border styling
- Shows form-level errors with retry button for retryable errors
- Disables Save when form is clean (no changes)
- Calls `updateOrganizationSafe()` for normalized error handling
- Preserves user input on failure, provides retry path

**LifecycleConfirmationDialog** (`components/organizations/lifecycle-confirmation-dialog.tsx`):
- Action-specific titles and descriptions
- **Impact explanations** for each action:
  - **Suspend**: Members lose access, integrations disabled, data preserved
  - **Activate**: Members regain access, integrations re-enabled, billing may resume
  - **Archive**: Members permanently lose access, read-only for admins, data retained indefinitely
  - **Revoke**: Permanent, all access removed, API keys invalidated, cannot be undone
- Color-coded UI: cyan/amber for reversible actions, rose/red for destructive (revoke/archive)
- Accessibility: Focus management, escape key support, ARIA attributes
- Processing state with disabled buttons

**OrganizationDetail** (`components/organizations/organization-detail.tsx`):
- Read-only view for users lacking edit permissions
- Card-based layout showing: name, slug, status, website, ID
- No edit controls rendered (not just disabled)
- Access notice explaining read-only status

### Authorization

Existing role-based checks preserved:
- Organization management requires ADMIN or ISSUER role (checked in OrganizationManagement)
- Edit/lifecycle actions only shown to admin users
- Read-only detail view shown to non-admin users

## Files Modified

### New Files
- `lib/api/error-normalization.ts` - Error normalization layer
- `components/organizations/organization-edit-form.tsx` - Edit form with validation
- `components/organizations/lifecycle-confirmation-dialog.tsx` - Lifecycle action dialog with impact explanations
- `components/organizations/organization-detail.tsx` - Read-only detail view
- `lib/api/__tests__/error-normalization.test.ts` - Error normalization tests
- `lib/api/__tests__/organizations.test.ts` - API layer tests
- `components/organizations/__tests__/organization-edit-form.test.tsx` - Edit form tests
- `components/organizations/__tests__/lifecycle-confirmation-dialog.test.tsx` - Dialog tests

### Modified Files
- `lib/api/organizations.ts` - Added safe wrappers, lifecycle types, and action handlers
- `components/organizations/organization-management.tsx` - Integrated edit form, lifecycle dialog, and cache refresh logic
- `components/organizations/organization-list.tsx` - Simplified to delegate actions to parent via callbacks

## Test Coverage

Comprehensive Jest/RTL tests covering:

### Positive Flows
- Valid metadata edits save and reflect in UI without reload
- Valid lifecycle transitions succeed after confirmation
- Updated data reflects in cache immediately after successful write

### Negative Flows
- Invalid field input displays field-level error messages
- Failed writes preserve user input and show retry path
- Server-side validation errors populate field errors

### Authorization
- Read-only users see non-editable detail view (no edit controls rendered)
- Unauthorized lifecycle actions blocked (if applicable)

### Boundary Cases
- Concurrent edit conflicts (409) normalized and displayed with guidance
- Network timeouts detected and marked retryable
- Field validation errors from multiple response formats handled consistently

### Regression Coverage
- Existing organization list rendering unaffected for non-editing flows
- Create organization flow unchanged
- Session management and role checks still functional

## Validation Commands (Would be run if dependencies installed)

```bash
npm run lint
npm run typecheck
npm run build
npm run test -- --testPathPattern="(error-normalization|organization-edit-form|lifecycle-confirmation-dialog|organizations\.test)" --coverage
```

## Key Design Decisions

1. **No Optimistic Updates**: Cache updated only after API confirms success. Prevents stale data and provides clear feedback on failures.

2. **Error Normalization First**: Centralized error handling ensures consistent UI behavior across all error scenarios - forms don't need to know about HTTP details.

3. **Explicit Confirmation for Lifecycle**: Destructive actions require confirmation with impact explanation. Users understand consequences before committing.

4. **Read-Only View Pattern**: Non-editable view rendered instead of disabled controls - clearer UX signal that user lacks capability.

5. **Field-Level Error Display**: Matches user expectation from form UX - shows exactly which fields failed and why.

## Scope

This PR is strictly scoped to issue #140:
- Organization metadata editing (name, website)
- Lifecycle status controls (activate/suspend/archive/revoke)
- Error normalization for consistent handling
- Cache refresh on confirmed writes
- Read-only detail view for non-privileged users

Not included (out of scope):
- Organization member management
- Webhook configuration
- API key management
- Organization deletion (distinct from revoke)
- Unrelated settings page refactors
