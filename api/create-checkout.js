// api/create-checkout.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productTitle, amount, quantity } = req.body;
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

    if (!PAYMONGO_SECRET_KEY) {
      return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY is missing in Vercel environment variables.' });
    }

    // Clean the amount string (removes commas like "1,450.00" -> "1450.00")
    const cleanAmount = typeof amount === 'string' ? amount.replace(/,/g, '') : amount;
    const parsedAmount = parseFloat(cleanAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: `Invalid amount received: ${amount}` });
    }

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(parsedAmount * 100), // Convert to centavos safely
                description: productTitle,
                name: productTitle,
                quantity: parseInt(quantity || 1)
              },
              
            ],
            payment_method_types: ['card', 'gcash', 'paymaya'],
            success_url: `${req.headers.origin || 'https://' + req.headers.host}?payment=success`,
            cancel_url: `${req.headers.origin || 'https://' + req.headers.host}?payment=cancelled`,
            description: `Order for ${productTitle}`
          }
        }
      })
    });

    const data = await response.json();

    if (data && data.data && data.data.attributes && data.data.attributes.checkout_url) {
      return res.status(200).json({ checkoutUrl: data.data.attributes.checkout_url });
    } else {
      console.error('PayMongo API Error Details:', JSON.stringify(data));
      const errorMsg = data.errors?.[0]?.detail || JSON.stringify(data.errors) || 'Failed to generate PayMongo checkout link';
      return res.status(400).json({ error: errorMsg });
    }
  } catch (err) {
    console.error('Server Exception:', err);
    return res.status(500).json({ error: err.message });
  }
};
