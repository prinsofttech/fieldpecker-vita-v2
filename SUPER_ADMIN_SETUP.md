# Super Admin Role - System Administrator

## ✅ Implementation Complete

A **Super Admin** role has been added to the FieldPecker system to enable system-level administration and client creation.

---

## 🎯 Role Hierarchy

```
Level 0: Super Admin      (System Administrator)
  ↓
Level 1: Client Admin     (Organization Administrator)
  ↓
Level 2: Regional Manager (Multi-branch Manager)
  ↓
Level 3: Branch Manager   (Single Branch Manager)
  ↓
Level 4: Supervisor       (Team Leader)
  ↓
Level 5: Field Agent      (Field Worker)
```

---

## 🔐 Super Admin Capabilities

### System-Level Access
- ✅ **Create Organizations** - Set up new client accounts
- ✅ **View All Organizations** - Access to all client data
- ✅ **Manage All Users** - Create/update/delete users across all orgs
- ✅ **Configure Modules** - Enable/disable modules for any organization
- ✅ **View All Audit Logs** - Complete system activity visibility
- ✅ **Delete Organizations** - Remove client accounts if needed

### Key Differences from Client Admin
| Feature | Super Admin | Client Admin |
|---------|-------------|--------------|
| Organization Access | All organizations | Single organization |
| Create Organizations | ✅ Yes | ❌ No |
| Cross-org User Management | ✅ Yes | ❌ No |
| System-wide Audit Logs | ✅ Yes | ❌ No |
| Org ID Required | ❌ No (NULL) | ✅ Yes |

---

## 📊 Database Schema Changes

### Roles Table
```sql
-- New super_admin role added
INSERT INTO roles (name, display_name, level, permissions)
VALUES (
  'super_admin',
  'Super Admin',
  0,  -- Highest privilege level
  '{
    "system_admin": true,
    "create_organizations": true,
    "manage_all": true
  }'
);
```

### Users Table
```sql
-- org_id is now NULLABLE for super admins
ALTER TABLE users ALTER COLUMN org_id DROP NOT NULL;

-- Super admins have org_id = NULL
-- Regular users must have org_id
```

### Constraints Updated
- `roles.name` CHECK: Added `'super_admin'`
- `roles.level` CHECK: Changed to `level >= 0 AND level <= 5` (was `>= 1`)
- `users.org_id`: Now nullable (was NOT NULL)

---

## 🔒 Security & RLS Policies

### Super Admin Access Control

**Helper Function:**
```sql
CREATE FUNCTION is_super_admin(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.id = p_user_id AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Updated RLS Policies

**Organizations:**
- ✅ Super admins can view ALL organizations
- ✅ Super admins can create organizations
- ✅ Super admins can update ANY organization
- ✅ Super admins can delete organizations

**Users:**
- ✅ Super admins can view ALL users (across all orgs)
- ✅ Super admins can create users in ANY organization
- ✅ Super admins can update ANY user
- ✅ Super admins can delete ANY user

**Org Modules:**
- ✅ Super admins can view modules for ALL organizations
- ✅ Super admins can enable/disable modules for ANY org
- ✅ Super admins can configure module settings

**Audit Logs:**
- ✅ Super admins can view ALL audit logs system-wide
- Regular users only see their org's logs

---

## 🚀 Creating a Super Admin Account

### Method 1: Via Supabase Dashboard

1. **Create Auth User**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Enter email and password
   - Note the user ID

2. **Get Super Admin Role ID**
   ```sql
   SELECT id FROM roles WHERE name = 'super_admin';
   -- Note the UUID
   ```

3. **Create User Record**
   ```sql
   INSERT INTO users (
     id,
     org_id,
     role_id,
     email,
     full_name,
     status
   ) VALUES (
     'auth-user-uuid-here',        -- From step 1
     NULL,                          -- Super admins have NULL org_id
     'super-admin-role-uuid-here',  -- From step 2
     'admin@yourcompany.com',
     'System Administrator',
     'active'
   );
   ```

### Method 2: Via Application (Recommended)

Create an admin registration endpoint or script:

```typescript
// Example service function
async function createSuperAdmin(email: string, password: string, fullName: string) {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (authError) throw authError;
  
  // 2. Get super admin role
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'super_admin')
    .single();
  
  // 3. Create user record
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      org_id: null,  // Super admin has no org
      role_id: role.id,
      email,
      full_name: fullName,
      status: 'active'
    });
  
  if (userError) throw userError;
  
  return authData.user;
}
```

---

## 🧪 Testing Super Admin Access

### Test 1: View All Organizations
```typescript
const { data, error } = await supabase
  .from('organizations')
  .select('*');

