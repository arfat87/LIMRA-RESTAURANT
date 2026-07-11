import crypto from 'crypto';
import Razorpay from 'razorpay';

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'DL98BCefLpezCsb3bdj5f2MW';
const KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TBmsInWXVkKowt';
const INSFORGE_URL = process.env.VITE_INSFORGE_URL || 'https://vb9ucr22.us-east.insforge.app';
const API_KEY = process.env.API_KEY || 'ik_799af068e8f4fb05944d04497229fe7d';

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET
});

export default async function handler(req, res) {
  // Setup CORS Headers
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

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required signature verification fields' });
  }

  try {
    // 1. Verify payment signature locally using HMAC-SHA256
    const generatedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Signature mismatch. Verification failed.' });
    }

    // 2. Fetch order amount from Razorpay API to ensure exact amount alignment
    const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
    const amountInRupees = orderDetails.amount / 100;

    // 3. Log verified payment directly in InsForge database
    const sqlQuery = `
      INSERT INTO public.verified_payments (utr, amount, status, created_at)
      VALUES ($1, $2, 'success', now())
      ON CONFLICT (utr) 
      DO UPDATE SET status = 'success', amount = $2;
    `;

    const dbRes = await fetch(`${INSFORGE_URL}/api/database/advance/rawsql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        query: sqlQuery,
        params: [razorpay_payment_id, amountInRupees]
      })
    });

    if (!dbRes.ok) {
      const dbErrText = await dbRes.text();
      console.error('Database logging failed:', dbErrText);
      return res.status(500).json({ error: 'Failed to record payment verification on database.' });
    }

    return res.status(200).json({ success: true, message: 'Signature verified and payment logged successfully' });
  } catch (error) {
    console.error('Signature Verification Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
