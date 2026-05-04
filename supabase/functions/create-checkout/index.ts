import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'
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

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 503)

  try {
    const { ride_id } = (await req.json()) as { ride_id: string }

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
      .select('id, guest_id, pickup_location, destination, status, price_eur')
      .eq('id', ride_id)
      .single()

    if (rideError || !ride) return json({ error: 'Ride not found' }, 404)
    if (ride.guest_id !== user.id) return json({ error: 'Forbidden' }, 403)

    // Use the server-calculated price; fall back to on-the-fly calculation for
    // rides created before the price_eur column was added.
    const amountEur: number =
      ride.price_eur ??
      calculatePriceEur(ride.pickup_location, ride.destination) ??
      2

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
            description: `Fahrt-ID ${ride_id.slice(0, 8)}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/#/ride?payment=success`,
      cancel_url: `${origin}/#/ride`,
      metadata: { ride_id },
    })

    return json({ url: session.url, amount_eur: amountEur })
  } catch (err) {
    console.error('[create-checkout]', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
