const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { check, validationResult } = require("express-validator");
const {
  getETHAddress,
  getETHBalance,
  sendETH,
  getETHTransactions,
  currentPrice,
  getPrices,
  estimateETHGas,
  buyETH,
  sellETH,
  sendETHWithFee,
  isValidEthereumAddress,
  getEthNotifications,
} = require("../controllers/ethereum");
const { isAuthenticatedUser } = require("../util/helper");
const { ObjectId } = mongoose.Types;

//@route    GET api/eth/address
//@desc     Get ETH Address of user
//@access   Private
router.get("/address", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const address = await getETHAddress({ userId });
    res.json({ address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    POST api/eth/isValidAddress
//@desc     Check if address is valid
//@access   Private
router.post("/isValidAddress", isAuthenticatedUser, async (req, res) => {
  try {
    const { address } = req.body;
    const isValidAddress = isValidEthereumAddress(address);
    res.json({ isValidAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    GET api/eth/balance
//@desc     Get ETH balance of user
//@access   Private
router.get("/balance", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const balance = await getETHBalance({ userId });
    res.json({ balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    POST api/eth/sendEth
//@desc     Send ETH from a user wallet
//@access   Private
router.post("/send", isAuthenticatedUser, async (req, res) => {
  try {
    const { recipientAddress, amount, pin } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const transactionHash = await sendETHWithFee({
      userId,
      recipientAddress,
      amount,
      pin,
    });
    res.json({ transactionHash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    POST api/eth/estimateGas
//@desc     Estimate Gas fee for a ETH Transaction
//@access   Private
router.post("/estimateGas", isAuthenticatedUser, async (req, res) => {
  try {
    const { recipientAddress, amount } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const estimatedGas = await estimateETHGas({
      userId,
      recipientAddress,
      amount,
    });
    res.json({ estimatedGas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    GET api/eth/transactions
//@desc     Send ETH from a user wallet
//@access   Private
router.get("/transactions", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const transactions = await getETHTransactions({ userId });
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/eth/transactions
//@desc     Get current Pirce of Ether
//@access   Private
router.post("/currentPrice", async (req, res) => {
  try {
    const { currency } = req.body;
    const price = await currentPrice({ currency });
    res.json({ price });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    GET api/eth/getPrices
//@desc     get ether prices of previous 7 days
//@access   Private
router.post("/getPrices", async (req, res) => {
  try {
    const { currency } = req.body;
    const dataset = await getPrices({ currency });
    res.json({ dataset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/eth/buy
//@desc     Buy ETH
//@access   Private
router.post("/buy", isAuthenticatedUser, async (req, res) => {
  try {
    const { amount, currency, accountNumber, bankName, accountHolder } =
      req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const order = await buyETH({
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
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    GET api/eth/sell
//@desc     Sell ETH
//@access   Private
router.post("/sell", isAuthenticatedUser, async (req, res) => {
  try {
    const { amount, accountNumber, bankName, accountHolder, pin, currency } =
      req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const order = await sellETH({
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
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    GET api/eth/notifications
//@desc     Get list of all ETH Notifications
//@access   Private
router.get("/notifications", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const notifications = await getEthNotifications({
      userId,
    });
    res.json({ notifications });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

module.exports = router;