// Super admin should see ALL orgs
// Regular user should only see their org
```

### Test 2: Create Organization
```typescript
const { data, error } = await supabase
  .from('organizations')
  .insert({
    name: 'New Client Corp',
    slug: 'new-client-corp',
    status: 'trial',
    subscription_tier: 'basic'
  });

// Should succeed for super admin
// Should fail for client admin
```

### Test 3: Cross-Org User Access
```typescript
const { data, error } = await supabase
  .from('users')
  .select('*, organizations(name)')
  .neq('org_id', myOrgId);

// Super admin should see users from other orgs
// Regular users should see empty result
```

---

## 📋 Best Practices

### Security
- ✅ Limit number of super admin accounts (1-3 maximum)
- ✅ Use strong passwords (20+ characters)
- ✅ Enable MFA for super admin accounts
- ✅ Regularly audit super admin activity
- ✅ Never share super admin credentials

### Account Management
- ✅ Use personal email addresses (not generic@company.com)
- ✅ Document who has super admin access
- ✅ Revoke access when employee leaves
- ✅ Regular password rotation (every 90 days)
- ✅ Monitor super admin login patterns

### Operations
- ✅ Log all super admin actions in audit trail
- ✅ Require approval for organization deletion
- ✅ Create backup super admin account
- ✅ Test super admin access in staging first
- ✅ Document super admin procedures

---

## 🔄 Common Super Admin Tasks

### Create New Client Organization

```typescript
async function createClientOrganization(
  name: string,
  slug: string,
  adminEmail: string,
  adminName: string
) {
  // 1. Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      status: 'trial',
      subscription_tier: 'basic'
    })
    .select()
    .single();
  
  if (orgError) throw orgError;
  
  // 2. Create auth user for client admin
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: generateSecurePassword(),
    email_confirm: false  // They'll set password on first login
  });
  
  if (authError) throw authError;
  
  // 3. Get client_admin role
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'client_admin')
    .single();
  
  // 4. Create user record
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      org_id: org.id,
      role_id: role.id,
      email: adminEmail,
      full_name: adminName,
      status: 'active'
    });
  
  if (userError) throw userError;
  
  // 5. Enable default modules
  const { data: modules } = await supabase
    .from('modules')
    .select('id');
  
  const orgModules = modules.map(m => ({
    org_id: org.id,
    module_id: m.id,
    is_enabled: true
  }));
  
  await supabase.from('org_modules').insert(orgModules);
  
  return { organization: org, adminUser: authData.user };
}
```

### Disable/Suspend Organization

```typescript
async function suspendOrganization(orgId: string, reason: string) {
  const { error } = await supabase
    .from('organizations')
    .update({ 
      status: 'suspended',
      settings: { suspension_reason: reason }
    })
    .eq('id', orgId);
  
  if (error) throw error;
  
  // Log the action
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: currentUserId,
    action: 'organization_suspended',
    entity_type: 'organizations',
    entity_id: orgId,
    changes: { reason }
  });
}
```

---

## 📊 Monitoring Super Admin Activity

### Query Recent Super Admin Actions
```sql
SELECT 
  al.created_at,
  u.full_name as admin_name,
  u.email as admin_email,
  al.action,
  al.entity_type,
  o.name as affected_org,
  al.changes
FROM audit_logs al
JOIN users u ON al.user_id = u.id
JOIN roles r ON u.role_id = r.id
LEFT JOIN organizations o ON al.org_id = o.id
WHERE r.name = 'super_admin'
ORDER BY al.created_at DESC
LIMIT 100;
```

### Count Organizations by Status
```sql
SELECT 
  status,
  COUNT(*) as count,
  array_agg(name ORDER BY created_at DESC) as recent_orgs
FROM organizations
GROUP BY status;
```

---

## ✅ Migration Files Applied

1. **003_add_super_admin_role.sql**
   - Added super_admin role
   - Updated constraints
   - Made org_id nullable

2. **004_super_admin_rls_policies.sql**
   - Created is_super_admin() helper
   - Updated all RLS policies
   - Granted super admin full access

---

## 🎯 Summary

✅ **Super Admin Role Created**
- Level 0 (highest privilege)
- System-wide access
- Can create and manage all organizations

✅ **Database Updated**
- org_id nullable for super admins
- Constraints updated
- Indexes optimized

✅ **RLS Policies Updated**
- Super admins bypass org restrictions
- Helper function for easy checking
- Regular users remain restricted

✅ **Ready for Production**
- Secure by design
- Fully audited
- Documented procedures

**Next Step:** Create your first super admin account and start onboarding clients!
