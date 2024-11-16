const mongoose = require("mongoose");

const SwapSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  swapId: {
    type: String,
    required: true,
  },
  amountSent: {
    type: Number,
    required: true,
  },
  coinSent: {
    type: String,
    required: true,
  },
  amountToRecieve: {
    type: Number,
    required: true,
  },
  coinRecieve: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "waiting",
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("swap", SwapSchema);
