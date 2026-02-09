# 📍 Where to Find Session Management Features

## Quick Visual Guide

---

## For Regular Users (All Roles)

### Accessing "My Sessions"

```
┌─────────────────────────────────────────────┐
│  FieldPecker Dashboard                      │
│                                             │
│  ┌──────────┐                               │
│  │ SIDEBAR  │                               │
│  │          │                               │
│  │ 📊 Dashboard                             │
│  │ 👥 My Team                               │
│  │ 👤 Customers                             │
│  │                                          │
│  │ ... (your modules here)                  │
│  │                                          │
│  │                                          │
│  │ ─────────────────                        │
│  │ Settings: 3      👈 LOOK HERE            │
│  │ ─────────────────                        │
│  │                                          │
│  │ 🛡️  My Sessions   👈 CLICK THIS          │
│  │ 🔔 Notifications                         │
│  │ ⚙️  Settings                             │
│  │                                          │
│  │ 🚪 Logout                                │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
```

**Steps:**
1. Look at the **bottom left** of your screen
2. Find the "Settings" section (shows "Settings: 3")
3. Click the **🛡️ My Sessions** button (first item)
4. The shield icon means security/sessions

---

## For Admins (Client Admin & Super Admin)

### Accessing "Session Monitor"

```
┌─────────────────────────────────────────────┐
│  FieldPecker Dashboard                      │
│                                             │
│  ┌──────────┐                               │
│  │ SIDEBAR  │                               │
│  │          │                               │
│  │ 📊 Dashboard                             │
│  │ 📦 Modules                               │
│  │ 📍 Regions                               │
│  │ 🏢 Branches                              │
│  │ 💼 Departments                           │
│  │ 👤 Customers                             │
│  │ 👥 User Management                       │
│  │ 📊 Session Monitor  👈 CLICK THIS        │
│  │    (Activity icon)                       │
│  │                                          │
│  │                                          │
│  │ ─────────────────                        │
│  │ Settings: 3                              │
│  │ ─────────────────                        │
│  │                                          │
│  │ 🛡️  My Sessions   👈 (also available)    │
│  │ 🔔 Notifications                         │
│  │ ⚙️  Settings                             │
│  │                                          │
│  │ 🚪 Logout                                │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
```

**Steps:**
1. Look in the **main navigation** (middle of sidebar)
2. Scroll down past "User Management"
3. Click **📊 Session Monitor**
4. The activity/graph icon means monitoring

**Note:** Admins have BOTH options:
- "Session Monitor" - See all users
- "My Sessions" - See your own sessions

---

## What Each Dashboard Looks Like

### User Dashboard: "My Sessions"

```
┌─────────────────────────────────────────────────────────┐
│  Session Management                         🔄 Refresh  │
│  Monitor and manage your active sessions                │
│                                                          │
│  ┌──────────────┬───────────────┬─────────────────┐    │
│  │ Active (2)   │ History       │ Security Events │    │
│  └──────────────┴───────────────┴─────────────────┘    │
│                                                          │
│  ⚠️  Multiple Active Sessions                           │
│      You have 2 active sessions                         │
│                                   [End All Other]       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ 💻  Chrome on Windows                          │    │
│  │     🛡️ Trusted                                  │    │
│  │     📍 192.168.1.100 • New York, USA          │    │
│  │     🕐 Logged in 5 minutes ago                 │    │
│  │     ⚡ Last active just now                     │    │
│  │                               [End Session]    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ 📱  Safari on iPhone                           │    │
│  │     📍 10.0.0.50 • Los Angeles, USA           │    │
│  │     🕐 Logged in 2 hours ago                   │    │
│  │     ⚡ Last active 30 minutes ago              │    │
│  │                               [End Session]    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Three Tabs:**
1. **Active Sessions** - Currently logged in devices
2. **Session History** - Past 50 sessions
3. **Security Events** - Alerts and notifications

---

### Admin Dashboard: "Session Monitor"

```
┌───────────────────────────────────────────────────────────┐
│  Session Monitoring                           🔄 Refresh  │
│  Real-time monitoring of all active user sessions         │
│                                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ ⚡ Active   │ │ 👥 Logins   │ │ 🕐 Idle     │        │
│  │ Sessions    │ │ Today       │ │ Sessions    │        │
│  │     15      │ │     23      │ │      3      │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                            │
│  ┌─────────────┐                                         │
│  │ ⚠️  Suspicious                                         │
│  │      2      │                                         │
│  └─────────────┘                                         │
│                                                            │
│  ☐ Show only idle sessions (30+ minutes)                 │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 💻  John Smith (john@company.com)                │   │
│  │     🛡️ Trusted                                    │   │
│  │     💻 Chrome on Windows                          │   │
│  │     📍 192.168.1.100 • New York                  │   │
│  │     🕐 Logged in 2 hours ago                      │   │
│  │     ⚡ Last active 5 minutes ago                  │   │
│  │                    [End Session] [End All]       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 💻  Jane Doe (jane@company.com)                  │   │
│  │     🕐 Idle 45m                                   │   │
│  │     💻 Firefox on macOS                           │   │
│  │     📍 10.0.0.25 • San Francisco                 │   │
│  │     🕐 Logged in 3 hours ago                      │   │
│  │     ⚡ Last active 45 minutes ago                 │   │
│  │                    [End Session] [End All]       │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

**Features:**
- Real-time statistics
- Filter by idle sessions
- Terminate individual sessions
- Terminate all sessions for a user
- Auto-refreshes every 30 seconds

