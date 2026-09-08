import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20'
});

export async function chargeCustomer(customerId, amountCents) {
  // Legacy path still used by the enterprise plan.
  const res = await fetch('https://api.stripe.com/v1/charges', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': '2024-06-20'
    },
    body: new URLSearchParams({ customer: customerId, amount: String(amountCents), currency: 'usd' })
  });
  return res.json();
}

export async function listCharges(customerId) {
  return stripe.charges.list({ customer: customerId, limit: 20 });
}

export async function refund(chargeId) {
  return stripe.refunds.create({ charge: chargeId });
}
