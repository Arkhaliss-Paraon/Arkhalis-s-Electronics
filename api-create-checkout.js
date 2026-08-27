const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase Server Credentials Missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const event = req.body;

  try {
    if (event.data && event.data.attributes.type === 'checkout_session.payment.paid') {
      const sessionData = event.data.attributes.data.attributes;
      const metadata = sessionData.metadata;
      const checkoutSessionId = event.data.attributes.data.id;

      if (metadata && metadata.buyer_id && metadata.product_id) {
        // Insert paid order record into Supabase
        const { data, error } = await supabase.from('orders').insert([
          {
            buyer_id: metadata.buyer_id,
            seller_id: metadata.seller_id,
            product_id: metadata.product_id,
            quantity: parseInt(metadata.quantity),
            total_amount: parseFloat(metadata.total_amount),
            status: 'paid',
            paymongo_checkout_id: checkoutSessionId
          }
        ]);

        if (error) {
          console.error('Supabase DB Insert Error:', error);
          return res.status(500).json({ error: error.message });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook Handling Error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};