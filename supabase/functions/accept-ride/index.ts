import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type RpcResult =
  | { accepted: true; ride_id: string; price_eur: number | null }
  | { accepted: false; reason: string }

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { requestId } = (await req.json()) as { requestId: string }
    if (!requestId) return json({ error: 'Missing requestId' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    console.log(`[accept-ride] driver=${user.id}, request=${requestId}`)

    const { data, error } = await supabase.rpc('accept_ride', {
      p_driver_id: user.id,
      p_request_id: requestId,
    })

    if (error) {
      console.error('[accept-ride] RPC error:', error)
      return json({ error: error.message }, 500)
    }

    const result = data as RpcResult
    console.log('[accept-ride] result:', result)
    return json(result)
  } catch (err) {
    console.error('[accept-ride] unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
