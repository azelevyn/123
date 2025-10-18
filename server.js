require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { verifyIpn } = require('./helpers/coinpayments');
const Escrow = require('./models/Escrow');
const User = require('./models/User');
const Tx = require('./models/Transaction');

const app = express();
app.use(helmet());

// raw body capture for IPN verification
app.use((req,res,next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => data += chunk);
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

// also parse urlencoded (CoinPayments sends form-encoded)
app.use(bodyParser.urlencoded({ extended: false }));

// basic rate limiter
const limiter = rateLimit({ windowMs: 10*1000, max: 10 });
app.use(limiter);

mongoose.connect(process.env.MONGODB_URI);

// init bot (polling or webhook)
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// handle /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOneAndUpdate(
    { telegramId: chatId },
    { telegramId: chatId, username: msg.from.username, firstName: msg.from.first_name, lastName: msg.from.last_name },
    { upsert: true, new: true }
  );
  bot.sendMessage(chatId, `Hello ${msg.from.first_name}! Welcome to Escrow Bot.\nUse /menu to start.`);
});

// example create escrow flow (buyer initiates)
bot.onText(/\/create_escrow/, async (msg) => {
  const chatId = msg.chat.id;
  // for brevity: create escrow with fixed amount (real system ask details via steps)
  const escrowId = 'ESC' + Date.now();
  const escrow = new Escrow({ escrowId, buyer: (await User.findOne({telegramId:chatId}))._id, seller: null, amount: 10 });
  await escrow.save();

  // create deposit via CoinPayments
  const { createDeposit } = require('./helpers/coinpayments');
  try {
    const txn = await createDeposit({ amount: escrow.amount, currency1: 'USD', currency2: 'USDT', buyerEmail: msg.from.username + '@example.com', custom: escrowId });
    escrow.coinpaymentsTxnId = txn.txn_id;
    escrow.depositAddress = txn.received_address || txn.address || txn.result && txn.result.address;
    escrow.status = 'pending';
    escrow.logs.push({ ts: new Date(), by: 'system', action: 'deposit_created', note: JSON.stringify(txn) });
    await escrow.save();

    bot.sendMessage(chatId, `Escrow created: ${escrowId}\nDeposit address: ${escrow.depositAddress}\nAmount: ${escrow.amount} USDT.\nWaiting for deposit...`);
  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, 'Gagal buat transaksi deposit. Sila cuba lagi kemudian.');
  }
});

// IPN endpoint for CoinPayments
app.post('/ipn', async (req, res) => {
  // verify IPN
  if (!verifyIpn(req)) {
    res.status(403).send('Invalid IPN');
    return;
  }
  // CoinPayments posts form fields
  const body = req.body;
  const status = parseInt(body.status);
  const custom = body.custom; // escrowId
  const txnId = body.txn_id;

  const escrow = await Escrow.findOne({ escrowId: custom });
  if (!escrow) { res.send('No escrow'); return; }

  // status >=100 or status ==2 => complete
  if (status >= 100 || status === 2) {
    escrow.status = 'funded';
    escrow.coinpaymentsTxnId = txnId;
    escrow.logs.push({ ts: new Date(), by: 'ipn', action: 'funded', note: JSON.stringify(body) });
    await escrow.save();

    // notify buyer (if we stored buyer telegramId)
    const buyer = await User.findById(escrow.buyer);
    if (buyer && buyer.telegramId) {
      bot.sendMessage(buyer.telegramId, `Deposit detected for escrow ${escrow.escrowId}. Status: funded.`);
    }
  } else if (status < 0) {
    escrow.status = 'cancelled';
    escrow.logs.push({ ts: new Date(), by: 'ipn', action: 'failed', note: JSON.stringify(body) });
    await escrow.save();
  } else {
    // pending confirmations
    escrow.logs.push({ ts: new Date(), by: 'ipn', action: `status_${status}`, note: JSON.stringify(body) });
    await escrow.save();
  }

  res.send('OK');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on', port));