---

## Icon Legend

### Navigation Icons

| Icon | Meaning | Where |
|------|---------|-------|
| 🛡️ | Security/Sessions | "My Sessions" (Settings) |
| 📊 | Monitoring/Activity | "Session Monitor" (Main nav) |
| 💻 | Desktop Device | Session cards |
| 📱 | Mobile Device | Session cards |
| 🕐 | Time/Clock | Timestamps |
| 📍 | Location | IP/Geolocation |
| ⚡ | Activity | Last active time |
| ⚠️ | Warning | Multiple sessions alert |
| 👥 | Users | Login statistics |
| 🔄 | Refresh | Manual refresh button |

### Status Badges

| Badge | Meaning |
|-------|---------|
| 🛡️ Trusted | Recognized device |
| 🕐 Idle 45m | Inactive for 45 minutes |
| ⚠️ Action Required | Security event needs attention |

### Severity Colors

| Color | Severity | Example |
|-------|----------|---------|
| 🔵 Blue | Low | Informational events |
| 🟡 Yellow | Medium | New device login |
| 🟠 Orange | High | Multiple failed logins |
| 🔴 Red | Critical | Account compromise suspected |

---

## Quick Actions Guide

### User Actions

**To view your sessions:**
1. Click 🛡️ My Sessions
2. See Active Sessions tab

**To end a session:**
1. Find the session
2. Click [End Session] button
3. Confirm

**To end all other sessions:**
1. Click [End All Other Sessions]
2. Confirm
3. Only your current device stays logged in

**To check security events:**
1. Click 🛡️ My Sessions
2. Click "Security Events" tab
3. Review alerts

---

### Admin Actions

**To monitor sessions:**
1. Click 📊 Session Monitor
2. View all active sessions

**To filter idle sessions:**
1. On Session Monitor
2. Check ☐ "Show only idle sessions"

**To terminate a user's session:**
1. Find the user
2. Click [End Session]
3. Confirm

**To terminate all user sessions:**
1. Find the user
2. Click [End All]
3. Confirm
4. All their devices log out

**To refresh manually:**
1. Click 🔄 Refresh button
2. Data updates immediately

---

## Database Locations (For Developers)

### Frontend Files
```
src/
├── components/
│   └── session/
│       ├── SessionHistoryDashboard.tsx  👈 User dashboard
│       └── AdminSessionMonitor.tsx      👈 Admin dashboard
├── lib/
│   ├── session/
│   │   ├── session-service.ts           👈 Business logic
│   │   └── device-fingerprint.ts        👈 Device tracking
│   └── utils/
│       └── date-utils.ts                👈 Time formatting
```

### Backend Files
```
supabase/migrations/
├── 031_extend_session_management_system.sql  👈 Tables
└── 032_session_management_functions.sql      👈 Functions
```

### Database Tables
```
- user_sessions          👈 Active/historical sessions
- security_events        👈 Alerts and logs
- failed_login_attempts  👈 Failed auth tracking
- trusted_devices        👈 Known devices
- session_config         👈 Organization policies
```

---

## First-Time Setup (No Action Needed)

The session management system works automatically:

✅ **No configuration needed** - Default settings work out of the box
✅ **No user training required** - Intuitive interface
✅ **No manual session creation** - Happens on login
✅ **No database setup** - Migrations already applied

**Just log in and it works!**

---

## Troubleshooting "Can't Find It"

### Problem: Don't see "My Sessions"

**Check:**
1. Look at the **very bottom** of the sidebar
2. Should be in "Settings" section
3. Above "Notifications" and "Settings"
4. Has a shield icon (🛡️)

**Still not there?**
- Refresh the page (Ctrl+R or Cmd+R)
- Check you're logged in
- Try logging out and back in

### Problem: Don't see "Session Monitor" (Admin)

**Check:**
1. Are you a Client Admin or Super Admin?
2. Look in **main navigation** (not Settings)
3. Should be below "User Management"
4. Has an activity icon (📊)

**Still not there?**
- Verify your role in the database
- Check user.role?.name is 'client_admin' or 'super_admin'
- Contact system administrator

### Problem: Page is blank

**Check:**
1. Open browser console (F12)
2. Look for errors in Console tab
3. Check Network tab for failed requests
4. Verify database migrations are applied

**Common causes:**
- Session data not loading
- RLS policy blocking access
- Network connectivity issue

---

## Mobile Access

Works on all devices:

📱 **Phone** - Touch-friendly, stacks vertically
💻 **Tablet** - Optimized layout
🖥️ **Desktop** - Full featured

**Same location on all devices!**
- Bottom of sidebar for "My Sessions"
- Main navigation for "Session Monitor"

---

## Questions?

**For Users:**
- Read: `SESSION_MANAGEMENT_GUIDE.md`
- Contact: Your system administrator

**For Admins:**
- Read: `SESSION_MANAGEMENT_GUIDE.md`
- Read: `TESTING_SESSION_MANAGEMENT.md`
- Check: Database tables and functions

**For Developers:**
- Read: `SESSION_IMPLEMENTATION_VERIFIED.md`
- Check: Source code in `src/components/session/`
- Review: Database migrations in `supabase/migrations/`

---

**Remember:**
- 🛡️ My Sessions = User view (bottom of sidebar)
- 📊 Session Monitor = Admin view (main navigation)
- Both are now live and functional!

**Happy session monitoring! 🎉**
