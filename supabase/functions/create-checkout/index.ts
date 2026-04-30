import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function parseCoord(s: string): [number, number] | null {
  const parts = s.split(',').map(Number)
  return parts.length === 2 && parts.every(n => !isNaN(n))
    ? [parts[0], parts[1]]
    : null
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503,
    })
  }

  try {
    const { ride_id } = (await req.json()) as { ride_id: string }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('id, guest_id, pickup_location, destination, status')
      .eq('id', ride_id)
      .single()

    if (rideError || !ride) {
      return new Response(JSON.stringify({ error: 'Ride not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (ride.guest_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const pickup = parseCoord(ride.pickup_location ?? '')
    const dest = parseCoord(ride.destination ?? '')
    if (!pickup || !dest) {
      return new Response(JSON.stringify({ error: 'Route coordinates missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422,
      })
    }

    const distanceKm = haversineKm(pickup[0], pickup[1], dest[0], dest[1])
    const amountEur = Math.max(distanceKm * 2, 2)
    const amountCents = Math.round(amountEur * 100)

    const stripe = new Stripe(stripeKey)
    const origin = req.headers.get('origin') ?? 'https://yourapp.com'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Rider — Fahrt in Konstanz',
            description: `${distanceKm.toFixed(1)} km · Fahrt-ID ${ride_id.slice(0, 8)}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/#/ride?payment=success`,
      cancel_url:  `${origin}/#/ride`,
      metadata: { ride_id },
    })

    return new Response(JSON.stringify({ url: session.url, amount_eur: amountEur }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('[create-checkout]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
