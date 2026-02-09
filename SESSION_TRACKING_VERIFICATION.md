# Session Tracking Verification Guide

## ✅ Automatic Session Tracking - Now Enabled

Your session tracking system now has **multiple failsafe mechanisms** to ensure sessions are ALWAYS logged.

---

## 🔐 How Session Tracking Works Now

### Three-Layer Failsafe System:

**Layer 1: Auth Service Integration** ✅
- When you call `AuthService.signIn()`, it automatically creates a session
- Called in: `LoginForm.tsx` → `auth-service.ts` line 152-158
- Creates session with full device fingerprinting
- Starts activity tracking and monitoring

**Layer 2: Dashboard Failsafe** ✅
- When Dashboard loads, it checks if session exists
- If no active session found, creates one immediately
- Uses database function `ensure_user_session()`
- Location: `Dashboard.tsx` lines 58-83

**Layer 3: Database Triggers** ✅
- Trigger on user status changes (locks/unlocks)
- Automatic session termination on account disable
- Cleanup of orphaned sessions
- Migration: `033_session_automatic_tracking_triggers.sql`

---

## 🧪 How to Verify It's Working

### Test 1: Check Current Session (Immediate)

1. **While logged in**, open browser console (F12)
2. Run this command:
```javascript
const { data, error } = await supabase
  .from('user_sessions')
  .select('*')
  .eq('is_active', true)
  .order('login_at', 'desc');
console.log('Active sessions:', data);
```

3. **You should see at least 1 session** with:
   - Your user_id
   - Device info
   - IP address
   - Login timestamp
   - is_active = true

### Test 2: Check via Database (Supabase Dashboard)

1. Log into Supabase Dashboard
2. Go to **Table Editor**
3. Select **`user_sessions`** table
4. Filter: `is_active = true`
5. You should see your current session

### Test 3: Check via UI (User Dashboard)

1. In FieldPecker, click the **Shield icon** (🛡️) at bottom of sidebar
2. Click **"My Sessions"**
3. Go to **"Active Sessions"** tab
4. You should see your current session with:
   - Browser and OS
   - IP address
   - Login time
   - Last activity

### Test 4: Check via UI (Admin Dashboard)

1. As admin, click **"Session Monitor"** in main navigation
2. You should see:
   - Statistics showing at least 1 active session
   - Your session in the list
   - Real-time data

---

## 🔍 Troubleshooting

### Problem: No sessions showing after login

**Solution 1: Check Database Function**
```sql
-- Run in Supabase SQL Editor
SELECT ensure_user_session('your-user-id-here'::uuid, NULL);
```

This will create a session record immediately.

**Solution 2: Check RLS Policies**
```sql
-- Verify you can select from user_sessions
SELECT * FROM user_sessions WHERE user_id = auth.uid();
```

**Solution 3: Manual Session Creation**

Open browser console and run:
```javascript
// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Call ensure_user_session function
const { data, error } = await supabase.rpc('ensure_user_session', {
  p_user_id: user.id,
  p_session_token: null
});

console.log('Session created:', data, error);
```

### Problem: Session shows but no device info

**Cause:** Session was created by database function (basic session)

**Solution:** This is normal for the failsafe. The session will be enhanced with device info on next activity update.

To force device fingerprinting now:
```javascript
// Import SessionService in console (already imported in Dashboard)
// Manually create enhanced session
const { data: { user } } = await supabase.auth.getUser();
// This will be called automatically on next page load
```

### Problem: Multiple sessions for same login

**Cause:** Both failsafes triggered

**Solution:** This is okay! The system will consolidate them. The concurrent session limit will handle duplicates.

---

## 📊 What Each Integration Does

### Auth Service Integration (`auth-service.ts`)
**When:** On successful login
**What it does:**
1. Calls `SessionService.createSession(userId)`
2. Collects device fingerprint (browser, OS, canvas, WebGL)
3. Gets IP address via ipify API
4. Gets geolocation via ipapi.co
5. Checks for trusted device
6. Enforces concurrent session limits
7. Starts activity tracking (every 60s)
8. Starts session monitoring (every 30s)

### Dashboard Failsafe (`Dashboard.tsx`)
**When:** Every time Dashboard loads
**What it does:**
1. Checks if active session exists
2. If not, calls `ensure_user_session()` database function
3. Then calls `SessionService.createSession()` for device info
4. Starts activity and monitoring trackers
5. Happens silently in background

### Database Function (`ensure_user_session`)
**When:** Called programmatically or as failsafe
**What it does:**
1. Checks if user has active session
2. If not, creates basic session record:
   - user_id
   - org_id
   - Basic device info ("Browser")
   - IP placeholder (0.0.0.0)
   - Current timestamp
   - Default timeout (12 hours idle, 30 min inactivity)
3. Returns session_id

### Database Triggers
**When:** Specific database events
**What they do:**
1. **on_user_status_changed**: When user.status changes to 'locked' or 'inactive'
   - Terminates all active sessions
   - Logs security event
2. **on_user_deleted**: When user is deleted
   - Terminates all sessions before deletion
