import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      .select('role:roles(name), org_id')
      .eq('id', caller.id)
      .single();

    const callerRole = (callerUser as any)?.role?.name;
    if (!['super_admin', 'client_admin', 'manager'].includes(callerRole)) {
      throw new Error('Unauthorized: Only admins can reset passwords');
    }

    const { user_id, new_password } = await req.json();

    if (!user_id || !new_password) {
      throw new Error('Missing required fields: user_id and new_password');
    }

    if (new_password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (user_id === caller.id) {
      throw new Error('You cannot reset your own password through this action');
    }

    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id, org_id, full_name')
      .eq('id', user_id)
      .single();

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    if (callerRole !== 'super_admin' && targetUser.org_id !== (callerUser as any)?.org_id) {
      throw new Error('You can only reset passwords for users in your organization');
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({
        must_change_password: true,
        password_changed_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (dbError) {
      console.error('Error updating must_change_password flag:', dbError);
    }

    await supabaseAdmin.from('password_audit_log').insert({
      user_id: user_id,
      org_id: targetUser.org_id,
      action: 'password_reset',
      performed_by: caller.id,
      metadata: { reset_by_admin: caller.id, target_user: targetUser.full_name },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password has been reset. User will be required to change it on next login.',
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
