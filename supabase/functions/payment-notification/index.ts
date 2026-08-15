import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature, x-flw-signature',
};

// Paystack webhook signature verification
async function verifyPaystackSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // ─── HANDLE PAYSTACK WEBHOOK ──────────────────────────────
    const paystackSig = req.headers.get('x-paystack-signature');
    if (paystackSig && PAYSTACK_SECRET) {
      const isValid = await verifyPaystackSignature(rawBody, paystackSig, PAYSTACK_SECRET);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid Paystack signature' }), { status: 401, headers: corsHeaders });
      }

      if (payload.event === 'charge.success') {
        const { reference, amount, metadata, customer } = payload.data;
        const userId = metadata?.user_id;
        const customerEmail = customer?.email || 'N/A';
        console.log(`Paystack payment received: ref=${reference}, amount=${amount}, user=${userId}, email=${customerEmail}`);

        if (!userId) {
          console.error('Paystack webhook: missing user_id in metadata');
          return new Response(JSON.stringify({ error: 'Missing user_id in metadata' }), { status: 400, headers: corsHeaders });
        }

        const amountNGN = amount / 100; // Paystack sends in kobo

        // 1. Record the payment
        await adminClient.from('manual_payments').insert({
          user_id: userId,
          amount: amountNGN,
          payment_method: 'paystack',
          reference,
          status: 'approved',
          approved_at: new Date().toISOString(),
        });

        // 2. Activate subscription
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1-year subscription

        await adminClient.from('subscriptions').upsert({
          user_id: userId,
          plan: 'premium',
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiryDate.toISOString(),
        }, { onConflict: 'user_id' });

        // 3. Update profile to has_paid = true
        await adminClient.from('profiles').update({
          has_paid: true,
          subscription_plan: 'premium',
        }).eq('id', userId);

        // 4. Log activity
        await adminClient.from('activity_logs').insert({
          user_id: userId,
          action: 'payment_verified',
          metadata: { amount: amountNGN, reference, method: 'paystack_webhook' },
        });

        console.log(`Paystack: Activated subscription for user ${userId}, amount ₦${amountNGN}`);
        return new Response(JSON.stringify({ success: true, user_id: userId }), { status: 200, headers: corsHeaders });
      }

      // Acknowledge all other events
      return new Response(JSON.stringify({ received: true, event: payload.event }), { status: 200, headers: corsHeaders });
    }

    // ─── HANDLE FLUTTERWAVE WEBHOOK ───────────────────────────
    const flwSig = req.headers.get('x-flw-signature');
    const FLW_SECRET_HASH = Deno.env.get('FLW_SECRET_HASH');
    if (flwSig && FLW_SECRET_HASH) {
      if (flwSig !== FLW_SECRET_HASH) {
        return new Response(JSON.stringify({ error: 'Invalid Flutterwave signature' }), { status: 401, headers: corsHeaders });
      }

      if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
        const { tx_ref, amount, meta } = payload.data;
        const userId = meta?.user_id || tx_ref?.split('-')[1];

        if (!userId) {
          console.error('Flutterwave webhook: missing user_id');
          return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: corsHeaders });
        }

        await adminClient.from('manual_payments').insert({
          user_id: userId,
          amount,
          payment_method: 'flutterwave',
          reference: tx_ref,
          status: 'approved',
          approved_at: new Date().toISOString(),
        });

        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        await adminClient.from('subscriptions').upsert({
          user_id: userId,
          plan: 'premium',
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiryDate.toISOString(),
        }, { onConflict: 'user_id' });

        await adminClient.from('profiles').update({
          has_paid: true,
          subscription_plan: 'premium',
        }).eq('id', userId);

        await adminClient.from('activity_logs').insert({
          user_id: userId,
          action: 'payment_verified',
          metadata: { amount, reference: tx_ref, method: 'flutterwave_webhook' },
        });

        console.log(`Flutterwave: Activated subscription for user ${userId}, amount ₦${amount}`);
        return new Response(JSON.stringify({ success: true, user_id: userId }), { status: 200, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
    }

    // ─── HANDLE LEGACY SUPABASE DB TRIGGER (manual payments) ─
    if (payload.type === 'INSERT' && payload.table === 'manual_payments') {
      const { amount, user_id } = payload.record;
      console.log(`Manual payment alert: ₦${amount} from ${user_id}`);
      return new Response(JSON.stringify({ message: 'Manual payment notification received' }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ message: 'Ignored' }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error('Payment webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
