const { Web3 } = require("web3");
const Ethereum = require("../models/Ethereum");
const settings = require("../config/settings.json");
const Enviroment = settings.env;
const infuraAPIkey = settings[Enviroment].INFURA_API;
const web3 = new Web3(infuraAPIkey);
const etherscanAPIkey = settings[Enviroment].ETHERSCAN_API_KEY;
const etherscanNetwork = settings[Enviroment].ETHERSCAN_NETWORK;
const coinmarketcapApi = settings[Enviroment].COINMARKETCAP_API_KEY;
const referralPercentage = settings[Enviroment].REFERRAL_PERCENTAGE;
const referralActive = settings[Enviroment].REFERRAL_ACTIVE;
const admin_eth_address = settings[Enviroment].ETH_ADDRESS;
const eth_fee = settings[Enviroment].ETH_FEE;

const etherscan = require("etherscan-api").init(
  etherscanAPIkey,
  etherscanNetwork
); // homestead as domain/network name for mainnet
const Axios = require("axios");
const { daysOfWeek } = require("../util/helper");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { ObjectId } = mongoose.Types;

const generateETHWallet = async ({ userId }) => {
  try {
    const wallet = web3.eth.accounts.create();
    if (!wallet) {
      throw new Error("Failed to generate wallet.");
    }
    const address = wallet.address;
    const privateKey = wallet.privateKey;
    const etherObj = { userId, address, privateKey };
    const newEthWallet = new Ethereum(etherObj);
    await newEthWallet.save();
    return wallet;
  } catch (error) {
    throw error;
  }
};

const getETHBalance = async ({ userId }) => {
  try {
    const ethWallet = await Ethereum.findOne({ userId });
    if (!ethWallet) {
      return '';
    }
    const address = ethWallet.address;
    const balance = await web3.eth.getBalance(address);
    const etherBalance = await web3.utils.fromWei(balance, "ether");
    return etherBalance;
  } catch (error) {
    throw error;
  }
};

const getETHAddress = async ({ userId }) => {
  try {
    const ethWallet = await Ethereum.findOne({ userId });
    if (!ethWallet) {
      return '';
    }
    const address = ethWallet.address;
    return address;
  } catch (error) {
    throw error;
  }
};

const sendETH = async ({
  userId,
  pin,
  recipientAddress,
  sendOnReceive,
  amount,
}) => {
  try {
    const ethWallet = await Ethereum.findOne({ userId });
    if (!ethWallet) {
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
    const fromAddress = ethWallet.address;
    const privateKey = ethWallet.privateKey;
    const value = web3.utils.toWei(amount, "ether");
    const nonce = await web3.eth.getTransactionCount(fromAddress);
    const gasPrice = await web3.eth.getGasPrice();
    // const block = await web3.eth.getBlock("latest");
    // const maxFeePerGas = Number(block.baseFeePerGas.toString());
    // console.log("maxFeePerGas=" + maxFeePerGas);
    // console.log("gasPrice=" + gasPrice);
    const estimatedGas = await estimateETHGas({
      userId,
      recipientAddress,
      amount,
    });
    console.log("estimatedGas=" + estimatedGas);
    const signTransaction = await web3.eth.accounts.signTransaction(
      {
        from: fromAddress,
        to: recipientAddress,
        value,
        gasPrice,
        nonce,
      },
      privateKey
    );
    const receipt = await web3.eth.sendSignedTransaction(
      signTransaction.rawTransaction
    );
    const transactionHash = receipt.transactionHash;
    return transactionHash;
  } catch (error) {
    throw error;
  }
};

const sendETHWithFee = async ({
  userId,
  pin,
  recipientAddress,
  sendOnReceive,
  amount,
}) => {
  try {
    await sendETH({
      userId,
      pin,
      recipientAddress: admin_eth_address,
      sendOnReceive,
      amount: eth_fee,
    });
    const transaction = await sendETH({
      userId,
      pin,
      recipientAddress,
      sendOnReceive,
      amount,
    });
    return transaction;
  } catch (error) {
    throw error;
  }
};

const getETHTransactions = async ({ userId }) => {
  const ethWallet = await Ethereum.findOne({ userId });
  if (!ethWallet) {
    return '';
  }
  const ethAddress = ethWallet.address;
  try {
    const response = await etherscan.account.txlist(
      ethAddress,
      1,
      "latest",
      1,
      100,
      "desc"
    );

    if (response.status === "1") {
      const transactions = response.result;
      const formattedTransactions = transactions
        .map((transaction) => {
          const amountEther = web3.utils.fromWei(transaction.value, "ether");
          if (parseFloat(amountEther) <= 0) {
            return null;
          }
          const gasEther = web3.utils.fromWei(transaction.gasUsed, "ether");
          const gasPriceGwei = web3.utils.fromWei(transaction.gasPrice, "gwei");
          const timeStamp = transaction.timeStamp;
          const date = new Date(timeStamp * 1000);
          const formattedDate = date.toISOString();
          const transactionFeeEther =
            (parseFloat(gasEther) * parseFloat(gasPriceGwei)) / 1e9;

          let type;
          if (transaction.from.toLowerCase() === ethAddress.toLowerCase()) {
            type = "send";
          } else if (
            transaction.to.toLowerCase() === ethAddress.toLowerCase()
          ) {
            type = "receive";
          } else {
            type = "unknown";
          }

          return {
            type: type,
            sender: transaction.from,
            receiver: transaction.to,
            transactionHx: transaction.hash,
            amount: amountEther,
            gas: gasEther,
            fee: transactionFeeEther,
            date: formattedDate,
          };
        })
        .filter((transaction) => {
          const transactionTypeValid = transaction
            ? transaction.type !== "unknown"
            : false;
          const isTransactionNOTNull = transaction !== null;

          return transactionTypeValid && isTransactionNOTNull;
        });
      if (referralActive)
        payReferrerETHonReceive({
          userId,
          transactions: formattedTransactions,
        });
      return formattedTransactions;
    } else {
      return [];
    }
  } catch (error) {
    if (error === "No transactions found") return [];

    throw error;
  }
};

const payReferrerETHonReceive = async ({ userId, transactions }) => {
  const user = await User.findById(userId);
  if (!user) return;
  const referrerPaid = user.referrerPaid;
  if (referrerPaid) return;

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    if (transaction.type === "receive") {
      const amount = transaction.amount;
      const sendOnReceive = true;
      console.log({ userId, amount, sendOnReceive });
      await payReferrerETH({ userId, amount, sendOnReceive });
      break;
    }
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
          symbol: "ETH",
          convert: currency,
        },
      }
    );
    const price = response.data.data.ETH.quote[currency].price;
    return parseInt(price);
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
          symbol: "ETH",
          count: 7,
          interval: "1d",
          convert: currency,
        },
      }
    );
    const quotes = response.data.data.ETH[0].quotes;
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
    throw error;
  }
};

