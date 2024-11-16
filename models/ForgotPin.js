const mongoose = require("mongoose");

const ForgotPinSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  otp: {
    type: String,
    required: true,
  },
  otpExpirationDate: {
    type: Date,
    default: null,
  },
});

const ForgotPin = mongoose.model("ForgotPin", ForgotPinSchema);
module.exports = ForgotPin;
