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
    const { pickupLocation, destination, passengerCount } = (await req.json()) as {
      pickupLocation: string
      destination: string
      passengerCount?: number
    }

    if (!pickupLocation || !destination) {
      return json({ error: 'pickupLocation and destination required' }, 400)
    }
    if (pickupLocation.length > 255 || destination.length > 255) {
      return json({ error: 'Location strings too long' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const passenger_count = Math.max(1, Math.floor(Number(passengerCount ?? 1)))

    const { data: rickshawType, error: typeError } = await supabase
      .from('rickshaw_types')
      .select('id, price_multiplier')
      .eq('is_active', true)
      .gte('capacity', passenger_count)
      .order('capacity', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (typeError) {
      console.error('[create-request] rickshaw type lookup failed:', typeError)
      return json({ error: 'Failed to resolve rickshaw type' }, 500)
    }
    if (!rickshawType) return json({ error: 'No rickshaw type can carry this passenger count' }, 422)

    // Price is calculated before insert so drivers immediately see it in the list.
    const basePrice = await calculatePriceEur(pickupLocation, destination)
    const price_eur = basePrice === null
      ? null
      : Number((basePrice * Number(rickshawType.price_multiplier)).toFixed(2))
    const pickup_code = String(Math.floor(Math.random() * 10000)).padStart(4, '0')

    const { data, error } = await supabase
      .from('guest_requests')
      .insert({
        guest_id: user.id,
        status: 'waiting',
        pickup_location: pickupLocation,
        destination,
        price_eur,
        passenger_count,
        rickshaw_type_id: rickshawType.id,
        rickshaw_price_multiplier: rickshawType.price_multiplier,
        pickup_code,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[create-request] insert failed:', error)
      return json({ error: error.message }, 400)
    }

    console.log(`[create-request] guest=${user.id} id=${data.id} passengers=${passenger_count} price_eur=${price_eur}`)
    return json({ id: data.id, price_eur })
  } catch (err) {
    console.error('[create-request] unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
