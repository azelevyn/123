const mongoose = require('mongoose');

const EscrowSchema = new mongoose.Schema({
  escrowId: { type: String, unique: true, required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number, // fiat equivalent or USDT amount
  crypto: { type: String, default: 'USDT-TRC20' },
  status: { type: String, enum: ['pending','funded','released','refunded','disputed','cancelled'], default: 'pending' },
  coinpaymentsTxnId: String,
  depositAddress: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  logs: [{ ts: Date, by: String, action: String, note: String }]
});

module.exports = mongoose.model('Escrow', EscrowSchema);
