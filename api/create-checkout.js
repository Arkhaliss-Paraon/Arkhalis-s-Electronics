// api/create-checkout.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productTitle, amount, buyerId, sellerId, productId, quantity } = req.body;

    // Pulls the secret key securely from Vercel Environment Variables
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

    if (!PAYMONGO_SECRET_KEY) {
      return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY is not configured on Vercel' });
    }

    const options = {
      method: 'POST',
      headers: {
        accept: 'json',
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(parseFloat(amount) * 100), // Convert to centavos
                description: productTitle,
                name: productTitle,
                quantity: parseInt(quantity || 1)
              }
            ],
            payment_method_types: ['gcash', 'paymaya', 'card'],
            success_url: `${req.headers.origin || 'https://' + req.headers.host}?payment=success`,
            cancel_url: `${req.headers.origin || 'https://' + req.headers.host}?payment=cancelled`,
            description: `Order for ${productTitle}`
          }
        }
      })
    };

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', options);
    const data = await response.json();

    if (data && data.data && data.data.attributes && data.data.attributes.checkout_url) {
      return res.status(200).json({ checkoutUrl: data.data.attributes.checkout_url });
    } else {
      console.error('PayMongo Error:', data);
      return res.status(400).json({ error: data.errors?.[0]?.detail || 'Failed to generate PayMongo checkout link' });
    }
  } catch (err) {
    console.error('Checkout Server Exception:', err);
    return res.status(500).json({ error: err.message });
  }
}
