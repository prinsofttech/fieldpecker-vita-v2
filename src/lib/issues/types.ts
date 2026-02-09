export type IssuePriority = 'low' | 'medium' | 'high';
export type IssueStatus = 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'on_hold';

export interface IssueCategory {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueCustomStatus {
  id: string;
  org_id: string | null;
  name: string;
  display_name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  is_closed: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  org_id: string;
  issue_number: string;
  title: string;
  description: string | null;
  category_id: string | null;
  priority: IssuePriority;
  status: IssueStatus;
  status_id: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  reported_by: string;
  reported_at: string;
  customer_id: string | null;
  due_date: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  action_taken: string | null;
  last_modified_by: string | null;
  last_modified_at: string | null;
  tags: string[] | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  user_id: string;
  comment_text: string;
  is_internal: boolean;
  is_work_note: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export interface IssueAttachment {
  id: string;
  issue_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

export interface IssueHistory {
  id: string;
  issue_id: string;
  changed_by: string;
  change_type: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export interface StatusChangeComment {
  id: string;
  issue_id: string;
  old_status: string;
  new_status: string;
  comment: string;
  changed_by: string;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export interface CreateIssueData {
  title: string;
  description?: string;
  category_id?: string;
  priority?: IssuePriority;
  assigned_to?: string;
  customer_id?: string;
  due_date?: string;
  tags?: string[];
  action_taken: string;
}

export interface UpdateIssueData {
  title?: string;
  description?: string;
  category_id?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  status_id?: string;
  assigned_to?: string;
  customer_id?: string;
  due_date?: string;
  tags?: string[];
  action_taken?: string;
}

export interface StatusChangeData {
  newStatus: IssueStatus;
  comment: string;
  statusId?: string;
}

export interface IssueFilters {
  status?: IssueStatus[];
  priority?: IssuePriority[];
  assigned_to?: string;
  reported_by?: string;
  category_id?: string;
  customer_id?: string;
  search?: string;
  status_id?: string;
  start_date?: string;
  end_date?: string;
  region_id?: string;
  branch_id?: string;
}

export interface IssueStats {
  total: number;
  new: number;
  assigned: number;
  in_progress: number;
  resolved: number;
  closed: number;
  on_hold: number;
  by_priority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface IssueWithDetails extends Issue {
  category?: IssueCategory;
  custom_status?: IssueCustomStatus;
  assignee?: {
    id: string;
    full_name: string;
    email: string;
  };
  reporter?: {
    id: string;
    full_name: string;
    email: string;
  };
  last_modifier?: {
    id: string;
    full_name: string;
    email: string;
  };
  customer?: {
    id: string;
    customer_name: string;
  };
}
