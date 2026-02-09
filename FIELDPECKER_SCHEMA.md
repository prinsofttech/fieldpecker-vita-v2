# FieldPecker Database Schema Documentation

## Overview

FieldPecker uses a **single-database multi-tenancy architecture** powered by Supabase PostgreSQL with Row-Level Security (RLS). Each organization (`org_id`) is completely isolated through RLS policies.

## Core Architecture Principles

1. **Multi-Tenancy**: All data is segregated by `org_id` with RLS enforcement
2. **Hierarchical Roles**: 5-level user hierarchy (Admin → Regional Manager → Branch Manager → Supervisor → Field Agent)
3. **Modular Features**: Configurable modules per organization
4. **Security First**: Comprehensive audit logging, password policies, session management
5. **Offline Support**: Design supports sync capabilities for mobile agents

---

## Database Tables

### 1. `organizations`

**Purpose**: Core tenant table - each organization is an isolated tenant

```sql
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  subscription_tier text NOT NULL DEFAULT 'basic'
    CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Key Fields**:
- `slug`: URL-friendly identifier for the organization
- `status`: Controls organization access
- `subscription_tier`: Determines feature availability
- `settings`: Org-specific configuration (theme, notifications, etc.)

**RLS Policies**:
- Users can only view their own organization
- Only Client Admins can update organization settings

---

### 2. `roles`

**Purpose**: Hierarchical role definitions (system-wide)

```sql
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
    CHECK (name IN ('client_admin', 'regional_manager', 'branch_manager', 'supervisor', 'field_agent')),
  display_name text NOT NULL,
  level integer NOT NULL CHECK (level >= 1 AND level <= 5),
  permissions jsonb DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now()
);
```

**Hierarchy**:
1. **Client Admin** (Level 1) - Full organizational control
2. **Regional Manager** (Level 2) - Manages multiple branches
3. **Branch Manager** (Level 3) - Manages single branch
4. **Supervisor** (Level 4) - Supervises field agents
5. **Field Agent** (Level 5) - Executes field operations

**Key Principle**: Lower level number = higher authority

---

### 3. `users`

**Purpose**: Extended user profiles linked to Supabase auth.users

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'locked')),

  -- Security fields
  last_login_at timestamptz,
  password_changed_at timestamptz DEFAULT now(),
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  device_id text,  -- Single device enforcement
  session_expires_at timestamptz,  -- 30-minute timeout

  -- Hierarchy
  parent_user_id uuid REFERENCES users(id),

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Security Features**:
- **Account Lockout**: 5 failed attempts = 15-minute lock
- **Session Timeout**: 30 minutes of inactivity
- **Single Device**: One active session per user
- **Password Expiry**: 90 days (enforced in application)

**RLS Policies**:
- Users see only users in their organization
- Admins and managers (level ≤ 3) can create/update users
- Only Client Admins can delete users

---

### 4. `modules`

**Purpose**: Available platform features (system-wide)

```sql
CREATE TABLE modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
    CHECK (name IN ('supervision', 'issue_tracker', 'leads_sales', 'performance_kpi')),
  display_name text NOT NULL,
  description text,
  icon text,
  is_core boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Default Modules**:
- **Supervision**: Field visits, compliance checks, GPS/photo capture
- **Issue Tracker**: Issue logging, assignments, escalations
- **Leads & Sales**: Lead capture, follow-ups, conversions
- **Performance & KPIs**: Target monitoring, dashboards, reports

---

### 5. `org_modules`

**Purpose**: Module activation per organization

```sql
CREATE TABLE org_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT true,
  settings jsonb DEFAULT '{}',  -- Module-specific config
  enabled_at timestamptz DEFAULT now(),
  enabled_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, module_id)
);
```

**Usage**:
- Controls which modules are active for each organization
- Module-specific settings stored in `settings` jsonb
- Only Client Admins can enable/disable modules

**RLS Policies**:
- Users can view their org's modules
- Only Client Admins can manage modules

---

### 6. `audit_logs`

**Purpose**: Comprehensive activity tracking for compliance

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb DEFAULT '{}',  -- Before/after data
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
```

**Tracked Actions**:
- User login/logout
- User creation/updates/deletion
- Module enable/disable
- Password changes
- Account locks/unlocks
- All sensitive operations

**RLS Policies**:
- Users can view audit logs from their organization
- All authenticated users can insert logs (system operations)

---

### 7. `password_history`

**Purpose**: Prevent password reuse

```sql
CREATE TABLE password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Usage**:
- Stores last N password hashes per user
- Prevents reuse of recent passwords
- Implements NIST password guidelines

---

## Helper Functions

### 1. `user_has_module_access(p_user_id, p_module_name)`

**Purpose**: Check if a user has access to a specific module

```sql
SELECT user_has_module_access('user-uuid', 'supervision');
-- Returns: boolean
```

**Logic**:
- Checks if user's organization has the module enabled
- Returns true only if `is_enabled = true`

---

### 2. `user_can_manage(p_manager_id, p_user_id)`

**Purpose**: Check if one user can manage another (hierarchy check)

```sql
SELECT user_can_manage('manager-uuid', 'user-uuid');
-- Returns: boolean
```

**Logic**:
- Both users must be in same organization
- Manager's role level must be LESS THAN user's level
- Example: Branch Manager (3) can manage Supervisor (4)

---

### 3. `log_audit_trail(...)`

**Purpose**: Simplified audit logging

```sql
SELECT log_audit_trail(
  'org-uuid',
  'user-uuid',
  'user_updated',
  'users',
  'entity-uuid',
  '{"field": "value"}'::jsonb
);
-- Returns: audit_log_id
```

---

## Security Implementation

### Row-Level Security (RLS)

