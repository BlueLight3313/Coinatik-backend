const { BitGoAPI } = require("@bitgo/sdk-api");
const { Btc, Tbtc } = require("@bitgo/sdk-coin-btc");
const Bitcoin = require("../models/Bitcoin");
const settings = require("../config/settings.json");
const Enviroment = settings.env;
const accessToken = settings[Enviroment].BITGO_ACCESS_TOKEN;
const enterprise = settings[Enviroment].BITGO_ENTERPRISE_KEY;
const bitgo_env = settings[Enviroment].BITGO_ENV;
const admin_btc_address = settings[Enviroment].BTC_ADDRESS;
const btc_fee = settings[Enviroment].BTC_FEE;
const Axios = require("axios");
const { daysOfWeek } = require("../util/helper");
const User = require("../models/User");
const coinmarketcapApi = settings[Enviroment].COINMARKETCAP_API_KEY;
const referralPercentage = settings[Enviroment].REFERRAL_PERCENTAGE;
const referralActive = settings[Enviroment].REFERRAL_ACTIVE;
const bcrypt = require("bcryptjs");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { ObjectId } = mongoose.Types;
const url = "http://localhost:5000/api/btc/webhook/"; 
const bitgo = new BitGoAPI({
  accessToken,
  env: bitgo_env,
});

let coin = "";
const registerBTC = () => {
  if (bitgo_env === "test") {
    bitgo.register("tbtc", Tbtc.createInstance);
    coin = "tbtc";
  } else {
    bitgo.register("btc", Btc.createInstance);
    coin = "btc";
  }
};
registerBTC();

bitgo.authenticateWithAccessToken({ accessToken });

// Generate a BTC Wallet
const generateBtcWallet = async ({ name, passphrase, userId }) => {
  try {
    const resp = await bitgo
      .coin(coin)
      .wallets()
      .generateWallet({
        label: `${name} Wallet`,
        passphrase,
        enterprise,
        m: 1,
      });
    if (!resp) {
      throw new Error("Failed to generate wallet.");
    }
    const wallet = resp.wallet;
    const walletId = wallet._wallet.id;
    const label = wallet._wallet.label;
    const walletCoin = wallet._wallet.coin;
    const walletAddress = wallet._wallet.receiveAddress.address;
    const userKeychainPrivateKey = resp.userKeychain.prv;
    const userKeychainPublicKey = resp.userKeychain.pub;
    const backupKeychainPublicKey = resp.backupKeychain.pub;
    const bitgoKeychainPublicKey = resp.bitgoKeychain.pub;
    const newbtcWallet = new Bitcoin({
      userId,
      walletId,
      walletAddress,
      label,
      passphrase,
      coin: walletCoin,
      userKeychainPrivateKey,
      userKeychainPublicKey,
      backupKeychainPublicKey,
      bitgoKeychainPublicKey,
    });
    await newbtcWallet.save();
    return wallet;
  } catch (error) {
    throw error;
  }
};

// Get BTC Address of User
const getBtcAddress = async ({ userId }) => {
  try {
    const bitcoinWallet = await Bitcoin.findOne({ userId });
    if (!bitcoinWallet) {
      return '';
    }
    const walletAddress = bitcoinWallet.walletAddress;

    return walletAddress;
  } catch (error) {
    throw error;
  }
};

// Get BTC Balance of User
const getBtcBalance = async ({ userId }) => {
  try {
    const bitcoinWallet = await Bitcoin.findOne({ userId });
    if (!bitcoinWallet) {
      return '';
    }
    const walletId = bitcoinWallet.walletId;
    const wallet = await bitgo.coin(coin).wallets().get({ id: walletId });
    const balance = wallet.balanceString();
    const balanceInBTc = balance / 1e8;

    return balanceInBTc;
  } catch (error) {
    throw error;
  }
};

// Get BTC Transactions of a User
const getBtcTransactions = async ({ userId }) => {
  try {
    const bitcoinWallet = await Bitcoin.findOne({ userId });
    if (!bitcoinWallet) {
      return '';
    }
    const walletId = bitcoinWallet.walletId;
    const walletAddress = bitcoinWallet.walletAddress;
    const wallet = await bitgo.coin(coin).wallets().get({ id: walletId });
    const raw_transactions = await wallet.transfers();
    const transfers = raw_transactions.transfers || [];
    const transactions = transfers.map((transfer) => {
      let sender = transfer.entries.find((entry) => entry.value < 0);
      let senderAddress = sender.address;
      let receiver = transfer.entries.find((entry) => entry.value > 0);
      let receiverAddress = receiver.address;
      let type = transfer.type;
      let date = transfer.date;
      let satoshis = transfer.value;
      if (type === "send") {
        satoshis = satoshis * -1;
        senderAddress = walletAddress;
      } else if (type === "receive") {
        receiverAddress = walletAddress;
      }
      const btcAmount = satoshis / 1e8;
      let transactionHash = transfer.txid;
      return {
        type,
        sender: senderAddress,
        receiver: receiverAddress,
        amount: btcAmount,
        transactionHash,
        date,
      };
    });
    if (referralActive)
      payReferrerBTConReceive({
        userId,
        transactions,
      });
    return transactions;
  } catch (error) {
    throw error;
  }
};

