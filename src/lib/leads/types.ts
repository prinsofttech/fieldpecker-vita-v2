export type LeadFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'radio'
  | 'url'
  | 'file';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'hot'
  | 'warm'
  | 'cold'
  | 'mild'
  | 'negotiation'
  | 'proposal_sent'
  | 'stale'
  | 'won'
  | 'lost'
  | 'disqualified';

export interface LeadFormTemplate {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadFormField {
  id: string;
  template_id: string;
  field_name: string;
  field_label: string;
  field_type: LeadFieldType;
  field_options?: FieldOption[];
  is_required: boolean;
  validation_rules?: ValidationRules;
  placeholder?: string;
  help_text?: string;
  display_order: number;
  created_at: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: string;
}

export interface Lead {
  id: string;
  org_id: string;
  template_id?: string;
  full_name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: LeadStatus;
  score: number;
  source?: string;
  assigned_to?: string;
  created_by?: string;
  region_id?: string;
  branch_id?: string;
  territory_id?: string;
  sub_territory_id?: string;
  picture_url?: string;
  rank_id?: string;
  is_qualified: boolean;
  is_stale: boolean;
  progress_status?: 'negotiation' | 'won' | 'closed';
  notes?: string;
  last_contact_date?: string;
  next_followup_date?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadFieldValue {
  id: string;
  lead_id: string;
  field_id: string;
  field_value?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadStatusHistory {
  id: string;
  lead_id: string;
  old_status?: string;
  new_status: string;
  changed_by?: string;
  notes?: string;
  changed_at: string;
}

export interface LeadAssignment {
  id: string;
  lead_id: string;
  user_id: string;
  assigned_by?: string;
  assigned_at: string;
  unassigned_at?: string;
  is_active: boolean;
  notes?: string;
}

export interface LeadRank {
  id: string;
  org_id: string;
  rank_key: string;
  rank_label: string;
  rank_color: string;
  rank_bg_color: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadStatusRecord {
  id: string;
  org_id: string;
  status_key: string;
  status_label: string;
  status_color: string;
  status_bg_color: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadWithDetails extends Lead {
  template?: LeadFormTemplate;
  field_values?: LeadFieldValue[];
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  created_by_user?: {
    id: string;
    full_name: string;
  };
  region?: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  territory?: {
    id: string;
    name: string;
    code?: string;
  };
  sub_territory?: {
    id: string;
    name: string;
    code?: string;
  };
  rank?: LeadRank;
}

export interface CreateLeadData {
  org_id: string;
  template_id?: string;
  full_name: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: LeadStatus;
  score?: number;
  source?: string;
  assigned_to?: string;
  region_id?: string;
  branch_id?: string;
  territory_id?: string;
  sub_territory_id?: string;
  picture_url?: string;
  rank_id?: string;
  is_qualified?: boolean;
  is_stale?: boolean;
  progress_status?: 'negotiation' | 'won' | 'closed';
  notes?: string;
  field_values?: {
    field_id: string;
    field_value: string;
  }[];
}

export interface UpdateLeadData {
  full_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: LeadStatus;
  score?: number;
  source?: string;
  assigned_to?: string;
  region_id?: string;
  branch_id?: string;
  territory_id?: string;
  sub_territory_id?: string;
  picture_url?: string;
  rank_id?: string | null;
  is_qualified?: boolean;
  is_stale?: boolean;
  progress_status?: 'negotiation' | 'won' | 'closed';
  notes?: string;
  last_contact_date?: string;
  next_followup_date?: string;
  field_values?: {
    field_id: string;
    field_value: string;
  }[];
}

export interface LeadFilters {
  status?: LeadStatus | LeadStatus[];
  rank_id?: string;
  assigned_to?: string;
  created_by?: string;
  region_id?: string;
  branch_id?: string;
  source?: string;
  score_min?: number;
  score_max?: number;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface LeadStats {
  total: number;
  new: number;
  hot: number;
  warm: number;
  cold: number;
  mild: number;
  negotiation: number;
  won: number;
  lost: number;
  conversion_rate: number;
  avg_score: number;
}

export const LEAD_STATUS_CONFIG: Record<LeadStatus, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  new: {
    label: 'New',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Newly created lead, not yet contacted'
  },
  contacted: {
    label: 'Contacted',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    description: 'Initial contact has been made'
  },
  qualified: {
    label: 'Qualified',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
    description: 'Lead meets qualification criteria'
  },
  hot: {
    label: 'Hot',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'High-priority lead requiring immediate attention'
  },
  warm: {
    label: 'Warm',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    description: 'Interested lead with good potential'
  },
  cold: {
    label: 'Cold',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    description: 'Low-priority or unresponsive lead'
  },
  mild: {
    label: 'Mild',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    description: 'Medium-priority lead with moderate engagement'
  },
  negotiation: {
    label: 'Negotiation',
    color: 'text-violet-700',
    bgColor: 'bg-violet-100',
    description: 'In active sales discussions'
  },
  proposal_sent: {
    label: 'Proposal Sent',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    description: 'Proposal has been sent, awaiting response'
  },
  stale: {
    label: 'Stale',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    description: 'Inactive for an extended period'
  },
  won: {
    label: 'Won',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Successfully converted to customer'
  },
  lost: {
    label: 'Lost',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'Lost to competitor or not interested'
  },
  disqualified: {
    label: 'Disqualified',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    description: 'Does not meet qualification criteria'
  }
};

export const LEAD_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'partner', label: 'Partner' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'organic_search', label: 'Organic Search' },
  { value: 'direct', label: 'Direct' },
  { value: 'other', label: 'Other' }
];
