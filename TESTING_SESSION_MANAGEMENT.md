# Testing Session Management System

## 🧪 How to Test the Session Management Features

### Prerequisites
- FieldPecker application is running
- You have at least one user account (regular user)
- You have at least one admin account (client_admin)
- Access to the database (for verification)

---

## Test 1: Access "My Sessions" (User View)

**Steps:**
1. Log in as a regular user
2. Look at the **bottom of the sidebar**
3. In the "Settings" section, you should see 3 items now (was 2 before)
4. Click on **"My Sessions"** (Shield icon)

**Expected Result:**
- You should see the Session Management dashboard
- Three tabs: Active Sessions, Session History, Security Events
- At least one active session (your current session) should be visible
- Session should show:
  - Device name (e.g., "Chrome on Windows")
  - IP address
  - Login time
  - Last activity time

**Screenshot Location:**
Take screenshot of the "My Sessions" dashboard showing your active session.

---

## Test 2: View Session Details

**Steps:**
1. On the "My Sessions" page, look at your current active session
2. Check all the information displayed

**Expected Information:**
- ✅ Device icon (Monitor or Smartphone)
- ✅ Device name
- ✅ IP address
- ✅ Location (city, country) - may show if IP geolocation works
- ✅ "Logged in X minutes ago"
- ✅ "Last active X seconds ago"
- ✅ "End Session" button (red)

**Verification:**
- Device name should match your current browser and OS
- IP address should be accurate
- Times should be recent

---

## Test 3: Session History Tab

**Steps:**
1. Click on the **"Session History"** tab
2. Review the historical sessions

**Expected Result:**
- Should show at least your current session
- Each session should display:
  - Device name
  - IP address
  - Login time
  - Logout time (null if still active)
  - Session duration
  - Termination reason (if ended)

**Note:** If this is your first login, you may only see one session.

---

## Test 4: Security Events Tab

**Steps:**
1. Click on the **"Security Events"** tab
2. Check for any security events

**Expected Result:**
- May be empty if this is your first login from this device
- If you've logged in before, you might see:
  - "Login from new device detected" events
  - Event severity badges (Low, Medium, High, Critical)
  - Timestamps
  - IP addresses

---

## Test 5: Multiple Sessions (Concurrent Logins)

