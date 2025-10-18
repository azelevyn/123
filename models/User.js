const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  createdAt: { type: Date, default: Date.now },
  isBanned: { type: Boolean, default: false },
  balance: { type: Number, default: 0 }, // tracked in platform units
  meta: {} // for KYC etc
});

module.exports = mongoose.model('User', UserSchema);
