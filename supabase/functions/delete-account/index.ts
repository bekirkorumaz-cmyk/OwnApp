import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey =
      Deno.env.get('SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      '';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Function environment variables are missing.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authHeader = request.headers.get('Authorization') || '';
    const requestBody = await request.json().catch(() => ({}));
    const accessTokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const accessToken = accessTokenFromHeader || requestBody.accessToken || '';

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Missing access token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
    });

    let userPayload: { id?: string } | null = null;
    let userErrorMessage = '';

    try {
      userPayload = await userResponse.json();
    } catch {
      userPayload = null;
    }

    if (!userResponse.ok) {
      userErrorMessage =
        (userPayload as { msg?: string; error_description?: string; error?: string } | null)?.msg ||
        (userPayload as { msg?: string; error_description?: string; error?: string } | null)?.error_description ||
        (userPayload as { msg?: string; error_description?: string; error?: string } | null)?.error ||
        'User could not be verified.';
    }

    if (!userResponse.ok || !userPayload?.id) {
      return new Response(JSON.stringify({ error: userErrorMessage || 'User could not be verified.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: deleteLogsError } = await adminClient
      .from('period_logs')
      .delete()
      .eq('user_id', userPayload.id);

    if (deleteLogsError) {
      return new Response(JSON.stringify({ error: deleteLogsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userPayload.id);

    if (deleteUserError) {
      return new Response(JSON.stringify({ error: deleteUserError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
