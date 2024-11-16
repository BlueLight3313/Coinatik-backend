const { Web3 } = require("web3");
const Ethereum = require("../models/Ethereum");
const settings = require("../config/settings.json");
const Enviroment = settings.env;
const infuraAPIkey = settings[Enviroment].INFURA_API;
const web3 = new Web3(infuraAPIkey);
const etherscanAPIkey = settings[Enviroment].ETHERSCAN_API_KEY;
const etherscanNetwork = settings[Enviroment].ETHERSCAN_NETWORK;
const coinmarketcapApi = settings[Enviroment].COINMARKETCAP_API_KEY;
const referralActive = settings[Enviroment].REFERRAL_ACTIVE;
const referralPercentage = settings[Enviroment].REFERRAL_PERCENTAGE;
const admin_usdt_address = settings[Enviroment].USDT_ADDRESS;
const usdt_fee = settings[Enviroment].USDT_FEE;

const etherscan = require("etherscan-api").init(
  etherscanAPIkey,
  etherscanNetwork
); // homestead as domain/network name for mainnet
const { USDTAddress } = require("../constants/tokens");
const ERC20ABI = require("../constants/ERC20ABI.json");
const User = require("../models/User");
const Order = require("../models/Order");
const Axios = require("axios");
const mongoose = require("mongoose");
const { daysOfWeek } = require("../util/helper");
const { ObjectId } = mongoose.Types;
const bcrypt = require("bcryptjs");
const Notification = require("../models/Notification");

const getUSDTBalance = async ({ userId }) => {
  try {
    const usdtWallet = await Ethereum.findOne({ userId });
    if (!usdtWallet) {
      return '';
    }
    const address = usdtWallet.address;
    const usdtContract = new web3.eth.Contract(ERC20ABI, USDTAddress);
    const balanceInWei = await usdtContract.methods.balanceOf(address).call();
    const balance = web3.utils.fromWei(balanceInWei, "ether");

    return balance;
  } catch (error) {
    throw error;
  }
};

const sendUSDT = async ({
  userId,
  pin,
  recipientAddress,
  amount,
  sendOnReceive,
}) => {
  try {
    const ethWallet = await Ethereum.findOne({ userId });
    if (!ethWallet) {
      return '';
    }
    const user = await User.findById(userId);
    console.log(user);
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
    const amountToSend = web3.utils.toWei(amount, "ether");

    const usdtContract = new web3.eth.Contract(ERC20ABI, USDTAddress);
    const query = usdtContract.methods.transfer(recipientAddress, amountToSend);
    const encodedABI = query.encodeABI();

    // Estimate gas as a BigInt value
    const estimatedGas = await web3.eth.estimateGas({
      from: fromAddress,
      to: USDTAddress,
      data: encodedABI,
    });

    // Calculate gasBuffer
    const gasBuffer = BigInt(Math.ceil(Number(estimatedGas) * 1.1));
    // Get nonce as a regular number
    const nonce = await web3.eth.getTransactionCount(fromAddress);

    // Convert gas values to hexadecimal strings
    const gasPrice = await web3.eth.getGasPrice();
    const gasPriceHex = web3.utils.toHex(gasPrice);
    const gasBufferHex = web3.utils.toHex(gasBuffer);

    // Sign the transaction
    const signedTxn = await web3.eth.accounts.signTransaction(
      {
        nonce: web3.utils.toHex(nonce),
        to: USDTAddress,
        data: encodedABI,
        gasPrice: gasPriceHex,
        gas: gasBufferHex,
      },
      privateKey
    );

    // Send the transaction
    const receipt = await web3.eth.sendSignedTransaction(
      signedTxn.rawTransaction
    );

    const transactionHash = receipt.transactionHash;
    return transactionHash;
  } catch (error) {
    throw error;
  }
};