const payReferrerBTConReceive = async ({ userId, transactions }) => {
  const user = await User.findById(userId);
  if (!user) return;
  const referrerPaid = user.referrerPaid;
  if (referrerPaid) return;

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    if (transaction.type === "receive") {
      const amount = transaction.amount;
      const sendOnReceive = true;
      await payReferrerBTC({ userId, amount, sendOnReceive });
      break;
    }
  }
};

// Estimate Gas fee for transaction
const estimateTransactionFee = async ({ userId, recipientAddress, amount }) => {
  try {
    const bitcoinWallet = await Bitcoin.findOne({ userId });
    if (!bitcoinWallet) {
      return '';
    }
    const walletId = bitcoinWallet.walletId;
    const RECIPIENT_ADDRESS = recipientAddress;
    const SATOSHI_AMOUNT_TO_SEND = amount * 1e8;
    console.log(SATOSHI_AMOUNT_TO_SEND);
    const buildParams = {
      recipients: [
        { amount: SATOSHI_AMOUNT_TO_SEND, address: RECIPIENT_ADDRESS },
      ],
    };
    const wallet = await bitgo.coin(coin).wallets().get({ id: walletId });
    console.log(wallet);
    const result = await wallet.prebuildTransaction(buildParams);
    const satoshiFee = result.feeInfo.fee;
    const transactionfee = satoshiFee / 1e8;
    return transactionfee;
  } catch (error) {
    throw error;
  }
};

// Send BTC from a User wallet
const sendBTC = async ({
  userId,
  pin,
  recipientAddress,
  amount,
  sendOnReceive,
}) => {
  try {
    const bitcoinWallet = await Bitcoin.findOne({ userId });
    if (!bitcoinWallet) {
      return '';
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    if (!sendOnReceive) {
      if (!user.pin) {
        throw new Error("Pin is not added");
      }
      const isMatch = await bcrypt.compare(pin, user.pin);
      if (!isMatch) {
        throw new Error("Pin is not correct");
      }
    }

    const walletId = bitcoinWallet.walletId;
    const RECIPIENT_ADDRESS = recipientAddress;
    const SATOSHI_AMOUNT_TO_SEND = amount * 1e8;

    const userKeychainPrivateKey = bitcoinWallet.userKeychainPrivateKey;
    const userKeychainPublicKey = bitcoinWallet.userKeychainPublicKey;
    const backupKeychainPublicKey = bitcoinWallet.backupKeychainPublicKey;
    const bitgoKeychainPublicKey = bitcoinWallet.bitgoKeychainPublicKey;

    const buildParams = {
      recipients: [
        { amount: SATOSHI_AMOUNT_TO_SEND, address: RECIPIENT_ADDRESS },
      ],
    };
    const wallet = await bitgo.coin(coin).wallets().get({ id: walletId });

    const result = await wallet.prebuildTransaction(buildParams);

    const transaction = await bitgo.coin(coin).signTransaction({
      txPrebuild: result,
      prv: userKeychainPrivateKey,
      pubs: [
        userKeychainPublicKey,
        backupKeychainPublicKey,
        bitgoKeychainPublicKey,
      ],
    });

    const transactionHex = transaction.txHex;
    let params = {
      txHex: transactionHex,
    };
    const submittedTransaction = await wallet.submitTransaction(params);
    return result;
  } catch (error) {
    throw error;
  }
};

const sendBTCWithFee = async ({
  userId,
  pin,
  recipientAddress,
  amount,
  sendOnReceive,
}) => {
  try {
    await sendBTC({
      userId,
      pin,
      recipientAddress: admin_btc_address,
      amount: btc_fee,
      sendOnReceive,
    });

    const transaction = await sendBTC({
      userId,
      pin,
      recipientAddress,
      amount,
      sendOnReceive,
    });

    return transaction;
  } catch (error) {
    throw error;
  }
};

const currentPrice = async ({ currency }) => {
  try {
    const response = await Axios.get(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": coinmarketcapApi,
        },
        params: {
          symbol: "BTC",
          convert: currency,
        },
      }
    );
    const price = response.data.data.BTC.quote[currency].price;
    return parseInt(price);
  } catch (error) {
    throw error;
  }
};

const buyBTC = async ({
  userId,
  amount,
  currency,
  bankName,
  accountNumber,
  accountHolder,
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Could not find User wallet for USDT");
    }
    const coin = "BTC";
    const type = "buy";
    const pricePerUSDT = await currentPrice({ currency });
    const totalPriceFloat = amount / pricePerUSDT;
    const totalPrice = parseFloat(totalPriceFloat);
    const orderObj = {
      userId,
      type,
      currency,
      bankName,
      amountSent: amount,
      amountToRecieve: totalPrice,
      accountNumber,
      accountHolder,
      coin,
    };
    let order = new Order(orderObj);
    order = await order.save();
    return order;
  } catch (error) {
    throw error;
  }
};

