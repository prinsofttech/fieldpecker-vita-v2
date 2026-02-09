# FieldPecker - Quick Start (3 Steps)

## Your Foundation is Complete! ✅

All code, services, and UI components are ready. You just need to apply the database schema.

---

## Step 1: Apply Database Schema (2 minutes)

### Option A: Via Supabase Dashboard (Easiest)

1. Open your browser and go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file `database-setup.sql` from this project
6. Copy ALL the contents (Ctrl+A, Ctrl+C)
7. Paste into the SQL Editor
8. Click **Run** (or press Ctrl+Enter)

You should see: ✅ Success messages

### What This Creates:
- 7 database tables with security
- 5 hierarchical roles
- 4 configurable modules
- Helper functions
- Row-Level Security policies

---

## Step 2: Create Your Organization (1 minute)

### 2.1 Create Organization

In the same SQL Editor, run:

```sql
INSERT INTO organizations (name, slug, status)
VALUES ('Your Company Name', 'your-company', 'active')
RETURNING id;
```

**IMPORTANT**: Copy the UUID that's returned - this is your `org_id`

### 2.2 Create Admin User

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click **Add User** (green button)
3. Enter:
   - **Email**: your-email@company.com
   - **Password**: Create a strong password (12+ characters)
4. Click **Create User**
5. **IMPORTANT**: Copy the UUID shown - this is your `user_id`

### 2.3 Link User to Organization

Back in SQL Editor, run (replace the UUIDs with yours):

```sql
INSERT INTO users (id, org_id, role_id, email, full_name)
VALUES (
  'YOUR-USER-UUID-HERE',
  'YOUR-ORG-UUID-HERE',
  (SELECT id FROM roles WHERE name = 'client_admin'),
  'your-email@company.com',
  'Your Full Name'
);
```

### 2.4 Enable Modules

Run this to enable all modules:

```sql
INSERT INTO org_modules (org_id, module_id, enabled_by)
SELECT 
  'YOUR-ORG-UUID-HERE',
  m.id,
  'YOUR-USER-UUID-HERE'
FROM modules m;
```

---

## Step 3: Run the Application (30 seconds)

```bash
npm run dev
```

Open your browser to: **http://localhost:5173**

Login with:
- **Email**: your-email@company.com
- **Password**: (the password you created)

You should see:
- ✅ Professional login page
- ✅ After login: Dashboard with your name
- ✅ Organization info
- ✅ 4 enabled modules displayed
- ✅ User statistics

---

## ✅ Verification Checklist

After completing the steps above, verify:

- [ ] Login page loads at localhost:5173
- [ ] Can login with your credentials
- [ ] Dashboard shows your full name
- [ ] Organization name displays correctly
- [ ] 4 modules are shown (Supervision, Issues, Leads, KPIs)
- [ ] Statistics show: 1 total user, 1 active user, 4 enabled modules
- [ ] Can logout successfully

---

## 🎯 What's Already Built

### Backend (Complete)
✅ Database schema with multi-tenancy
✅ Row-Level Security on all tables
✅ Authentication with security policies
✅ Module activation system
✅ Audit logging infrastructure
✅ Helper functions for access control

### Frontend (Complete)
✅ Professional login UI
✅ Dashboard with statistics
✅ Module management
✅ TypeScript services for all operations
✅ Responsive design

### Services (Complete)
✅ AuthService - Sign in/up, password management
✅ ModuleService - Module access control
✅ UserService - User management, hierarchy
✅ AuditService - Activity tracking

---

## 📚 Documentation Files

| File | What It Contains |
|------|------------------|
| **database-setup.sql** | Complete database schema (run this first!) |
| **README.md** | Overview and quick reference |
| **SETUP_GUIDE.md** | Detailed setup instructions |
| **FIELDPECKER_SCHEMA.md** | Complete database documentation |
| **PROJECT_STATUS.md** | What's implemented and next steps |

---

## 🚨 Troubleshooting

### "Can't login" or "Invalid credentials"
- Verify user was created in Supabase Auth
- Check user is linked in users table
- Try resetting password in Supabase Dashboard

### "No modules showing"
- Run the module enablement SQL from Step 2.4
- Verify org_modules table has records
- Check browser console for errors

### Database errors
- Ensure entire database-setup.sql was executed
- Check for error messages in SQL Editor
- Verify all tables were created: `SELECT * FROM information_schema.tables WHERE table_schema = 'public';`

---

## 🎉 You're Done!

Once you complete these 3 steps, you have:
- ✅ Production-ready foundation
- ✅ Secure multi-tenant database
- ✅ Working authentication
- ✅ Module system active
- ✅ Audit logging running

Now you can start building module-specific features!

---

## Next: Choose a Module to Implement

### Option 1: Supervision Module
Field visits, GPS capture, photo uploads, compliance checks

### Option 2: Issue Tracker
Issue logging, assignments, workflows, escalations

### Option 3: Leads & Sales
Lead capture, follow-ups, conversion tracking, CRM

### Option 4: Performance & KPIs
Target monitoring, dashboards, analytics, reports

---

## Need Help?

1. Check **FIELDPECKER_SCHEMA.md** for database details
2. See **SETUP_GUIDE.md** for in-depth instructions
3. Review **PROJECT_STATUS.md** for what's implemented

---

**Time to Complete**: ~5 minutes total
**Status**: Ready to launch! 🚀
