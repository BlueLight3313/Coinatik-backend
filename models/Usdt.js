const mongoose = require("mongoose");

const UsdtSchema = mongoose.Schema({
  wallet: {
    type: Object,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("usdt", UsdtSchema);
