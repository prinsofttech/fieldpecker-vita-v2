# FieldPecker - Multi-Tenant Field Agent Management Platform

A comprehensive SaaS platform for organizations to manage field agents with supervision, issue tracking, leads management, and performance monitoring.

## Quick Start

### 1. Database Setup

**Apply the database schema to Supabase:**

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy all content from `database-setup.sql`
4. Paste and click **Run**

This will create:
- ✅ 7 tables with full RLS security
- ✅ 5 hierarchical roles
- ✅ 4 configurable modules
- ✅ Helper functions for access control
- ✅ Audit logging system

### 2. Create First Organization & User

```sql
-- 1. Create organization
INSERT INTO organizations (name, slug, status, subscription_tier)
VALUES ('Your Company', 'your-company', 'active', 'professional')
RETURNING id;
-- Copy the returned ID

-- 2. In Supabase Dashboard > Authentication > Users, create a user
-- with email: admin@yourcompany.com
-- Copy the user UUID

-- 3. Link the user to your organization
INSERT INTO users (
  id,
  org_id,
  role_id,
  email,
  full_name
) VALUES (
  '<user-uuid-from-step-2>',
  '<org-id-from-step-1>',
  (SELECT id FROM roles WHERE name = 'client_admin'),
  'admin@yourcompany.com',
  'Admin User'
);

-- 4. Enable all modules
INSERT INTO org_modules (org_id, module_id, enabled_by)
SELECT
  '<org-id-from-step-1>',
  m.id,
  '<user-uuid-from-step-2>'
FROM modules m;
```

### 3. Run the Application

```bash
npm install
npm run dev
```

Open http://localhost:5173 and login with your credentials!

## Features

### Core Foundation
- 🔐 **Secure Authentication** - Password policies, account lockout, session timeout
- 🏢 **Multi-Tenancy** - Complete org isolation via Row-Level Security
- 👥 **Role Hierarchy** - 5-level role system (Admin → Field Agent)
- 📦 **Modular System** - Enable/disable features per organization
- 📊 **Audit Logging** - Comprehensive activity tracking

### Available Modules
- 🟦 **Supervision** - Field visits, compliance checks, GPS/photo capture
- 🟥 **Issue Tracker** - Issue logging, assignments, escalations
- 🟩 **Leads & Sales** - Lead capture, follow-ups, conversions
- 🟨 **Performance & KPIs** - Target monitoring, dashboards, reports

## Project Structure

```
fieldpecker/
├── src/
│   ├── lib/
│   │   ├── supabase/          # Supabase client & types
│   │   ├── auth/              # Authentication service
│   │   ├── audit/             # Audit logging service
│   │   ├── modules/           # Module management
│   │   └── users/             # User management
│   ├── components/
│   │   ├── auth/              # Login & auth UI
│   │   ├── dashboard/         # Dashboard components
│   │   └── modules/           # Module components
│   └── App.tsx
├── database-setup.sql         # Complete database schema
├── FIELDPECKER_SCHEMA.md      # Detailed schema docs
└── SETUP_GUIDE.md             # Comprehensive setup guide
```

## Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup instructions
- **[FIELDPECKER_SCHEMA.md](./FIELDPECKER_SCHEMA.md)** - Database architecture & schema

## Security Features

✅ **Authentication Security**
- 12+ character passwords with complexity requirements
- 5 failed attempts = 15-minute account lockout
- Single device sessions
- 30-minute inactivity timeout
- 90-day password expiry

✅ **Database Security**
- Row-Level Security on all tables
- Multi-tenant isolation by `org_id`
- Role-based access control
- Automatic audit logging

## Service Layer

All database operations use type-safe service classes:

```typescript
import { AuthService } from './lib/auth/auth-service';
import { ModuleService } from './lib/modules/module-service';
import { UserService } from './lib/users/user-service';
import { AuditService } from './lib/audit/audit-service';

// Sign in
await AuthService.signIn({ email, password });

// Check module access
const { hasAccess } = await ModuleService.checkModuleAccess(userId, 'supervision');

// Get team structure
const team = await UserService.getTeamStructure(userId);

// View audit logs
const logs = await AuditService.getRecentActivity(orgId);
```

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Security**: Row-Level Security (RLS) for multi-tenancy
- **Deployment**: Ready for Vercel/Netlify

## Environment Variables

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Next Steps

1. ✅ Apply database migration
2. ✅ Create organization and admin user
3. ✅ Test login and dashboard
4. 🚀 Implement module-specific features:
   - Supervision: visits, compliance checks
   - Issues: ticket system, workflows
   - Leads: CRM functionality
   - KPIs: dashboards, reports

## Support

For questions or issues, refer to:
- Database schema: `FIELDPECKER_SCHEMA.md`
- Setup guide: `SETUP_GUIDE.md`
- Supabase docs: https://supabase.com/docs

## License

MIT
# fieldpecker_dashboard
# fieldpecker-vita-v2