const estimateETHGas = async ({ userId, recipientAddress, amount }) => {
  try {
    const userWallet = await Ethereum.findOne({ userId });
    if (!userWallet) {
      throw new Error("Could not find wallet for user");
    }
    const fromAddress = userWallet.address;
    const amountToSend = web3.utils.toWei(amount, "ether");

    const estimatedGasUnits = await web3.eth.estimateGas({
      from: fromAddress,
      to: recipientAddress,
      value: amountToSend,
    });

    const gasPrice = await web3.eth.getGasPrice();

    // Convert estimated gas from gas units to ether
    const gasCostInWei = estimatedGasUnits * gasPrice;
    const estimatedGas = web3.utils.fromWei(gasCostInWei.toString(), "ether");
    return estimatedGas;
  } catch (error) {
    throw error;
  }
};

const buyETH = async ({
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
      throw new Error("Could not find User wallet for ETH");
    }
    const coin = "ETH";
    const type = "buy";
    const pricePerETH = await currentPrice({ currency });
    const totalPriceFloat = amount / pricePerETH;
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

const sellETH = async ({
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
      throw new Error("Could not find User wallet for ETH");
    }
    const admin = await User.findOne({ isAdmin: true });
    if (!admin) {
      throw new Error("Could not find Recipient Wallet");
    }
    const adminId = admin._id;
    const adminWallet = await Ethereum.findOne({ userId: adminId });
    if (!adminWallet) {
      throw new Error("Could not find ETH wallet for recipient");
    }
    const recipientAddress = adminWallet.address;
    const transactionHash = await sendETH({
      userId,
      recipientAddress,
      amount,
      pin,
    });
    const coin = "ETH";
    const type = "sell";
    const pricePerETH = await currentPrice({ currency });
    const totalPriceFloat = amount * pricePerETH;
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

const payReferrerETH = async ({ userId, amount, sendOnReceive, pin }) => {
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
    const balance = await getETHBalance({ userId: adminId });
    if (balance < amountToSend) return;
    // Get Admin and Referrer Wallet
    const adminWallet = await Ethereum.findOne({ userId: adminId });
    if (!adminWallet) {
      throw new Error("Could not find ETH wallet for Admin");
    }
    const referrerWallet = await Ethereum.findOne({ userId: referrerUserId });
    if (!referrerWallet) {
      throw new Error("Could not find ETH wallet for recipient");
    }
    const recipientAddress = referrerWallet.address;
    // Send Referrer the amount and change status of refferer
    await sendETH({
      userId: adminId,
      recipientAddress,
      amount: amountToSend,
      sendOnReceive,
      pin,
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

const getEthNotifications = async ({ userId }) => {
  try {
    const coin = "ETH";
    const notifications = await Notification.find({ userId, coin });
    return notifications;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const isValidEthereumAddress = (address) => {
  try {
    return web3.utils.isAddress(address);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateETHWallet,
  getETHBalance,
  getETHAddress,
  sendETH,
  getETHTransactions,
  currentPrice,
  getPrices,
  estimateETHGas,
  buyETH,
  sellETH,
  sendETHWithFee,
  payReferrerETH,
  isValidEthereumAddress,
  getEthNotifications
};
