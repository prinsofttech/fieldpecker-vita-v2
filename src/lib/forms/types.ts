export interface Form {
  id: string;
  org_id: string;
  internal_form_id: string;
  title: string;
  description?: string;
  form_schema: FormField[];
  department_id?: string;
  created_by?: string;
  attach_to_customer: boolean;
  cycles_per_month: 1 | 2 | 3 | 4;
  enable_freeze: boolean;
  cycle_freeze_duration?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type InputMaskType = 'none' | 'phone' | 'numeric' | 'alpha' | 'alphanumeric' | 'currency' | 'custom';

export interface InputMask {
  type: InputMaskType;
  customPattern?: string;
  format?: string;
  maxLength?: number;
  prefix?: string;
  suffix?: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'date' | 'time' | 'checkbox' | 'radio' | 'file' | 'image';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  dateRestriction?: 'none' | 'past' | 'future' | 'today-future' | 'today-past';
  inputMask?: InputMask;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  order: number;
}

export interface FormCustomerAttachment {
  id: string;
  form_id: string;
  customer_id: string;
  criteria: CriteriaRule[];
  is_active: boolean;
  attached_at: string;
  attached_by?: string;
}

export interface CriteriaRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with';
  value: string;
}

export interface FormSubmissionLog {
  id: string;
  form_id: string;
  agent_id: string;
  tracking_month: string;
  current_cycle: number;
  max_cycles_allowed: number;
  submissions_count: number;
  is_frozen: boolean;
  freeze_expires_at?: string;
  last_submission_at?: string;
  config_snapshot?: any;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  agent_id: string;
  log_id?: string;
  submission_data: Record<string, any>;
  cycle_number: number;
  submitted_by?: string;
  latitude?: number;
  longitude?: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  time_spent?: string;
  supervisor_name?: string;
  supervisor_code?: string;
  form_started_at?: string;
  form_end_time?: string;
  submitted_at: string;
  updated_at: string;
  customer_name?: string;
  customer_code?: string;
  territory_name?: string;
  sub_territory_name?: string;
  submitter_name?: string;
}

export interface FormVisibility {
  visible: boolean;
  reason: string;
  current_cycle?: number;
  max_cycles?: number;
  remaining_submissions?: number;
  freeze_expires_at?: string;
  remaining_seconds?: number;
  log_id?: string;
  criteria?: CriteriaRule[];
}

export interface CreateFormData {
  title: string;
  description?: string;
  form_schema: FormField[];
  department_id?: string;
  attach_to_customer: boolean;
  cycles_per_month: 1 | 2 | 3 | 4;
  enable_freeze: boolean;
  cycle_freeze_duration?: string;
}

export interface UpdateFormData extends Partial<CreateFormData> {
  is_active?: boolean;
}

export interface SubmitFormData {
  form_id: string;
  agent_id: string;
  submission_data: Record<string, any>;
  latitude?: number;
  longitude?: number;
  time_spent?: string;
  supervisor_name?: string;
  supervisor_code?: string;
  form_started_at?: string;
}

export interface SubmitFormResponse {
  success: boolean;
  submission_id?: string;
  cycle_number?: number;
  frozen_until?: string;
  error?: string;
  details?: any;
}

export interface AttachFormData {
  form_id: string;
  customer_ids: string[];
  criteria: CriteriaRule[];
}

export interface TeamFormStats {
  agent_id: string;
  agent_name: string;
  forms: {
    form_id: string;
    form_title: string;
    submissions_count: number;
    current_cycle: number;
    max_cycles: number;
    completion_rate: number;
    last_submission_at?: string;
  }[];
}