**Every table has RLS enabled** with policies that enforce:

1. **Organization Isolation**: Users can only access data from their `org_id`
2. **Role-Based Access**: Operations restricted by role level
3. **Hierarchy Enforcement**: Managers can only manage subordinates

### Authentication Flow

```typescript
// 1. Sign In
AuthService.signIn({ email, password, device_id })
  → Check account status (active/locked)
  → Validate device_id (single session)
  → Track failed attempts (5 max)
  → Update last_login_at
  → Create session with 30-min expiry

// 2. Session Management
- Auto-refresh on activity
- Force logout after 30 minutes idle
- Validate session expiry on each request

// 3. Password Policy
- Minimum 12 characters
- Must contain: uppercase, lowercase, number, special char
- Cannot reuse last 5 passwords
- 90-day expiry
```

---

## TypeScript Integration

### Type Definitions

All database types are defined in `src/lib/supabase/types.ts`:

```typescript
export interface User {
  id: string;
  org_id: string;
  role_id: string;
  email: string;
  full_name: string;
  status: 'active' | 'inactive' | 'locked';
  // ... all fields
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      // ... all tables
    };
    Functions: {
      user_has_module_access: {
        Args: { p_user_id: string; p_module_name: ModuleName };
        Returns: boolean;
      };
      // ... all functions
    };
  };
}
```

### Client Setup

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

---

## Service Layer Architecture

### AuthService (`src/lib/auth/auth-service.ts`)

Handles all authentication operations:
- Sign up with user profile creation
- Sign in with security checks
- Password management
- Session handling

### ModuleService (`src/lib/modules/module-service.ts`)

Manages module access:
- Check module availability
- Enable/disable modules
- Module settings management
- Access validation

### UserService (`src/lib/users/user-service.ts`)

User management operations:
- CRUD operations with RLS enforcement
- Hierarchy queries
- Team structure retrieval
- Permission checks

### AuditService (`src/lib/audit/audit-service.ts`)

Audit logging and reporting:
- Log all sensitive operations
- Query audit history
- Export compliance reports
- Activity monitoring

---

## Migration Instructions

### To Apply the Schema:

Since the MCP tool has path issues, you need to manually apply the migration SQL:

1. **Copy the SQL** from `supabase/migrations/001_core_schema_and_security.sql`

2. **Open Supabase Dashboard**:
   - Go to your project dashboard
   - Navigate to SQL Editor
   - Paste the complete SQL migration
   - Execute

3. **Verify Tables Created**:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public';
   ```

4. **Verify RLS Enabled**:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public';
   ```

### Test Data Setup

After migration, create test data:

```sql
-- 1. Create test organization
INSERT INTO organizations (name, slug, status)
VALUES ('Test Bank', 'test-bank', 'active');

-- 2. Create test admin user (requires auth.users entry first via Supabase Auth UI)
-- Then link to users table:
INSERT INTO users (id, org_id, role_id, email, full_name)
SELECT
  '<auth-user-id>',
  (SELECT id FROM organizations WHERE slug = 'test-bank'),
  (SELECT id FROM roles WHERE name = 'client_admin'),
  'admin@testbank.com',
  'Admin User';

-- 3. Enable modules
INSERT INTO org_modules (org_id, module_id, enabled_by)
SELECT
  (SELECT id FROM organizations WHERE slug = 'test-bank'),
  m.id,
  (SELECT id FROM users WHERE email = 'admin@testbank.com')
FROM modules m;
```

---

## Next Steps

1. **Apply the migration** to your Supabase database
2. **Create your first organization** and admin user
3. **Enable desired modules**
4. **Implement module-specific tables** (supervision visits, issues, leads, etc.)
5. **Build Flutter mobile app** using the same architecture

---

## Support & Best Practices

### Always Include in Queries:

```typescript
// Automatic org_id filtering via RLS
const { data } = await supabase
  .from('users')
  .select('*')
  // RLS automatically adds: .eq('org_id', current_user_org_id)
```

### Module Access Check:

```typescript
// Before allowing module operations
const { hasAccess } = await ModuleService.checkModuleAccess(
  userId,
  'supervision'
);

if (!hasAccess) {
  throw new Error('Module not enabled for your organization');
}
```

### Audit Everything:

```typescript
// After sensitive operations
await AuditService.log(
  orgId,
  userId,
  'user_created',
  'users',
  newUserId,
  { email: newUser.email, role: newUser.role_id }
);
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL                 │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐     ┌──────────────┐             │
│  │organizations │◄────┤    users     │             │
│  └──────────────┘     └──────┬───────┘             │
│         ▲                    │                      │
│         │                    ▼                      │
│  ┌──────┴──────┐      ┌──────────────┐             │
│  │ org_modules │◄─────┤  audit_logs  │             │
│  └──────┬──────┘      └──────────────┘             │
│         │                                           │
│  ┌──────▼──────┐      ┌──────────────┐             │
│  │   modules   │      │    roles     │             │
│  └─────────────┘      └──────────────┘             │
│                                                     │
│  Row-Level Security (RLS) on ALL tables            │
│  org_id isolation + role hierarchy enforcement      │
└─────────────────────────────────────────────────────┘
                        ▲
                        │ Supabase Client
                        │
┌───────────────────────┴──────────────────────────────┐
│              TypeScript Service Layer                 │
├──────────────────────────────────────────────────────┤
│  AuthService  │  ModuleService  │  UserService       │
│  AuditService │  Organization specific services      │
└──────────────────────────────────────────────────────┘
                        ▲
                        │
┌───────────────────────┴──────────────────────────────┐
│                 React Web App                         │
│              Flutter Mobile App                       │
└──────────────────────────────────────────────────────┘
```
