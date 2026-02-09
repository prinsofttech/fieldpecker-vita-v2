# FieldPecker Session Management System - User Guide

## 🎯 Overview

The FieldPecker Session Management System provides comprehensive security and monitoring capabilities for tracking user sessions, detecting suspicious activity, and managing device access across your organization.

---

## 🚀 How to Access Session Management

### For Regular Users (All Roles)
1. Log into FieldPecker
2. Look at the **bottom left** of the sidebar
3. Click the **"My Sessions"** button (Shield icon) in the Settings section
4. You'll see your personal session dashboard

### For Admins (Client Admin & Super Admin)
1. Log into FieldPecker
2. In the **main navigation menu**, click **"Session Monitor"** (Activity icon)
3. You'll see organization-wide session monitoring dashboard

---

## 📊 User Features - "My Sessions" Dashboard

### Active Sessions Tab

**What you see:**
- All devices where you're currently logged in
- Device name (e.g., "Chrome on Windows", "Safari on macOS")
- IP address and location (city, country)
- When you logged in
- When you last had activity
- Trusted device badge (if device is recognized)

**What you can do:**
- **End Session** - Log out of a specific device
- **End All Other Sessions** - Log out of all devices except your current one

**Why this matters:**
- If you see unfamiliar devices, you can immediately terminate those sessions
- Useful if you forgot to log out from a public computer
- Security peace of mind

### Session History Tab

**What you see:**
- Last 50 login sessions (both active and ended)
- Full timeline of your account activity
- Session duration for each login
- Why each session ended (logout, timeout, etc.)

**Information displayed:**
- Device used for each session
- IP address and location
- Login date and time
- Logout date and time (if ended)
- Total duration
- Termination reason (user logout, idle timeout, admin terminated, etc.)

### Security Events Tab

**What you see:**
- Security-related activities on your account
- New device login alerts
- Failed login attempts
- Account locks/unlocks
- Any suspicious activity

**Event severity levels:**
- 🔵 **Low** - Informational (e.g., successful login)
- 🟡 **Medium** - Attention needed (e.g., new device)
- 🟠 **High** - Important (e.g., multiple failed logins)
- 🔴 **Critical** - Immediate action required (e.g., suspected breach)

---

## 👨‍💼 Admin Features - "Session Monitor" Dashboard

### Real-Time Statistics

**Four key metrics:**
1. **Active Sessions** - Total users logged in right now
2. **Logins Today** - New logins since midnight
3. **Idle Sessions** - Users inactive for 30+ minutes
4. **Suspicious** - Sessions flagged for review

### Active Session Management

**For each session you see:**
- User's name and email
- Device they're using
- IP address and location
- Login time
- Last activity time
- Idle duration
- Trusted device status

**Actions available:**
- **End Session** - Terminate a specific user's session
- **End All** - Terminate all sessions for a specific user

**Filter options:**
- Show only idle sessions (30+ minutes inactive)

### Auto-Refresh
- Dashboard refreshes every 30 seconds automatically
- Click "Refresh" button for immediate update

---

## 🔐 Security Features

### Device Fingerprinting

**What's tracked:**
- Browser name and version
- Operating system
- Screen resolution
- Timezone
- Language preferences
- Hardware capabilities

**Privacy note:** This data is used only for security and never shared externally.

### Trusted Devices

**How it works:**
- First login from a device generates a security alert
- Subsequent logins from same device are marked as "Trusted"
- Green badge indicates trusted devices
- Less intrusive security checks for trusted devices

### Geolocation Tracking

**What's tracked:**
- Country
- City
- Region
- IP address

**Why it matters:**
- Detects logins from unusual locations
- Helps identify account compromise
- Generates alerts for suspicious locations

### Concurrent Session Limits

**Default limits:**
- Maximum 3 simultaneous sessions per user
- Configurable by organization

**What happens:**
- If you exceed the limit, oldest session is automatically terminated
- You receive a security event notification
- Prevents unauthorized session hoarding

### Session Timeouts

**Two types of timeout:**

1. **Idle Timeout** (Default: 30 minutes)
   - Logs you out after inactivity
   - Prevents unauthorized access to unattended devices
   - Configurable per organization

2. **Absolute Timeout** (Default: 12 hours)
   - Maximum session duration
   - Forces re-login for security
   - Configurable per organization

### Failed Login Protection

**Automatic lockout:**
- Default: 5 failed attempts = 15-minute lockout
- Prevents brute force attacks
- Security event generated
- Admin notification sent

---

## 🎯 Common Use Cases

### Use Case 1: Lost or Stolen Device
**Problem:** Your laptop was stolen
**Solution:**
1. Login from another device
2. Go to "My Sessions"
3. Find the stolen device in active sessions
4. Click "End Session" to immediately log it out
5. Review security events for any suspicious activity
6. Change your password

### Use Case 2: Forgot to Logout
**Problem:** You logged in at a library and forgot to logout
**Solution:**
1. Click "My Sessions" from any device
2. Find the library computer in active sessions
3. Click "End Session"
Done!

### Use Case 3: Suspicious Activity Alert
**Problem:** You see a security event for login from unknown location
**Solution:**
1. Check "Security Events" tab
2. Note the IP address and location
3. If you don't recognize it:
   - Click "End All Other Sessions"
   - Change your password immediately
   - Contact your administrator
4. If you do recognize it (maybe you used a VPN):
   - Mark the device as trusted

### Use Case 4: Admin - User Reports Compromised Account
**Problem:** User thinks their account was hacked
**Solution (Admin):**
1. Go to "Session Monitor"
2. Find the user in active sessions
3. Click "End All" to terminate all their sessions
4. Review their security events
5. Lock their account if needed
6. Have user reset password

