const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const {
  getBtcTransactions,
  getBtcAddress,
  getBtcBalance,
  sendBTC,
  estimateTransactionFee,
  getPrices,
  currentPrice,
  sellBTC,
  buyBTC,
  sendBTCWithFee,
  isValidBitcoinAddress,
  getBtcNotifications,
} = require("../controllers/bitcoin");
const { check, validationResult } = require("express-validator");
const { isAuthenticatedUser } = require("../util/helper");
const { ObjectId } = mongoose.Types;

//@route    GET api/btc/transactions
//@desc     Get all BTC Transactions of a User
//@access   Private
router.get("/transactions", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const transactions = await getBtcTransactions({ userId });
    res.json({ transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/btc/address
//@desc     Get BTC Address of user
//@access   Private
router.get("/address", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const address = await getBtcAddress({ userId });
    res.json({ address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/eth/isValidAddress
//@desc     Check if Address is valid
//@access   Private
router.post("/isValidAddress", isAuthenticatedUser, async (req, res) => {
  try {
    const { address } = req.body;
    const isValidAddress = await isValidBitcoinAddress(address);
    res.json({ isValidAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    GET api/btc/balance
//@desc     Get BTC Balance of user
//@access   Private
router.get("/balance", isAuthenticatedUser, async (req, res) => {
  try {
    const isAuthenticated = req.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({ errorMsg: "Unauthorized Access" });
    }
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const balance = await getBtcBalance({ userId });
    res.json({ balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/btc/send
//@desc     Send BTC from user wallet
//@access   Private
router.post(
  "/send",
  isAuthenticatedUser,
  [
    check("recipientAddress", "Receiver address is required").not().isEmpty(),
    check("amount", "Amount to Send is required").not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { recipientAddress, amount, pin } = req.body;
      const userIdStr = req.user._id;
      const userId = new ObjectId(userIdStr);
      const transaction = await sendBTCWithFee({
        userId,
        pin,
        recipientAddress,
        amount,
      });
      res.json(transaction);
    } catch (error) {
      console.error(error);
      res.status(500).json({ errorMsg: error.message });
    }
  }
);

//@route    GET api/btc/estimateGasFee
//@desc     Estimate fee of a transaction
//@access   Private
router.post(
  "/estimateGas",
  isAuthenticatedUser,
  [
    check("recipientAddress", "Receiver address is required").not().isEmpty(),
    check("amount", "Amount to Send is required").not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { recipientAddress, amount } = req.body;
      const userIdStr = req.user._id;
      const userId = new ObjectId(userIdStr);
      const estimatedGas = await estimateTransactionFee({
        userId,
        recipientAddress,
        amount,
      });
      res.json({ estimatedGas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ errorMsg: error.message });
    }
  }
);

//@route    POST api/btc/currentPrice
//@desc     Get current Price of BTC
//@access   Private
//add isAuthenticated later
router.post("/currentPrice",async (req, res) => {
  try {
    const { currency } = req.body;
    const price = await currentPrice({ currency });
    res.json({ price });
  } catch (error) {
    console.error(error)
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    POST api/btc/getPrices
//@desc     get bitcoin prices of previous 7 days
//@access   Private
router.post("/getPrices", isAuthenticatedUser, async (req, res) => {
  try {
    const { currency } = req.body;
    const dataset = await getPrices({ currency });
    res.json({ dataset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/btc/buy
//@desc     Buy BTC
//@access   Private
router.post("/buy", isAuthenticatedUser, async (req, res) => {
  try {
    const { amount, currency, accountNumber, bankName, accountHolder } =
      req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const order = await buyBTC({
      userId,
      amount,
      currency,
      bankName,
      accountNumber,
      accountHolder,
    });
    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/btc/sell
//@desc     Sell BTC
//@access   Private
router.post("/sell", isAuthenticatedUser, async (req, res) => {
  try {
    const { amount, accountNumber, bankName, accountHolder, pin, currency } =
      req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const order = await sellBTC({
      userId,
      amount,
      bankName,
      accountNumber,
      accountHolder,
      pin,
      currency,
    });
    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/btc/notifications
//@desc     Get list of all BTC Notifications
//@access   Private
router.get("/notifications", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const notifications = await getBtcNotifications({
      userId,
    });
    res.json({ notifications });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});


module.exports = router;
