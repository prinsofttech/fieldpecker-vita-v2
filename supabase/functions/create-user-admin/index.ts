import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  org_id: string;
  role_id: string;
  reports_to_user_id?: string | null;
  supervisor_code?: string | null;
  territories?: string[];
  branches?: Array<{ branch_id: string; is_enabled: boolean }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !caller) {
      throw new Error('Unauthorized');
    }

    const { data: callerUser } = await supabaseClient
      .from('users')
      .select('role:roles(name)')
      .eq('id', caller.id)
      .single();

    const callerRole = (callerUser as any)?.role?.name;
    if (!['super_admin', 'client_admin', 'manager'].includes(callerRole)) {
      throw new Error('Unauthorized: Only admins can create users');
    }

    const { email, password, full_name, org_id, role_id, reports_to_user_id, supervisor_code, territories, branches }: CreateUserRequest = await req.json();

    if (!email || !password || !full_name || !org_id || !role_id) {
      throw new Error('Missing required fields');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const { data: roleData } = await supabaseClient
      .from('roles')
      .select('name')
      .eq('id', role_id)
      .single();

    if (!roleData) {
      throw new Error('Invalid role');
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: roleData.name,
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('Failed to create auth user');
    }

    const { data: result, error: rpcError } = await supabaseClient.rpc('admin_create_user', {
      p_user_id: authData.user.id,
      p_email: email,
      p_full_name: full_name,
      p_org_id: org_id,
      p_role_id: role_id,
      p_reports_to_user_id: reports_to_user_id || null,
      p_supervisor_code: supervisor_code || null,
    });

    if (rpcError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(rpcError.message);
    }

    if (result && !result.success) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(result.error || 'Failed to create user');
    }

    if (territories && territories.length > 0) {
      const territoryInserts = territories.map(territory_id => ({
        user_id: authData.user.id,
        region_id: territory_id,
        org_id: org_id,
        created_by: caller.id,
      }));

      const { error: territoryError } = await supabaseAdmin
        .from('user_territories')
        .insert(territoryInserts);

      if (territoryError) {
        console.error('Error inserting territories:', territoryError);
      }
    }

    if (branches && branches.length > 0) {
      const branchInserts = branches.map(({ branch_id, is_enabled }) => ({
        user_id: authData.user.id,
        branch_id,
        org_id: org_id,
        is_enabled,
        created_by: caller.id,
      }));

      const { error: branchError } = await supabaseAdmin
        .from('user_branches')
        .insert(branchInserts);

      if (branchError) {
        console.error('Error inserting branches:', branchError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});