const sellBTC = async ({
  userId,
  pin,
  amount,
  bankName,
  accountNumber,
  accountHolder,
  currency,
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Could not find User wallet for USDT");
    }
    const admin = await User.findOne({ isAdmin: true });
    if (!admin) {
      throw new Error("Could not find Recipient Wallet");
    }
    const adminId = admin._id;
    const adminWallet = await Bitcoin.findOne({ userId: adminId });
    if (!adminWallet) {
      throw new Error("Could not find USDT wallet for recipient");
    }
    const recipientAddress = adminWallet.walletAddress;
    const transactionHash = await sendBTC({
      userId,
      recipientAddress,
      amount,
      pin,
    });
    const coin = "BTC";
    const type = "sell";
    const pricePerUSDT = await currentPrice({ currency });
    const totalPriceFloat = amount * pricePerUSDT;
    const totalPrice = parseFloat(totalPriceFloat).toFixed(7);
    const orderObj = {
      userId,
      type,
      bankName,
      amountSent: amount,
      amountToRecieve: totalPrice,
      accountNumber,
      accountHolder,
      coin,
      currency,
    };
    let order = new Order(orderObj);
    order = await order.save();
    order.transactionHash = transactionHash;
    return order;
  } catch (error) {
    throw error;
  }
};

const getPrices = async ({ currency }) => {
  try {
    const response = await Axios.get(
      `https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/historical`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": coinmarketcapApi,
        },
        params: {
          symbol: "BTC",
          count: 7,
          interval: "1d",
          convert: currency,
        },
      }
    );
    console.log("asdf,", response.data.data);
    const quotes = response.data.data.BTC[0].quotes;
    let labels = [];
    let prices = [];
    quotes.forEach((item) => {
      const timestamp = item.timestamp;
      const priceFloat = item.quote[currency].price;
      const price = parseInt(priceFloat);
      const date = new Date(timestamp);
      const dayOfWeek = daysOfWeek[date.getDay()];
      labels.push(dayOfWeek);
      prices.push(price);
    });
    let priceYesterday = 0;
    if (prices.length > 0) {
      priceYesterday = prices[prices.length - 1];
    }
    let priceNow = await currentPrice({ currency });
    let currencyDiff = priceNow - priceYesterday;

    // Calculate the difference in percentage
    const priceDifferenceInPercentage = (
      (currencyDiff / priceYesterday) *
      100
    ).toFixed(2);

    // Determine the sign for the percentage difference
    const sign = currencyDiff >= 0 ? "+" : "";
    const percentageDiff = `${sign}${priceDifferenceInPercentage}%`;
    currencyDiff = parseInt(currencyDiff);
    return { labels, prices, currencyDiff, percentageDiff, priceNow };
  } catch (error) {
    console.log("getBTCPrices error: ", error.message);
    throw error;
  }
};

const payReferrerBTC = async ({ userId, amount, pin }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Could not find User");
    }
    // Check if the user used referrerId on Signup and if he was paid previously
    const referrerId = user.referrerId || null;
    const referrerPaid = user.referrerPaid;
    if (referrerPaid) return;
    const referrer = await User.findOne({ referralCode: referrerId });
    if (!referrer) return;
    const referrerUserId = new ObjectId(referrer._id);
    // Calculate amount to send
    const amountToSend = (referralPercentage / 100) * amount;
    // Check if there is adminWallet and if it has sufficent balance
    const admin = await User.findOne({ isAdmin: true });
    if (!admin) {
      throw new Error("Could not find Admin");
    }
    const adminId = admin._id;
    const balance = await getBtcBalance({ userId: adminId });
    if (balance < amountToSend) return;
    // Get Admin and Referrer Wallet
    const adminWallet = await Bitcoin.findOne({ userId: adminId });
    if (!adminWallet) {
      throw new Error("Could not find BTC wallet for Admin");
    }
    const referrerWallet = await Bitcoin.findOne({ userId: referrerUserId });
    if (!referrerWallet) {
      throw new Error("Could not find BTC wallet for recipient");
    }
    const recipientAddress = referrerWallet.walletAddress;
    // Send Referrer the amount and change status of refferer
    await sendBTC({
      userId: adminId,
      recipientAddress,
      amount: amountToSend,
      pin,
      sendOnReceive,
    });
    let userFields = {};
    userFields.referrerPaid = true;
    await User.findByIdAndUpdate(
      new ObjectId(userId),
      {
        $set: userFields,
      },
      {
        new: true,
      }
    );
    return;
  } catch (error) {
    throw error;
  }
};

const isValidBitcoinAddress = async (address) => {
  try {
    const isValidAddress = await bitgo.coin(coin).isValidAddress(address);
    return isValidAddress;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getBtcNotifications = async ({ userId }) => {
  try {
    const coin = "BTC";
    const notifications = await Notification.find({ userId, coin });
    return notifications;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  generateBtcWallet,
  getBtcTransactions,
  getBtcAddress,
  getBtcBalance,
  sendBTC,
  estimateTransactionFee,
  getPrices,
  currentPrice,
  buyBTC,
  sellBTC,
  sendBTCWithFee,
  payReferrerBTC,
  isValidBitcoinAddress,
  getBtcNotifications,
};
