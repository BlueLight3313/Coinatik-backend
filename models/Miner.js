const mongoose = require('mongoose');

// Define the Miner schema
const MinerSchema = new mongoose.Schema({
  minerName: {
    type: String,
    required: true,
  },
  miningPower: {
    type: Number,
  },
  miningprofit : {
    type: String,
    required: true,
  },
  miningcoin : {
    type: String,
    default:"BTC"
  },
  minduration : {
    type: String,
    required: true,
  },
  miningprob : {
    type: String,
    required: true,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  totalmined : {
    type: Number,
    required: true,
  },
  cputemp : {
    type: String,
    required: true,
  },
  perhourearn : {
  type : String
  },
  totalrevenu : {
    type: Number,
    default: 0,
  },
  miner_progress: Number,
  miner_history: [{
    coinMined: { type: String },
    expirationDate: { type: Date },
    totalRevenueMined: { type: Number },
  }],
  graphdata : {
    type : [String],
  },
  isRented: {
    type: Boolean,
    default: false,
  },
  rentalStartTime: {
    type: Date,
    default: null
  },
  rentalRatePerHour: {
    type: Number,
    required: true,
  },
  rentalDuration:{
    type:Number,
  },
  status : {
    type : String,
    default : "resting",
  },
  // Reference to the User who owns or is associated with the miner
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});
MinerSchema.methods.rentMiner = function (duration) {
  if (!this.isRented) {
    this.isRented = true;
    this.rentalStartTime = new Date();
    console.log(this.rentalStartTime)
    this.rentalDuration = duration
    return true; // Successfully rented
  }
  return false; // Miner is already rented
};

// Create the model
const Miner = mongoose.model('Miner', MinerSchema);

module.exports = Miner;