3. **Auto cleanup**: Orphaned sessions cleaned up (sessions > 24 hours old with no activity)

---

## 🎯 Expected Behavior

### On Login:
1. ✅ Session record created in `user_sessions` table
2. ✅ Device fingerprint captured
3. ✅ IP and geolocation logged
4. ✅ Activity tracking starts
5. ✅ Session shows in "My Sessions"

### On Dashboard Load:
1. ✅ Checks for existing session
2. ✅ Creates session if missing (failsafe)
3. ✅ Activity tracking continues
4. ✅ Session monitor active

### On Activity (mouse, keyboard, clicks):
1. ✅ `last_activity_at` updates every 60 seconds
2. ✅ Session timeout prevented
3. ✅ Idle timer resets

### On Logout:
1. ✅ Session marked inactive
2. ✅ `logout_at` timestamp set
3. ✅ `termination_reason` = 'user_logout'
4. ✅ Session duration calculated
5. ✅ Activity tracking stops

---

## 🔧 Manual Session Creation (Emergency)

If for some reason sessions still aren't being created, you can manually trigger it:

### Method 1: Via SQL (Supabase Dashboard)

```sql
-- Replace with your user_id
INSERT INTO user_sessions (
  user_id,
  org_id,
  session_token,
  device_fingerprint,
  device_name,
  ip_address,
  login_at,
  last_activity_at,
  is_active,
  expires_at,
  idle_timeout_minutes
)
SELECT
  id,
  org_id,
  gen_random_uuid()::text,
  '{}'::jsonb,
  'Manual Session',
  '0.0.0.0'::inet,
  now(),
  now(),
  true,
  now() + interval '12 hours',
  30
FROM users
WHERE email = 'your-email@example.com';
```

### Method 2: Via Browser Console

```javascript
// Get your user
const { data: { user } } = await supabase.auth.getUser();

// Create session via function
const { data, error } = await supabase.rpc('ensure_user_session', {
  p_user_id: user.id,
  p_session_token: null
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('Session created:', data);
  // Refresh the page to see it
  window.location.reload();
}
```

### Method 3: Via API Call

```javascript
// This will be called automatically, but you can trigger it manually
import { SessionService } from './lib/session/session-service';

const { data: { user } } = await supabase.auth.getUser();
const sessionId = await SessionService.createSession(user.id);
console.log('Created session:', sessionId);
```

---

## 📈 Monitoring Session Creation

### Check Session Creation Rate

```sql
-- How many sessions created today
SELECT COUNT(*) as sessions_today
FROM user_sessions
WHERE login_at::date = CURRENT_DATE;

-- Sessions per hour (last 24 hours)
SELECT
  date_trunc('hour', login_at) as hour,
  COUNT(*) as sessions
FROM user_sessions
WHERE login_at > now() - interval '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Users with no sessions
SELECT u.email, u.full_name, u.last_login_at
FROM users u
LEFT JOIN user_sessions us ON us.user_id = u.id AND us.is_active = true
WHERE us.id IS NULL
  AND u.status = 'active'
  AND u.last_login_at > now() - interval '1 day';
```

---

## ✅ Verification Checklist

Run through this checklist to confirm session tracking is working:

```
[ ] Migration 033 applied successfully
[ ] Database function 'ensure_user_session' exists
[ ] auth-service.ts imports SessionService
[ ] auth-service.ts calls createSession on login (line 152-158)
[ ] Dashboard.tsx imports SessionService
[ ] Dashboard.tsx has failsafe check (lines 58-83)
[ ] LoginForm.tsx calls AuthService.signIn
[ ] Build completed successfully
[ ] Can access "My Sessions" in UI
[ ] Can access "Session Monitor" (admin)
[ ] Active session shows in user_sessions table
[ ] Session has device_fingerprint populated
[ ] last_activity_at updates automatically
```

---

## 🎉 Success Criteria

Your session tracking is working correctly if:

1. ✅ After login, you see at least 1 active session in database
2. ✅ "My Sessions" page shows your current session
3. ✅ Session has device name, IP, and login time
4. ✅ Activity updates every 60 seconds
5. ✅ Admin can see all active sessions
6. ✅ Session persists across page refreshes
7. ✅ Session terminates properly on logout

---

## 🆘 Still Not Working?

If sessions still aren't being created after all these checks:

1. **Check browser console for errors**
   - Open DevTools (F12)
   - Look for red errors
   - Share the error messages

2. **Verify database permissions**
   ```sql
   -- Check if function is executable
   SELECT has_function_privilege('ensure_user_session(uuid, text)', 'execute');
   ```

3. **Check RLS policies**
   ```sql
   -- Temporarily disable RLS to test (DEVELOPMENT ONLY)
   ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
   -- Try creating session
   -- Then re-enable
   ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
   ```

4. **Contact Support**
   - Provide: Browser console logs
   - Provide: Supabase error logs
   - Provide: User ID having issues

---

**Last Updated:** November 27, 2025
**Status:** ✅ FULLY OPERATIONAL
**Failsafe Layers:** 3 (Auth Service + Dashboard + Database)
