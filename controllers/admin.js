const bcrypt = require("bcryptjs");
const passport = require("passport");
const nodemailer = require("nodemailer");
const { generateBtcWallet, sendBTC, payReferrerBTC } = require("./bitcoin");
const { generateETHWallet, payReferrerETH, sendETH } = require("./ethereum");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const Order = require("../models/Order");
const Ethereum = require("../models/Ethereum");
const { sendUSDT, payReferrerUSDT } = require("./usdt");
const {
  allowedOrderStatus,
  allowedEnvs,
  getSocketId,
  generateRandomCode
} = require("../util/helper");
const fs = require("fs");
const path = require("path");
const Bitcoin = require("../models/Bitcoin");
const settings = require("../config/settings.json");
const Notification = require("../models/Notification");
const Enviroment = settings.env;
const referralActive = settings[Enviroment].REFERRAL_ACTIVE;
const SMTP_HOST = settings[Enviroment].SMTP_HOST;
const SMTP_PORT = settings[Enviroment].SMTP_PORT;
const SMTP_USER = settings[Enviroment].SMTP_USER;
const SMTP_PASS = settings[Enviroment].SMTP_PASS;
const OTP_DURATION = settings[Enviroment].OTP_DURATION;
const simpleSwapApiKey = settings[Enviroment].SIMPLE_SWAP_API_KEY;

const jwt = require("jsonwebtoken"); // Import the JWT library

function generateToken(user) {
  const payload = {
    sub: user._id
  };

  const secret = settings.secret;
  const options = { expiresIn: '1h' };

  return jwt.sign(payload, secret, options);
}

const sendMail = async ({ email }) => {
  try {
    const subject = "OTP from Coinatik";
    const otp = generateRandomCode();
    const currentDate = new Date();
    const otpExpirationDate = new Date();
    // Format date to send in email
    const otpduration = parseInt(OTP_DURATION); // in days
    otpExpirationDate.setDate(currentDate.getDate() + otpduration);
    const day = otpExpirationDate.getDate();
    const month = otpExpirationDate.getMonth() + 1;
    const year = otpExpirationDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;
    // Create Transport Object
    let transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    // Send Mail
    const info = await transporter.sendMail({
      from: SMTP_USER,
      to: email,
      subject: subject,
      html: `
          <div> your coinatik OTP is <h3>${otp}</h3>. your OTP will expire on ${formattedDate}</div>
          `,
    });
    return { otp, otpExpirationDate };
  } catch (error) {
    throw error;
  }
};

const sendOTP = async ({ email }) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User Account not found");
    }
    const userEmail = user.email;
    const resp = await sendMail({ email: userEmail });
    const otp = resp.otp;
    const otpExpirationDate = new Date();
    otpExpirationDate.setMinutes(otpExpirationDate.getMinutes() + 20);
    let userFields = {
      otp,
      otpExpirationDate,
    };
    await User.findOneAndUpdate(
      { email },
      {
        $set: userFields,
      }
    );
  } catch (error) {
    throw error;
  }
};

const checkOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ errorMsg: "User not found." });
    }

    if (`${user.otp}` === `${otp}` && new Date(user.otpExpirationDate) > new Date()) {
      req.logIn(user, async (err) => {
        if (err) {
          return res.status(500).json({ errorMsg: "Error logging in" });
        }

        await User.findOneAndUpdate(
          { email },
          {
            $set: {
              otp: null,
              otpExpirationDate: null
            },
          }
        );
        return res.json({ user });
      });
    } else {
      return res.status(400).json({ errorMsg: "Invalid or expired OTP." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
}

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    passport.authenticate("user-local", async (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(409).json({ errorMsg: "Invalid Credentials" });
      } else {
        // Assuming sendOTP sends an OTP and updates the user document accordingly
        try {
          await sendOTP({ email: user.email }); // Make sure this function is implemented to actually send an OTP
          return res.json({ success: true, message: "OTP sent. Please verify to complete login." });
        } catch (otpError) {
          return res.status(500).json({ errorMsg: "Failed to send OTP", error: otpError });
        }
      }
    })(req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
};

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const {
      name,
      email,
      password,
      phoneNumber,
      referralId,
      userName,
      country,
      currency,
      currencySymbol,
    } = req.body;
    console.log(req.body, "body of admin login");
    const userFound = await User.findOne({ email });
    if (userFound) {
      return res.status(409).json({ errorMsg: "User Already Exists" });
    }
    let userObj = {
      name,
      userName,
      email,
      password,
      phoneNumber,
      country,
      currency,
      currencySymbol,
      isAdmin: true,
    };
    if (referralId) userObj.referralId = referralId;
    let user = new User(userObj);
    const salt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(password, salt);
    user.password = encryptedPassword;
    user = await user.save();
    const userId = user._id;
    await generateBtcWallet({
      name,
      passphrase: encryptedPassword,
      userId,
    });
    await generateETHWallet({ userId });
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
};

