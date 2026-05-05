import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calculatePriceEur } from '../_shared/pricing.ts'

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { ride_id } = (await req.json()) as { ride_id: string }
    if (!ride_id) return json({ error: 'Missing ride_id' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('id, driver_id, guest_id, pickup_location, destination')
      .eq('id', ride_id)
      .single()

    if (rideError || !ride) return json({ error: 'Ride not found' }, 404)
    if (user.id !== ride.driver_id && user.id !== ride.guest_id) {
      return json({ error: 'Forbidden' }, 403)
    }

    const price_eur = await calculatePriceEur(ride.pickup_location, ride.destination)
    if (price_eur === null) return json({ error: 'Route coordinates missing or invalid' }, 422)

    const { error: updateError } = await supabase
      .from('rides')
      .update({ price_eur })
      .eq('id', ride_id)

    if (updateError) {
      console.error('[calculate-price] update failed:', updateError)
      return json({ error: 'Failed to store price' }, 500)
    }

    console.log(`[calculate-price] ride=${ride_id} price_eur=${price_eur}`)
    return json({ ride_id, price_eur })
  } catch (err) {
    console.error('[calculate-price] unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
