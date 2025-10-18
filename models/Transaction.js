const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const TxSchema = new Schema({
  type: String, // deposit, release, refund
  escrow: { type: Schema.Types.ObjectId, ref: 'Escrow' },
  amount: Number,
  crypto: String,
  coinpaymentsData: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
  performedBy: String // admin username or system
});
module.exports = mongoose.model('Transaction', TxSchema);
