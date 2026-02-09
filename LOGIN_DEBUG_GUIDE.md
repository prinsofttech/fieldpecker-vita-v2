# Login Bug Debugging Guide

## Overview
Comprehensive client-side logging has been implemented to track EVERY step from button click to dashboard load, identifying exactly where the immediate logout bug occurs.

## How to Use This Debug Logging

1. **Open Browser Developer Tools**
   - Press F12 or Right-click → Inspect
   - Navigate to the Console tab

2. **Clear Console**
   - Click the 🚫 icon to clear any previous logs

3. **Refresh the Page**
   - You'll see `[APP]` logs showing initial state

4. **Attempt Login**
   - Enter your credentials and click Sign In
   - Watch the console output in real-time

5. **Look for Error Patterns**
   - Log prefixes: 🔵=UI, `[APP]`=App state, `[AUTH]`=Login, `[SESSION]`=Session, `[MONITOR]`=Monitoring
   - ✓ or ✅ = success
   - ❌ = failure
   - ⚠️ = warning

## Complete Login Flow (All Phases)

### Phase 0: Page Load & App State (`[APP]` logs)

**On page load/refresh:**
```
[APP] ══════════════════════════════════════
[APP] App component mounting / useEffect running
[APP] Getting initial session...
[APP] Initial session loaded: false
[APP] Setting up auth state change listener...
[APP] Auth listener subscribed
```

**On every render:**
```
[APP] Render - Auth state: { isAuthenticated: false, ... }
```

**CRITICAL**: Watch for unexpected `AUTH STATE CHANGED` events:
```
[APP] 🔔 AUTH STATE CHANGED
[APP] Event: SIGNED_OUT
```
If you see `SIGNED_OUT` immediately after login, that's the bug!

### Phase 1: Login Button Click (🔵 UI logs)

```
════════════════════════════════════════════════
🔵 LOGIN BUTTON CLICKED
Timestamp: 2024-...
Email: user@example.com
═══════════════════════════════════════════════
✓ Form default prevented
✓ Form state reset, loading=true
✓ Password validation: { isValid: true, ... }
🔄 Calling AuthService.signIn...
```

### Phase 2: Authentication (`[AUTH]` logs)

```
[AUTH] ======================================
[AUTH] LOGIN PROCESS STARTING
[AUTH] Email: user@example.com
[AUTH] ======================================
```

**Steps monitored:**
1. **Lockout Check** - Verifies account isn't locked
2. **Database Fetch** - Retrieves user from database
   - Shows user ID, org_id, role, status
3. **Status Check** - Verifies account is active
4. **Supabase Auth** - Authenticates with Supabase
   - Shows token length and expiration
5. **Login Recording** - Records successful attempt
6. **User Update** - Updates last_login_at
7. **Audit Log** - Logs to audit trail
8. **Password Check** - Checks if password change required
9. **Session Creation** - Creates session tracking record

### Phase 2: Session Creation (`[SESSION]` logs)

```
[SESSION] ========================================
[SESSION] SESSION CREATION STARTING
[SESSION] User ID: xxx-xxx-xxx
[SESSION] ========================================
```

**Steps monitored:**
1. **Auth Session Check** - Verifies Supabase auth session exists
2. **Org ID Fetch** - Gets user's organization ID
   - **CRITICAL**: This is where RLS policy issues appear
   - Look for error codes like `PGRST` (PostgREST/RLS errors)
3. **Existing Session Check** - Checks if session already exists
4. **Device Data** - Gathers fingerprint, IP, geolocation
5. **Database Insert** - Creates session record in database
   - **CRITICAL**: Watch for insert errors

### Phase 3: Session Monitoring (`[MONITOR]` logs)

```
[MONITOR] ========================================
[MONITOR] SESSION MONITORING STARTING
[MONITOR] Session ID: xxx-xxx-xxx
[MONITOR] ========================================
```

**Monitors:**
1. **Realtime Setup** - Subscribes to session changes
2. **Periodic Checks** - Every 5 seconds:
   - Checks auth session exists
   - Checks database session is active
   - **CRITICAL**: Watch for repeated failures here

## Common Error Patterns to Look For

### 1. RLS Policy Error (Most Likely Cause)
```
[SESSION] ❌ Database error fetching user org_id:
[SESSION] Error code: PGRST116
[SESSION] Error message: Row level security policy violation
```
**Meaning**: User cannot read their own record due to RLS policy
**Fix Applied**: Migration 052 allows users to read own record

### 2. Session Insert Error
```
[SESSION] ❌ Database error creating session:
[SESSION] Error code: 23503
[SESSION] Error message: Foreign key violation
```
**Meaning**: Session cannot be created due to constraint issue
**Action**: Check org_id exists and is valid

