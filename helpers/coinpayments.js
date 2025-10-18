const Coinpayments = require('coinpayments');
const client = new Coinpayments({
  key: process.env.COINPAYMENTS_KEY,
  secret: process.env.COINPAYMENTS_SECRET
});

// create a deposit (create_transaction)
async function createDeposit({amount, currency1='USD', currency2='USDT', buyerEmail, custom}) {
  // currency2: coin to receive, e.g. USDT.USDTTRC? CoinPayments uses codes — test carefully
  return client.createTransaction({
    currency1: currency1,
    currency2: currency2,
    amount: amount,
    buyer_email: buyerEmail,
    custom: custom // pass escrowId
  });
}

// validate IPN HMAC header & secret
function verifyIpn(req) {
  // CoinPayments sends HMAC header and raw body; if using express.json() you must keep raw body
  const crypto = require('crypto');
  const hmac = req.headers['hmac'] || req.headers['HMAC'];
  const rawBody = req.rawBody; // set in middleware
  const computed = crypto.createHmac('sha512', process.env.COINPAYMENTS_SECRET).update(rawBody).digest('hex');
  return computed === hmac;
}

module.exports = { client, createDeposit, verifyIpn };
