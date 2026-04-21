import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Role = 'driver' | 'guest'

type RequestBody = {
  role: Role
  recordId: string
}

type MatchResult =
  | { matched: true; ride_id: string }
  | { matched: false }

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as RequestBody
    const { role, recordId } = body

    if (!role || !recordId) {
      return new Response(JSON.stringify({ error: 'Missing role or recordId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log(`[match-ride] Called: role=${role}, recordId=${recordId}`)

    // Service role key bypasses RLS — required for cross-user writes
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Delegate to atomic PostgreSQL function to avoid race conditions.
    // The function uses SELECT ... FOR UPDATE SKIP LOCKED so concurrent
    // edge function invocations can never claim the same match partner.
    const { data, error } = await supabase.rpc('atomic_match_ride', {
      p_role: role,
      p_record_id: recordId,
    })

    if (error) {
      console.error('[match-ride] RPC error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const result = data as MatchResult
    console.log('[match-ride] Result:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('[match-ride] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