const getUsers = async () => {
  try {
    const usersWithAddresses = await User.aggregate([
      {
        $match: {
          $or: [{ isAdmin: { $ne: true } }, { isAdmin: { $exists: false } }],
        },
      },
      {
        $lookup: {
          from: "ethereums",
          localField: "_id",
          foreignField: "userId",
          as: "ethereum",
        },
      },
      {
        $lookup: {
          from: "bitcoins",
          localField: "_id",
          foreignField: "userId",
          as: "bitcoin",
        },
      },
      {
        $addFields: {
          ethereum: { $arrayElemAt: ["$ethereum", 0] },
          bitcoin: { $arrayElemAt: ["$bitcoin", 0] },
        },
      },
      {
        $project: {
          "ethereum.privateKey": 0, // Exclude the privateKey from ethereum
          "ethereum.__v": 0, // Exclude the version key from ethereum
          "ethereum.userId": 0, // Exclude the userId from ethereum
          "ethereum._id": 0, // Exclude the _id from ethereum
          "bitcoin.privateKey": 0, // Exclude the privateKey from bitcoin
          "bitcoin.__v": 0, // Exclude the version key from bitcoin
          "bitcoin.userId": 0, // Exclude the userId from bitcoin
          "bitcoin._id": 0, // Exclude the _id from bitcoin
          // Exclude or include any other fields as necessary
        },
      },
    ]);
    return usersWithAddresses;
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
};

const deleteUser = async ({ userId }) => {
  try {
    const wasRemoved = await User.findByIdAndRemove(userId);
    if (!wasRemoved) {
      throw new Error("User not found");
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const updateOrder = async ({ adminId, orderId, status, message, pin, io }) => {
  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      throw new Error("Could not find Order");
    }
    if (!allowedOrderStatus.includes(status)) {
      throw new Error(`Status ${status} is not allowed`);
    }
    const orderType = order.type;
    const coin = order.coin;
    if (status === "completed") {
      if (orderType === "buy") {
        const receiverId = order.userId;

        if (coin === "USDT") {
          const receiverUSDTWallet = await Ethereum.findOne({
            userId: receiverId,
          });
          if (!receiverUSDTWallet) {
            throw new Error("Could not find User Wallet");
          }
          const recipientAddress = receiverUSDTWallet.address;
          const adminUSDTWallet = await Ethereum.findOne({
            userId: adminId,
          });
          if (!adminUSDTWallet) {
            throw new Error("Could not find User Wallet");
          }
          const adminAddress = adminUSDTWallet.address;
          const amountToRecieve = order.amountToRecieve;
          await sendUSDT({
            userId: adminId,
            recipientAddress,
            amount: amountToRecieve,
            pin,
          });
          await addNotification({
            userId: receiverId,
            from: adminAddress,
            to: recipientAddress,
            amount: amountToRecieve,
            coin,
          });
          const notificationMsg = `You've Received ${amountToRecieve} ${coin}`;
          io.emit("notification", {
            userId: receiverId,
            msg: notificationMsg,
          });
          if (referralActive) {
            await payReferrerUSDT({
              userId: receiverId,
              amount: amountToRecieve,
              pin,
            });
          }
        } else if (coin === "ETH") {
          const receiverETHWallet = await Ethereum.findOne({
            userId: receiverId,
          });
          if (!receiverETHWallet) {
            throw new Error("Could not find User Wallet");
          }
          const recipientAddress = receiverETHWallet.address;
          const adminETHWallet = await Ethereum.findOne({
            userId: adminId,
          });
          if (!adminETHWallet) {
            throw new Error("Could not find User Wallet");
          }
          const adminAddress = adminUSDTWallet.address;
          const amountToRecieve = order.amountToRecieve;
          await sendETH({
            userId: adminId,
            recipientAddress,
            amount: amountToRecieve,
            pin,
          });
          await addNotification({
            userId: receiverId,
            from: adminAddress,
            to: recipientAddress,
            amount: amountToRecieve,
            coin,
          });
          const notificationMsg = `You've Received ${amountToRecieve} ${coin}`;
          io.emit("notification", {
            userId: receiverId,
            msg: notificationMsg,
          });
          if (referralActive) {
            await payReferrerETH({
              userId: receiverId,
              amount: amountToRecieve,
              pin,
            });
          }
        } else if (coin === "BTC") {
          const receiverBTCWallet = await Bitcoin.findOne({
            userId: receiverId,
          });
          if (!receiverBTCWallet) {
            throw new Error("Could not find User Wallet");
          }
          const recipientAddress = receiverBTCWallet.walletAddress;
          const amountToRecieve = parseFloat(order.amountToRecieve);
          console.log({
            userId: adminId,
            recipientAddress,
            amount: amountToRecieve,
            pin,
          });
          await sendBTC({
            userId: adminId,
            pin,
            recipientAddress,
            amount: amountToRecieve,
          });
          await addNotification({
            userId: receiverId,
            from: adminAddress,
            to: recipientAddress,
            amount: amountToRecieve,
            coin,
          });
          const notificationMsg = `You've Received ${amountToRecieve} ${coin}`;
          io.emit("notification", {
            userId: receiverId,
            msg: notificationMsg,
          });
          if (referralActive) {
            await payReferrerBTC({
              userId: receiverId,
              amount: amountToRecieve,
              pin,
            });
          }
        }
      }
    }

    let orderFields = {
      status,
    };
    if (message) orderFields.message;
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: orderFields,
      },
      {
        new: true,
      }
    );
    return updatedOrder;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const updateSettings = async (data) => {
  try {
    if (!data.env) {
      throw new Error("env is missing");
    }
    const filePath = path.join(__dirname, "../config/settings.json");
    const rawData = fs.readFileSync(filePath);
    const jsonData = JSON.parse(rawData);
    for (const key in data) {
      if (data.hasOwnProperty(key) && jsonData[data.env].hasOwnProperty(key)) {
        jsonData[data.env][key] = data[key];
      }
    }
    const updatedData = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, updatedData);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const updateEnv = async ({ env }) => {
  try {
    if (!allowedEnvs.includes(env)) {
      throw new Error(`Environment ${env} is not allowed`);
    }
    const filePath = path.join(__dirname, "../config/settings.json");
    const rawData = fs.readFileSync(filePath);
    const jsonData = JSON.parse(rawData);
    jsonData.env = env;
    const updatedData = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, updatedData);
  } catch (error) {
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    throw error; // Ensure this error is catchable by the calling function
  }
};


const getOrders = async () => {
  try {
    const orders = await Order.find();
    return orders;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const addNotification = async ({ userId, from, to, amount, coin }) => {
  try {
    const notificationObj = {
      userId,
      from,
      to,
      amount,
      coin,
    };
    let notification = new Notification(notificationObj);
    notification = await notification.save();
    return notification;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

module.exports = {
  login,
  checkOTP,
  register,
  deleteUser,
  getUsers,
  getOrders,
  updateOrder,
  updateSettings,
  updateEnv,
};
