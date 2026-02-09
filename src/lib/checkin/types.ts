export interface Checkin {
  id: string;
  user_id: string;
  org_id: string;
  check_in_at: string;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_at: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface CheckinWithUser extends Checkin {
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CheckinFilters {
  user_id?: string;
  status?: 'checked_in' | 'checked_out' | 'all';
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface CheckinStats {
  total: number;
  checked_in: number;
  checked_out: number;
  avg_duration_minutes: number;
}