### Use Case 5: Organization-Wide Security Incident
**Problem:** Potential breach detected
**Solution (Admin):**
1. Open "Session Monitor"
2. Review all active sessions
3. Look for:
   - Unusual login times (3 AM logins)
   - Strange locations (foreign countries)
   - Multiple sessions from same user
4. Terminate suspicious sessions
5. Document in security events

---

## 📋 Session Termination Reasons

When reviewing session history, you'll see these termination reasons:

| Reason | What It Means |
|--------|---------------|
| `user_logout` | You clicked the logout button |
| `idle_timeout` | Session ended due to inactivity |
| `absolute_timeout` | Maximum session duration reached |
| `concurrent_limit` | Too many simultaneous sessions |
| `admin_terminated` | Admin ended your session |
| `security_event` | Terminated due to security concern |
| `password_changed` | Password was changed |
| `account_disabled` | Account was locked/disabled |

---

## ⚙️ Configuration (Admin Only)

### Session Policies

Admins can configure these settings per organization:

1. **Idle Timeout Minutes** (Default: 30)
   - How long before inactive users are logged out

2. **Absolute Timeout Hours** (Default: 12)
   - Maximum session duration

3. **Max Concurrent Sessions** (Default: 3)
   - How many devices can be logged in simultaneously

4. **Require MFA** (Default: false)
   - Force multi-factor authentication

5. **Allow Multiple Devices** (Default: true)
   - Enable/disable concurrent logins

6. **Enable Geolocation Tracking** (Default: true)
   - Track user location data

7. **Suspicious Login Notifications** (Default: true)
   - Send alerts for unusual activity

8. **Auto Lock After Failed Attempts** (Default: 5)
   - Number of failed logins before lockout

9. **Lockout Duration Minutes** (Default: 15)
   - How long account stays locked

---

## 🔍 Troubleshooting

### Problem: I keep getting logged out

**Possible causes:**
1. Idle timeout is too short
2. You're exceeding concurrent session limit
3. Admin is terminating your sessions

**Solutions:**
1. Contact admin to adjust idle timeout
2. Log out of unused devices
3. Keep browser tab active
4. Don't leave computer unattended

### Problem: I can't see my sessions

**Possible causes:**
1. Sessions table is empty (new account)
2. Browser blocking cookies
3. RLS policy issue

**Solutions:**
1. Log out and log back in to create first session
2. Check browser privacy settings
3. Contact system administrator

### Problem: Security event says "new device" but it's my laptop

**Cause:** Browser cache was cleared or new browser profile

**Solution:**
1. This is normal after clearing cookies
2. Device will be marked as trusted after this login
3. Future logins from this device won't trigger alerts

### Problem: Admin can't see any sessions

**Possible causes:**
1. No users are logged in
2. Database RLS policy issue
3. Wrong organization filter

**Solutions:**
1. Verify users are actually logged in
2. Check that admin role is properly configured
3. Try removing organization filter to see all sessions

---

## 📱 Mobile Access

All session management features work on mobile devices:
- Responsive design adapts to small screens
- Touch-friendly interface
- Same functionality as desktop
- Real-time updates

---

## 🛡️ Best Practices

### For Users:
1. ✅ Regularly review your active sessions
2. ✅ End sessions on public computers immediately
3. ✅ Watch for security events in your dashboard
4. ✅ Keep your devices updated
5. ✅ Use strong, unique passwords
6. ✅ Enable MFA if available
7. ❌ Don't share your login credentials
8. ❌ Don't stay logged in on shared computers

### For Admins:
1. ✅ Monitor session dashboard daily
2. ✅ Review security events regularly
3. ✅ Set appropriate timeout values for your organization
4. ✅ Enable suspicious login notifications
5. ✅ Educate users about session security
6. ✅ Document security incidents
7. ✅ Respond quickly to suspicious activity
8. ❌ Don't set timeout values too low (productivity impact)
9. ❌ Don't ignore security events

---

## 🎓 Training Users

### Quick Training Script (5 minutes)

**1. Show "My Sessions"**
   - "Click the shield icon at the bottom of the sidebar"
   - "This shows everywhere you're logged in"

**2. Demo Active Sessions**
   - "Each card is a device"
   - "You can see when you logged in and your last activity"
   - "If you see something unfamiliar, click 'End Session'"

**3. Explain Security Events**
   - "New device logins will appear here"
   - "If you see something suspicious, change your password"

**4. Set Expectations**
   - "You'll be logged out after 30 minutes of inactivity"
   - "You can be logged in on 3 devices at once"
   - "5 failed login attempts = 15 minute lockout"

---

## 📞 Support

### When to Contact Support:

- You see sessions you don't recognize
- Multiple security events for your account
- Account is locked and you don't know why
- Session features aren't working
- Need help understanding security events

### What to Provide:

- Your username/email
- Screenshot of the issue
- Time and date of the incident
- Device and browser you're using
- IP address (visible in session details)

---

## 🔄 Updates & Maintenance

The session management system automatically:
- Cleans up expired sessions every 15 minutes
- Updates activity timestamps every 60 seconds
- Checks for session validity every 30 seconds
- Archives old session data after 90 days

No user action required!

---

## ✅ Quick Reference

| Task | Steps |
|------|-------|
| View my sessions | Sidebar → My Sessions (bottom) |
| End specific session | My Sessions → Active Sessions → End Session |
| End all other sessions | My Sessions → Active Sessions → End All Other Sessions |
| Check security events | My Sessions → Security Events tab |
| View session history | My Sessions → Session History tab |
| Monitor organization (Admin) | Navigation → Session Monitor |
| Terminate user session (Admin) | Session Monitor → Find user → End Session |

---

**Last Updated:** November 26, 2025
**Version:** 1.0.0
**Status:** ✅ Fully Operational
