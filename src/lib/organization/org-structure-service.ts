import { supabase } from '../supabase/client';
import type { Region, Branch, Department } from '../supabase/types';

export class OrgStructureService {
  static async getRegions(orgId: string, parentId?: string | null) {
    let query = supabase
      .from('regions')
      .select('*, parent:regions!parent_id(id, name)')
      .eq('org_id', orgId);

    if (parentId === null) {
      query = query.is('parent_id', null);
    } else if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    const { data, error } = await query.order('name');

    return { data: data || [], error };
  }

  static async createRegion(region: {
    org_id: string;
    name: string;
    code: string;
    description?: string;
    address?: string;
    parent_id?: string | null;
  }) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('regions')
      .insert({
        ...region,
        created_by: user?.id,
      })
      .select('*, parent:regions!parent_id(id, name)')
      .single();

    return { data, error };
  }

  static async createRegions(regions: Array<{
    org_id: string;
    name: string;
    code: string;
    description?: string;
    address?: string;
    parent_id?: string | null;
  }>) {
    const { data: { user } } = await supabase.auth.getUser();

    const regionsWithUser = regions.map(region => ({
      ...region,
      created_by: user?.id,
    }));

    const { data, error } = await supabase
      .from('regions')
      .insert(regionsWithUser)
      .select('*, parent:regions!parent_id(id, name)');

    return { data, error };
  }

  static async updateRegion(id: string, updates: Partial<Region>) {
    const { data, error } = await supabase
      .from('regions')
      .update(updates)
      .eq('id', id)
      .select('*, parent:regions!parent_id(id, name)')
      .single();

    return { data, error };
  }

  static async deleteRegion(id: string) {
    const { error } = await supabase
      .from('regions')
      .delete()
      .eq('id', id);

    return { error };
  }

  static async getBranches(orgId: string, regionId?: string) {
    let query = supabase
      .from('branches')
      .select('*, region:regions(*)')
      .eq('org_id', orgId);

    if (regionId) {
      query = query.eq('region_id', regionId);
    }

    const { data, error } = await query.order('name');
    return { data: data || [], error };
  }

  static async createBranch(branch: {
    org_id: string;
    region_id?: string;
    name: string;
    code: string;
    address?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('branches')
      .insert({
        ...branch,
        created_by: user?.id,
      })
      .select('*, region:regions(*)')
      .single();

    return { data, error };
  }

  static async createBranches(branches: Array<{
    org_id: string;
    region_id?: string | null;
    name: string;
    code: string;
    address?: string | null;
  }>) {
    const { data: { user } } = await supabase.auth.getUser();

    const branchesWithUser = branches.map(branch => ({
      ...branch,
      created_by: user?.id,
    }));

    const { data, error } = await supabase
      .from('branches')
      .insert(branchesWithUser)
      .select('*, region:regions(*)');

    return { data, error };
  }

  static async updateBranch(id: string, updates: Partial<Branch>) {
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select('*, region:regions(*)')
      .single();

    return { data, error };
  }

  static async deleteBranch(id: string) {
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', id);

    return { error };
  }

  static async getDepartments(orgId: string, branchId?: string) {
    let query = supabase
      .from('departments')
      .select('*, branch:branches(*, region:regions(*))')
      .eq('org_id', orgId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('name');
    return { data: data || [], error };
  }

  static async createDepartment(department: {
    org_id: string;
    branch_id?: string;
    name: string;
    code: string;
    description?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('departments')
      .insert({
        ...department,
        created_by: user?.id,
      })
      .select('*, branch:branches(*, region:regions(*))')
      .single();

    return { data, error };
  }

  static async updateDepartment(id: string, updates: Partial<Department>) {
    const { data, error } = await supabase
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select('*, branch:branches(*, region:regions(*))')
      .single();

    return { data, error };
  }

  static async deleteDepartment(id: string) {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    return { error };
  }
}
