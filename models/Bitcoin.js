const mongoose = require("mongoose");

const BitcoinSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  walletId: {
    type: String,
    required: true,
  },
  walletAddress:{
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  passphrase: {
    type: String,
    required: true,
  },
  coin: {
    type: String,
    required: true,
  },
  userKeychainPrivateKey: {
    type: String,
    required: true,
  },
  userKeychainPublicKey: {
    type: String,
    required: true,
  },
  backupKeychainPublicKey: {
    type: String,
    required: true,
  },
  bitgoKeychainPublicKey: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("bitcoin", BitcoinSchema);
