export type OrganizationStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type SubscriptionTier = 'basic' | 'professional' | 'enterprise';
export type UserStatus = 'active' | 'inactive' | 'locked';
export type RoleName = 'client_admin' | 'regional_manager' | 'branch_manager' | 'supervisor' | 'field_agent';
export type ModuleName =
  | 'forms'
  | 'issue_tracker'
  | 'heat_map'
  | 'my_team'
  | 'customers'
  | 'leads_sales'
  | 'reports'
  | 'expenses'
  | 'last_mile_delivery'
  | 'hr_records'
  | 'leave_management'
  | 'timesheets';

export interface Region {
  id: string;
  org_id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  org_id: string;
  region_id: string | null;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  region?: Region;
}

export interface Department {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  code: string;
  description: string | null;
  operating: 'on_field' | 'in_office';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  employee_count?: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  subscription_tier: SubscriptionTier;
  settings: Record<string, any>;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: RoleName;
  display_name: string;
  level: number;
  permissions: Record<string, boolean>;
  description: string | null;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  role_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  status: UserStatus;
  last_login_at: string | null;
  password_changed_at: string;
  failed_login_attempts: number;
  locked_until: string | null;
  device_id: string | null;
  session_expires_at: string | null;
  parent_user_id: string | null;
  region_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  role?: Role;
  organization?: Organization;
  parent_user?: User;
  region?: Region;
  branch?: Branch;
  department?: Department;
}

export interface Module {
  id: string;
  name: ModuleName;
  display_name: string;
  description: string | null;
  icon: string | null;
  is_core: boolean;
  created_at: string;
}

export interface OrgModule {
  id: string;
  org_id: string;
  module_id: string;
  is_enabled: boolean;
  settings: Record<string, any>;
  enabled_at: string;
  enabled_by: string | null;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: User;
}

export interface PasswordHistory {
  id: string;
  user_id: string;
  password_hash: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>;
      };
      roles: {
        Row: Role;
        Insert: Omit<Role, 'id' | 'created_at'>;
        Update: Partial<Omit<Role, 'id' | 'created_at'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at' | 'failed_login_attempts' | 'status'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      modules: {
        Row: Module;
        Insert: Omit<Module, 'id' | 'created_at'>;
        Update: Partial<Omit<Module, 'id' | 'created_at'>>;
      };
      org_modules: {
        Row: OrgModule;
        Insert: Omit<OrgModule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrgModule, 'id' | 'created_at'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: never;
      };
      password_history: {
        Row: PasswordHistory;
        Insert: Omit<PasswordHistory, 'id' | 'created_at'>;
        Update: never;
      };
    };
    Functions: {
      user_has_module_access: {
        Args: { p_user_id: string; p_module_name: ModuleName };
        Returns: boolean;
      };
      user_can_manage: {
        Args: { p_manager_id: string; p_user_id: string };
        Returns: boolean;
      };
      log_audit_trail: {
        Args: {
          p_org_id: string;
          p_user_id: string;
          p_action: string;
          p_entity_type: string;
          p_entity_id: string;
          p_changes?: Record<string, any>;
          p_ip_address?: string;
          p_user_agent?: string;
        };
        Returns: string;
      };
    };
  };
}