**Steps:**
1. Keep your current browser session open
2. Open a **different browser** (e.g., if you're in Chrome, open Firefox)
3. Log in with the same account
4. Go back to your first browser
5. Click "Refresh" button on My Sessions page

**Expected Result:**
- You should now see **2 active sessions**
- One for each browser
- Each should show different device names
- You should see a warning at the top: "Multiple Active Sessions - You have 2 active sessions"
- An "End All Other Sessions" button should appear

**Screenshot:** Take a screenshot showing 2 active sessions.

---

## Test 6: Terminate a Session

**Steps:**
1. With 2 active sessions, click **"End Session"** on one of them
2. Wait a few seconds
3. Click the "Refresh" button

**Expected Result:**
- Confirmation dialog appears: "Are you sure you want to end this session?"
- After confirming, session count drops to 1
- The terminated session disappears from Active Sessions
- If you check the other browser, it should be logged out

---

## Test 7: End All Other Sessions

**Steps:**
1. Create 2-3 active sessions (different browsers/devices)
2. On your main session, click **"End All Other Sessions"**
3. Confirm the action

**Expected Result:**
- Alert shows: "Terminated X session(s)"
- Only your current session remains in Active Sessions
- All other browsers/devices are logged out
- You remain logged in

---

## Test 8: Admin Session Monitor

**Steps:**
1. Log in as a **Client Admin** or **Super Admin**
2. In the main navigation menu (not settings), look for **"Session Monitor"**
3. Click on "Session Monitor"

**Expected Result:**
- You should see the Admin Session Monitoring dashboard
- Four statistics cards:
  - Active Sessions (total count)
  - Logins Today
  - Idle Sessions (30+ minutes)
  - Suspicious (count)
- List of all active sessions in your organization
- Each session shows:
  - User name and email
  - Device information
  - IP address and location
  - Login and last activity times
  - Idle duration
  - "End Session" and "End All" buttons

**Screenshot:** Admin Session Monitor dashboard.

---

## Test 9: Admin Terminate User Session

**Steps:**
1. As admin, on Session Monitor page
2. Find a user's active session
3. Click **"End Session"**
4. Confirm the action

**Expected Result:**
- Session is terminated immediately
- User is logged out on their device
- Session disappears from the monitor
- Security event is created for that user

**Verification:**
- Log in as that user
- Check their Security Events tab
- Should see event: "Session terminated" with reason "admin_terminated"

---

## Test 10: Filter Idle Sessions

**Steps:**
1. As admin, on Session Monitor
2. Check the checkbox: **"Show only idle sessions (30+ minutes)"**

**Expected Result:**
- List filters to show only sessions idle for 30+ minutes
- If no idle sessions exist, you'll see "No idle sessions found"
- Uncheck to see all sessions again

**Note:** To test this properly, you'd need to leave a session idle for 30 minutes.

---

## Test 11: Auto-Refresh

**Steps:**
1. Open Session Monitor (admin) or My Sessions (user)
2. Don't click anything
3. Wait 30 seconds
4. Watch for automatic data refresh

**Expected Result:**
- For Session Monitor: Auto-refreshes every 30 seconds
- For My Sessions: Manual refresh only (click Refresh button)
- Activity times should update
- New sessions should appear automatically

---

## Test 12: Database Verification

**Steps:**
1. Log in to Supabase dashboard
2. Go to Table Editor
3. Check these tables:

**user_sessions table:**
```sql
SELECT * FROM user_sessions
WHERE is_active = true
ORDER BY login_at DESC
LIMIT 10;
```

**Expected Result:**
- Should see active sessions with:
  - session_token
  - device_fingerprint (JSON)
  - device_name
  - ip_address
  - geolocation (JSON)
  - is_active = true
  - login_at, last_activity_at timestamps

**security_events table:**
```sql
SELECT * FROM security_events
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Result:**
- Should see security events like:
  - new_device_login
  - concurrent_session_limit
  - Event descriptions
  - Severity levels

---

## Test 13: Session Timeout (Idle)

**Steps:**
1. Log in to FieldPecker
2. Leave the browser tab open but don't interact
3. Wait 30 minutes (or whatever idle_timeout_minutes is set to)
4. Try to navigate to a different page in the app

**Expected Result:**
- After idle timeout expires, you should be:
  - Redirected to login page, OR
  - See session expired message
- Check database: is_active should be false, termination_reason should be 'idle_timeout'

**Note:** This test requires patience or reducing the idle timeout in session_config.

---

## Test 14: Concurrent Session Limit

**Steps:**
1. Check your organization's max_concurrent_sessions (default is 3)
2. Log in from Device 1
3. Log in from Device 2
4. Log in from Device 3
5. Log in from Device 4

**Expected Result:**
- When you log in from Device 4:
  - Device 1 session is automatically terminated
  - You see a security event: "concurrent_session_limit"
  - Only 3 sessions remain active
  - Oldest session was kicked out (FIFO)

---

## Test 15: Failed Login Protection

**Steps:**
1. Go to login page
2. Enter a valid email but **wrong password**
3. Submit 5 times (or whatever auto_lock_after_failed_attempts is set to)

**Expected Result:**
- After 5th failed attempt:
  - Account is locked
  - Error message: "Account locked. Too many failed attempts. Try again later."
  - User status in database changes to 'locked'
  - Security event created: "account_locked"
  - Can't login even with correct password for 15 minutes

**Verification:**
Check failed_login_attempts table:
```sql
SELECT * FROM failed_login_attempts
WHERE email_attempted = 'your-email@example.com'
ORDER BY attempted_at DESC;
```

---

## Test 16: Device Fingerprinting

**Steps:**
1. Log in from a new device/browser
2. Check the security_events table
3. Look at the device_fingerprint in user_sessions

**Expected Result:**
- Security event created: "new_device_login"
- device_fingerprint JSON should contain:
  - browser: { name, version, userAgent }
  - os: { name, version }
  - screen: { width, height, colorDepth, pixelRatio }
  - timezone
  - language
  - platform
  - hardwareConcurrency
  - canvas (fingerprint string)
  - webgl (renderer info)

---

## Test 17: Geolocation Tracking

**Steps:**
1. Log in normally
2. Check user_sessions table
3. Look at the geolocation column

**Expected Result:**
- geolocation JSON should contain:
  - country
  - city
  - region
  - latitude
  - longitude
  - timezone

**Note:** This uses ipapi.co API, so it depends on external service availability.

---

## Test 18: Navigation Integration

**Steps:**
1. Log in as different user types
2. Check navigation menus

**For Regular Users:**
- ✅ "My Sessions" should appear in Settings section (bottom of sidebar)
- ✅ Shield icon should be visible
- ✅ Should NOT see "Session Monitor" in main navigation

**For Client Admins:**
- ✅ "Session Monitor" in main navigation (Activity icon)
- ✅ "My Sessions" in Settings section
- ✅ Both options available

**For Super Admins:**
- ✅ "Session Monitor" in main navigation
- ✅ Can see ALL organizations' sessions
- ✅ "My Sessions" in Settings section

---

## Test 19: Responsive Design

**Steps:**
1. Open "My Sessions" on desktop
2. Resize browser to mobile width
3. Open "Session Monitor" (admin)
4. Resize to tablet width

**Expected Result:**
- Layouts adapt to smaller screens
- Statistics cards stack vertically on mobile
- Session cards remain readable
- Buttons remain accessible
- No horizontal scrolling
- All features still functional

---

## Test 20: Build Verification

**Steps:**
```bash
npm run build
```

**Expected Result:**
- ✅ Build completes successfully
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Bundle size reasonable (< 500KB)
- ✅ All imports resolve correctly

---

## 🐛 Known Issues to Check

### Issue 1: Session not created on login
**Check:**
- Is SessionService.createSession() being called after successful auth?
- Are session tokens being stored correctly?
- Check browser console for errors

### Issue 2: Geolocation data missing
**Check:**
- Is ipapi.co accessible (might be blocked)
- Check browser console for fetch errors
- IP might be localhost (127.0.0.1) in development

### Issue 3: Device fingerprint empty
**Check:**
- Canvas/WebGL might be blocked by privacy extensions
- Some browsers block fingerprinting APIs
- Check console for errors in device-fingerprint.ts

### Issue 4: Activity not updating
**Check:**
- Is SessionService.startActivityTracking() called after login?
- Check browser console for RPC call errors
- Verify session_token matches in database

### Issue 5: Admin can't see sessions
**Check:**
- RLS policies are correct
- User's role is actually 'client_admin' or 'super_admin'
- Check JWT token contains correct role claim

---

## 📊 Success Criteria

All tests should pass with:
- ✅ Session creation works
- ✅ Multiple concurrent sessions supported
- ✅ Session termination works (user and admin)
- ✅ Security events are logged
- ✅ Device fingerprinting captures data
- ✅ Geolocation is tracked
- ✅ Failed login protection works
- ✅ Concurrent session limits enforced
- ✅ UI is responsive and functional
- ✅ Navigation items appear correctly based on role
- ✅ Build completes without errors

---

## 📝 Testing Checklist

Copy this checklist and mark items as you test:

```
## User Features
- [ ] Can access "My Sessions" from sidebar
- [ ] Active Sessions tab shows current session
- [ ] Session History tab shows past sessions
- [ ] Security Events tab visible
- [ ] Can end a specific session
- [ ] Can end all other sessions
- [ ] Refresh button works

## Admin Features
- [ ] Can access "Session Monitor" from nav
- [ ] Statistics cards show accurate counts
- [ ] All active sessions displayed
- [ ] Can terminate user sessions
- [ ] Can terminate all sessions for a user
- [ ] Filter by idle sessions works
- [ ] Auto-refresh works (30 seconds)

## Security Features
- [ ] Device fingerprinting captures data
- [ ] Geolocation is tracked
- [ ] Failed login protection works (5 attempts)
- [ ] Concurrent session limits enforced (3 max)
- [ ] Security events are logged
- [ ] New device login creates alert

## Database
- [ ] user_sessions table populates
- [ ] security_events table populates
- [ ] failed_login_attempts tracked
- [ ] RLS policies work correctly
- [ ] Functions execute successfully

## Integration
- [ ] Navigation items show for correct roles
- [ ] Dashboard routing works
- [ ] Components render without errors
- [ ] Build completes successfully
- [ ] No console errors
```

---

**Testing Completed:** ___/___/_____
**Tested By:** _________________
**Environment:** [ ] Development [ ] Staging [ ] Production
**Browser(s):** _________________
**Result:** [ ] PASS [ ] FAIL [ ] PARTIAL

**Notes:**
_________________________________
_________________________________
_________________________________
