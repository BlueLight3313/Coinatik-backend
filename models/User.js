const mongoose = require("mongoose");
const Bitcoin = require("./Bitcoin");
const Ethereum = require("./Ethereum");

const UserSchema = mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  referrerId: {
    type: String,
  },
  image: {
    type: String,
  },
  pin: {
    type: String,
    default: null,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: Number,
    default: null,
  },
  otpExpirationDate: {
    type: Date,
    default: null,
  },
  country: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  currencySymbol: {
    type: String,
    required: true,
  },
  referralCode: {
    type: String,
  },
  referrerPaid: {
    type: Boolean,
    default: false,
  },
  language: {
    type: String,
  },
  isAdmin: {
    type: Boolean,
  },
  pin_reset_token: {
    type: String,
    default: null,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  miner_history: [String],
  minerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Miner" }],
  rememberMeToken: {
    type: String,
    default: null, // Initially no remember-me token
  },
});

// Delete the wallets if the user was deleted
UserSchema.pre("remove", async function (next) {
  try {
    await Bitcoin.deleteMany({ userId: this._id });
    await Ethereum.deleteMany({ userId: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("user", UserSchema);
module.exports = User;
