// models/product.js

const mongoose = require('mongoose');

const TransctionSchema = new mongoose.Schema({
  miner: { type: mongoose.Schema.Types.ObjectId, ref: 'Miner' },
  amount: Number,
  date: { type: Date, default: Date.now }, 
});



const Transction = mongoose.model('Transctions', TransctionSchema);


module.exports = Transction;