### 3. Monitoring Loop Logout
```
[MONITOR] ❌ Session was deactivated by administrator, logging out
```
**Meaning**: Session monitoring detected inactive session
**Action**: Check if session is being deactivated immediately after creation

### 4. Auth Session Missing
```
[MONITOR] ❌ No auth session found, logging out
```
**Meaning**: Supabase auth session disappeared
**Action**: Check auth token expiration settings

### 5. Database Query Errors in Monitoring
```
[MONITOR] ⚠️ Error checking session status:
[MONITOR] Error code: PGRST301
```
**Meaning**: Cannot read session from database
**Action**: Check user_sessions RLS policies

## What Happens After Successful Login

You should see:
```
[AUTH] ✓✓✓ LOGIN SUCCESSFUL ✓✓✓
[SESSION] ✓✓✓ SESSION CREATED SUCCESSFULLY ✓✓✓
[MONITOR] ✓ Realtime listener subscribed
[MONITOR] ✓ Starting periodic check (every 5 seconds)
```

Then every 5 seconds:
```
[MONITOR] ⏱️ Periodic check starting...
[MONITOR] ✓ Auth session exists
[MONITOR] ✓ Session is active in database
```

## If Immediate Logout Occurs

**Critical Things to Check in Order:**

1. **Did the login button work?**
   - Look for: `🔵 LOGIN BUTTON CLICKED`
   - If missing: JavaScript error before handler runs

2. **Did AuthService get called?**
   - Look for: `🔄 Calling AuthService.signIn...`
   - Then: `[AUTH] LOGIN PROCESS STARTING`
   - If missing: Issue in LoginForm component

3. **Did login succeed?**
   - Look for: `[AUTH] ✓✓✓ LOGIN SUCCESSFUL ✓✓✓`
   - If failed: Check first ❌ in `[AUTH]` logs

4. **Did session create?**
   - Look for: `[SESSION] ✓✓✓ SESSION CREATED SUCCESSFULLY ✓✓✓`
   - If failed: Check ❌ in `[SESSION]` logs (likely RLS issue)

5. **Was there a redirect?**
   - Look for: `🎯 Redirecting to /dashboard...`
   - If missing but login succeeded: Issue in LoginForm post-login logic

6. **Did auth state change unexpectedly?**
   - Look for: `[APP] 🔔 AUTH STATE CHANGED` with event `SIGNED_OUT`
   - This is the smoking gun if it happens right after `SIGNED_IN`

7. **Did monitoring terminate session?**
   - Look for: `[MONITOR] ❌ Current session was terminated`
   - If yes: Check why session was deactivated

## Most Likely Causes Based on Logs

### Scenario A: Login succeeds but immediate logout
```
[AUTH] ✓✓✓ LOGIN SUCCESSFUL ✓✓✓
[SESSION] ✓✓✓ SESSION CREATED SUCCESSFULLY ✓✓✓
🎯 Redirecting to /dashboard...
[APP] 🔔 AUTH STATE CHANGED
[APP] Event: SIGNED_OUT  ← THE PROBLEM!
```
**Cause**: Something is calling `signOut()` right after login
**Action**: Check for rogue logout triggers

### Scenario B: Session creation fails
```
[AUTH] Step 9: Creating session tracking...
[SESSION] ❌ Database error fetching user org_id:
[SESSION] Error code: PGRST116
```
**Cause**: RLS policy blocking user record read
**Action**: Migration 052 should fix this

### Scenario C: Monitoring terminates immediately
```
[MONITOR] ⏱️ Periodic check starting...
[MONITOR] ❌ Session was deactivated by administrator
```
**Cause**: Session marked inactive right after creation
**Action**: Check database triggers or concurrent session logic

## Fixes Already Applied

1. ✅ **Migration 052**: Users can always read their own record by ID
2. ✅ **Migration 053**: Existing users don't require password change
3. ✅ **Session Monitoring**: Won't logout on database query errors
4. ✅ **Activity Tracking**: Won't interfere with idle timeout
5. ✅ **Error Tolerance**: 6 consecutive failures before warning

## Next Steps

1. **Try logging in** with console open
2. **Copy ALL console output** starting from `[AUTH] LOGIN PROCESS STARTING`
3. **Look for the first ❌ error** in the logs
4. **Share the error details** including:
   - Error code
   - Error message
   - The step where it failed

## Testing Different Scenarios

### Test 1: Fresh Login
- Clear browser cache/cookies
- Login with credentials
- Watch for org_id fetch errors

### Test 2: Re-login
- Logout manually
- Login again immediately
- Should reuse existing session

### Test 3: Multiple Tabs
- Login in one tab
- Open another tab
- Should maintain single session

## Expected Timing

- Login: ~1-3 seconds
- Session creation: ~2-5 seconds (includes device fingerprinting)
- First monitoring check: 2 seconds after login
- Subsequent checks: Every 5 seconds

If logout happens within 10 seconds of login, check the logs carefully!
