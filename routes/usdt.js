const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { check, validationResult } = require("express-validator");
const {
  getETHAddress,
  isValidEthereumAddress,
} = require("../controllers/ethereum");
const {
  sendUSDT,
  estimateUSDTGas,
  getUSDTBalance,
  getUsdtTransactions,
  buyUSDT,
  currentPrice,
  sellUSDT,
  getPrices,
  usdtNotification,
  sendUSDTWithFee,
  getUsdtNotifications,
} = require("../controllers/usdt");
const { isAuthenticatedUser } = require("../util/helper");
const { ObjectId } = mongoose.Types;

//@route    GET api/usdt/address
//@desc     Get USDT Address of user
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

//@route    POST api/usdt/isValidAddress
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

//@route    GET api/usdt/balance
//@desc     Get USDT balance of user
//@access   Private
router.get("/balance", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const balance = await getUSDTBalance({ userId });
    res.json({ balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    POST api/usdt/send
//@desc     Send USDT from the users wallet
//@access   Private
router.post("/send", isAuthenticatedUser, async (req, res) => {
  try {
    const { recipientAddress, amount, pin } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const transactionHash = await sendUSDTWithFee({
      userId,
      pin,
      recipientAddress,
      amount,
    });
    res.json({ transactionHash });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    POST api/usdt/estimateGas
//@desc     Estimate Gas fee for a USDT Transaction
//@access   Private
router.post("/estimateGas", isAuthenticatedUser, async (req, res) => {
  try {
    const { recipientAddress, amount } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const estimatedGas = await estimateUSDTGas({
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

//@route    GET api/usdt/transactions
//@desc     Get list of USDT Transactions for a user
//@access   Private
router.get("/transactions", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const transactions = await getUsdtTransactions({ userId });
    res.json({ transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    POST api/usdt/currentPrice
//@desc     Get current price of usdt
//@access   Private
router.post("/currentPrice",async (req, res) => {
  try {
    const { currency } = req.body;
    const price = await currentPrice({ currency });
    res.json({ price });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
});

//@route    GET api/usdt/getPrices
//@desc     get USDT prices of previous 7 days
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

//@route    GET api/usdt/buy
//@desc     Buy USDT
//@access   Private
router.post("/buy", isAuthenticatedUser, async (req, res) => {
  try {
    console.log(req.body);
    const { amount, currency, accountNumber, bankName, accountHolder } =
      req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const order = await buyUSDT({
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

//@route    GET api/usdt/sell
//@desc     Sell USDT
//@access   Private
router.post("/sell", isAuthenticatedUser, async (req, res) => {
  try {
    const { amount, accountNumber, bankName, accountHolder, pin, currency } =
      req.body;
    console.log(req.body);
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const order = await sellUSDT({
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

//@route    GET api/usdt/notifications
//@desc     Get list of all USDT Notifications
//@access   Private
router.get("/notifications", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const notifications = await getUsdtNotifications({
      userId,
    });
    res.json({ notifications });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

// //@route    GET api/usdt/notification
// //@desc     notification
// //@access   Private
// router.post("/notification", isAuthenticatedUser, async (req, res) => {
//   try {
//     const { from, to, value } = req.body;
//     const notification = await usdtNotification({
//       from,
//       to,
//       value,
//     });
//     res.json({ notification });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ errorMsg: "Server Error" });
//   }
// });

module.exports = router;