const sendUSDTWithFee = async ({
  userId,
  pin,
  recipientAddress,
  amount,
  sendOnReceive,
}) => {
  try {
    await sendUSDT({
      userId,
      pin,
      recipientAddress: admin_usdt_address,
      amount: usdt_fee,
      sendOnReceive,
    });

    const transaction = await sendUSDT({
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

const estimateUSDTGas = async ({ userId, recipientAddress, amount }) => {
  try {
    const usdtWallet = await Ethereum.findOne({ userId });
    if (!usdtWallet) {
      return '';
    }
    const fromAddress = usdtWallet.address;
    const amountToSend = web3.utils.toWei(amount, "ether");

    const usdtContract = new web3.eth.Contract(ERC20ABI, USDTAddress);
    const query = usdtContract.methods.transfer(recipientAddress, amountToSend);
    const encodedABI = query.encodeABI();
    // estimated gas in gas units
    const estimatedGasUnits = await web3.eth.estimateGas({
      from: fromAddress,
      to: USDTAddress,
      data: encodedABI,
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

const getUsdtTransactions = async ({ userId }) => {
  try {
    const usdtWallet = await Ethereum.findOne({ userId });
    if (!usdtWallet) {
      return '';
    }
    const userUsdtAddress = usdtWallet.address;
    const response = await etherscan.account.tokentx(
      userUsdtAddress,
      USDTAddress,
      1,
      "latest",
      1,
      100,
      "desc"
    );
    if (response.status === "1") {
      const usdtTransactions = response.result;

      const formattedTransactions = usdtTransactions
        .map((transaction) => {
          const amountWei = parseFloat(transaction.value);
          const gasUsedWei = parseFloat(transaction.gasUsed);
          const gasPriceWei = parseFloat(transaction.gasPrice);
          const timeStamp = transaction.timeStamp;
          const date = new Date(timeStamp * 1000);
          const formattedDate = date.toISOString();
          const amountUSDT = web3.utils.fromWei(amountWei.toString(), "ether");
          if (parseFloat(amountUSDT) <= 0) {
            return null;
          }
          const transactionFeeWei = gasUsedWei * gasPriceWei;
          const transactionFeeUSDT = web3.utils.fromWei(
            transactionFeeWei.toString(),
            "ether"
          ); // Convert fee from Wei to USDT

          let type;
          if (
            transaction.from.toLowerCase() === userUsdtAddress.toLowerCase()
          ) {
            type = "send";
          } else if (
            transaction.to.toLowerCase() === userUsdtAddress.toLowerCase()
          ) {
            type = "receive";
          } else {
            // This case should not occur, but handle it as needed
            type = "unknown";
          }

          return {
            type: type,
            sender: transaction.from,
            receiver: transaction.to,
            transactionHx: transaction.hash,
            amount: amountUSDT,
            gas: gasUsedWei, // Round gas used to whole number
            fee: transactionFeeUSDT,
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
        payReferrerUSDTonReceive({
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

const payReferrerUSDTonReceive = async ({ userId, transactions }) => {
  const user = await User.findById(userId);
  if (!user) return;
  const referrerPaid = user.referrerPaid;
  if (referrerPaid) return;

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    if (transaction.type === "receive") {
      const amount = transaction.amount;
      const sendOnReceive = true;
      await payReferrerUSDT({ userId, amount, sendOnReceive });
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
          symbol: "USDT",
          convert: currency,
        },
      }
    );
    let price = response.data.data.USDT.quote[currency].price; 
    
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
          symbol: "USDT",
          count: 7,
          interval: "1d",
          convert: currency,
        },
      }
    );
    const quotes = response.data.data.USDT[0].quotes;
    let labels = [];
    let prices = [];
    quotes.forEach((item) => {
      const timestamp = item.timestamp;
      const priceFloat = item.quote[currency].price;
      const price = priceFloat.toFixed(2);
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

const buyUSDT = async ({
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
    const coin = "USDT";
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

const sellUSDT = async ({
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
    const adminWallet = await Ethereum.findOne({ userId: adminId });
    if (!adminWallet) {
      throw new Error("Could not find USDT wallet for recipient");
    }
    const recipientAddress = adminWallet.address;
    const transactionHash = await sendUSDT({
      userId,
      recipientAddress,
      amount,
      pin,
    });
    const coin = "USDT";
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

const payReferrerUSDT = async ({ userId, amount, pin, sendOnReceive }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Could not find User wallet for USDT");
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
    const balance = await getUSDTBalance({ userId: adminId });
    if (balance < amountToSend) return;
    // Get Admin and Referrer Wallet
    const adminWallet = await Ethereum.findOne({ userId: adminId });
    if (!adminWallet) {
      throw new Error("Could not find USDT wallet for Admin");
    }
    const referrerWallet = await Ethereum.findOne({ userId: referrerUserId });
    if (!referrerWallet) {
      throw new Error("Could not find USDT wallet for recipient");
    }
    const recipientAddress = referrerWallet.address;
    // Send Referrer the amount and change status of refferer
    await sendUSDT({
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

const getUsdtNotifications = async ({ userId }) => {
  try {
    const coin = "USDT";
    const notifications = await Notification.find({ userId, coin });
    return notifications;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const usdtNotification = async ({ from, to, value, transactionHash }) => {
  try {
    const etherWallet = await Ethereum.findOne({ address: to });
    if (!etherWallet) return null;
    const userIdStr = etherWallet.userId;
    const userId = new ObjectId(userIdStr);
    const user = await User.findById(userId);
    if (!user) return null;
    const coin = "USDT";
    let amount = web3.utils.fromWei(value, "ether");
    amount = amount.toString();
    const isAdded = await Notification.findOne({ transactionHash });
    if (isAdded) {
      return null;
    }
    const notificationObj = {
      userId,
      from,
      to,
      amount,
      transactionHash,
      coin,
    };
    let notification = new Notification(notificationObj);
    notification = await notification.save();
    return notification;
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  getUSDTBalance,
  sendUSDT,
  estimateUSDTGas,
  getUsdtTransactions,
  currentPrice,
  getPrices,
  buyUSDT,
  sellUSDT,
  payReferrerUSDT,
  usdtNotification,
  sendUSDTWithFee,
  getUsdtNotifications
};
