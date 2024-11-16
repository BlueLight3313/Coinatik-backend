const nodemailer = require("nodemailer");
const User = require("../models/User");
const { generateRandomCode } = require("../util/helper");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const { generateBtcWallet, getBtcAddress, sendBTC } = require("./bitcoin");
const { generateETHWallet, getETHAddress, sendETH } = require("./ethereum");
const { validationResult } = require("express-validator");
const Bank = require("../models/Bank");
const settings = require("../config/settings.json");
const Order = require("../models/Order");
const Axios = require("axios");
const { sendUSDT } = require("./usdt");
const Swap = require("../models/Swap");
const Notification = require("../models/Notification");
const ForgotPin = require("../models/ForgotPin");

const Enviroment = settings.env;
const SMTP_HOST = settings[Enviroment].SMTP_HOST;
const SMTP_PORT = settings[Enviroment].SMTP_PORT;
const SMTP_USER = settings[Enviroment].SMTP_USER;
const SMTP_PASS = settings[Enviroment].SMTP_PASS;
const OTP_DURATION = settings[Enviroment].OTP_DURATION;
const simpleSwapApiKey = settings[Enviroment].SIMPLE_SWAP_API_KEY;

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    passport.authenticate("user-local", (err, user, info) => {
      if (err) {
        throw err;
      }
      if (!user) {
        return res.status(409).json({ errorMsg: "Invalid Credentials" });
      } else {
        req.logIn(user, async (err) => {
          if (err) {
            throw err;
          }
          res.json({ user });
        });
      }
    })(req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
};

const loginPin = async (req, res, next) => {
  try {
    console.log(req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    await passport.authenticate("user-pin", (err, user, info) => {
      if (err) {
        throw err;
      }
      if (!user) {
        return res.status(409).json({ errorMsg: "Invalid Credentials" });
      } else {
        req.logIn(user, async (err) => {
          if (err) {
            throw err;
          }
          res.json({ user });
        });
      }
    })(req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
};

const logout = async (req, res) => {
  try {
    req.logout(function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ errorMsg: "Logout failed" });
      }
      // Assuming you have a cookie named 'sessionToken' or similar
      res.clearCookie("connect.sid");
      // If using express-session, you may also want to destroy the session
      req.session.destroy(function (err) {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ errorMsg: "Session destruction failed" });
        }
        res.json({ msg: "Logged out successfully" });
      });
    });
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
      userName,
      name,
      email,
      password,
      phoneNumber,
      referrerId,
      country,
      currency,
      currencySymbol,
    } = req.body;
    const userFound = await User.findOne({ email });
    if (userFound) {
      return res.status(409).json({ errorMsg: "User Already Exists" });
    }

    const referralCode = await generateReferralCode();
    let userObj = {
      userName,
      name,
      email,
      password,
      phoneNumber,
      country,
      currency,
      currencySymbol,
      referralCode,
    };
    if (referrerId) userObj.referrerId = referrerId;
    let user = new User(userObj);
    const salt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(password, salt);
    user.password = encryptedPassword;
    user = await user.save();
    // const userId = user._id;
    // await generateBtcWallet({
    //   name,
    //   passphrase: encryptedPassword,
    //   userId,
    // });
    // await generateETHWallet({ userId });

    req.logIn(user, async (err) => {
      if (err) {
        throw err;
      }
      res.json({ user });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: "Server Error" });
  }
};

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
    const otpExpirationDate = resp.otpExpirationDate;
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

const checkOTP = async ({ email, otp }) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User Account not found");
    }
    const userOtp = user.otp;
    const isCorrectOTP = Boolean(userOtp === otp);
    return isCorrectOTP;
  } catch (error) {
    throw error;
  }
};

const verifyEmail = async ({ userId, otp }) => {
  try {
    let user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    if (!Boolean(user.otp) || !Boolean(user.otpExpirationDate)) {
      throw new Error("Please Regenerate OTP");
    }
    const userOTP = user.otp;
    const userOtpExpStr = user.otpExpirationDate;
    const userOtpExpDate = new Date(userOtpExpStr);
    const currentDate = new Date();
    if (currentDate > userOtpExpDate) {
      throw new Error("OTP is expired");
    }
    console.log(userOTP);
    console.log(otp);
    if (userOTP !== otp) {
      throw new Error("Invalid OTP");
    }
    let userFields = {
      otp: null,
      otpExpirationDate: null,
      verified: true,
    };
    user = await User.findByIdAndUpdate(
      userId,
      {
        $set: userFields,
      },
      {
        new: true,
      }
    );
    return user;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const addPin = async ({ userId, pin }) => {
  try {
    let user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    if (user.pin) {
      throw new Error("Pin is already added");
    }
    const salt = await bcrypt.genSalt(10);
    const encryptedPin = await bcrypt.hash(pin, salt);
    let userFields = {
      pin: encryptedPin,
    };
    user = await User.findByIdAndUpdate(
      userId,
      {
        $set: userFields,
      },
      {
        new: true,
      }
    );
    return user;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const updatePin = async ({ userId, currentPin, newPin }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    if (!user.pin) {
      throw new Error("Pin is not added");
    }
    const isMatch = await bcrypt.compare(currentPin, user.pin);
    if (!isMatch) {
      throw new Error("Current Pin is not correct");
    }
    const salt = await bcrypt.genSalt(10);
    const encryptedPin = await bcrypt.hash(newPin, salt);

    let userFields = {
      pin: encryptedPin,
    };
    await User.findByIdAndUpdate(userId, {
      $set: userFields,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const updateProfile = async ({
  userId,
  name,
  phoneNumber,
  image,
  userName,
  country,
  currency,
  currencySymbol,
  language,
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    let userFields = {};
    if (name) userFields.name = name;
    if (phoneNumber) userFields.phoneNumber = phoneNumber;
    if (image) userFields.image = image;
    if (userName) userFields.userName = userName;
    if (country) userFields.country = country;
    if (currency) userFields.currency = currency;
    if (currencySymbol) userFields.currencySymbol = currencySymbol;
    if (language) userFields.language = language;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: userFields,
      },
      {
        new: true,
      }
    );
    return updatedUser;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const forgotPassword = async ({ otp, email, password }) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User Account not found");
    }
    if (!Boolean(user.otp) || !Boolean(user.otpExpirationDate)) {
      throw new Error("Please Regenerate OTP");
    }
    if (user.otp !== otp) {
      throw new Error("Invalid OTP");
    }
    const salt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(password, salt);
    let userFields = {
      password: encryptedPassword,
    };
    await User.findOneAndUpdate(
      { email },
      {
        $set: userFields,
      },
      {
        new: true,
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const ProcessforgotPin = async (email) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User Account not found");
    }
    const userEmail = user.email;
    const resp = await sendMail({ email: userEmail });
    const otp = resp.otp;
    const otpExpirationDate = resp.otpExpirationDate;

    let request = await ForgotPin.findOne({ email: userEmail });

    if (request) {
      await ForgotPin.findOneAndUpdate(
        { email: userEmail },
        {
          $set: {
            otp,
            otpExpirationDate,
          },
        },
        {
          new: true,
        }
      );
    } else {
      await ForgotPin.create({
        email: userEmail,
        otp,
        otpExpirationDate,
      });
    }
  } catch (error) {
    throw error;
  }
};

const forgotPin = async (req, res, next) => {
  try {
    const { email } = req.body;
    await ProcessforgotPin(email);

    res.json({
      message: "Email Sent",
    });
  } catch (error) {
    throw error;
  }
};

const checkPinResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const pin_reset_token = (Math.random() + 1).toString(36).substring(2);

    const forgotPinRequest = await ForgotPin.findOne({
      email,
      otp,
    });

    if (new Date() < new Date(forgotPinRequest.otpExpirationDate)) {
      await User.findOneAndUpdate(
        { email },
        {
          $set: {
            pin_reset_token,
          },
        },
        {
          new: true,
        }
      );

      await ForgotPin.deleteOne({
        email,
      });

      return res.status(200).json({
        success: true,
        token: pin_reset_token,
      });
    }

    return res.status(400).json({
      success: false,
    });
  } catch (error) {
    throw error;
  }
};

const resetPin = async (req, res, next) => {
  try {
    const { token, pin } = req.body;

    const salt = await bcrypt.genSalt(10);
    const encryptedPin = await bcrypt.hash(pin, salt);

    const user = await User.findOneAndUpdate(
      { pin_reset_token: token },
      {
        $set: {
          encryptedPin,
          pin_reset_token: null,
        },
      },
      {
        new: true,
      }
    );

    req.logIn(user, async (err) => {
      if (err) {
        throw err;
      }
      res.json({
        success: true,
        user,
      });
    });
  } catch (error) {
    throw error;
    res.status(500).json({
      success: false,
    });
  }
};

const updatePassword = async ({ userId, currentPassword, newPassword }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error("Current Password is not correct");
    }
    const salt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(newPassword, salt);

    let userFields = {
      password: encryptedPassword,
    };
    await User.findByIdAndUpdate(
      userId,
      {
        $set: userFields,
      },
      {
        new: true,
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const addBank = async ({ userId, accountHolder, bankName, accountNumber }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    let bankFields = {
      userId,
      accountHolder,
      bankName,
      accountNumber,
    };
    let bank = new Bank(bankFields);
    bank = await bank.save();
    return bank;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const editBank = async ({
  userId,
  bank_Id,
  accountHolder,
  bankName,
  accountNumber,
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    let bank = await Bank.findById(bank_Id);
    if (!bank) {
      throw new Error("Bank Account not found");
    }
    if (bank.userId.toString() !== userId.toString()) {
      throw new Error("Account doesn't belong to you");
    }
    let bankFields = {
      userId,
    };
    if (accountHolder) bankFields.accountHolder = accountHolder;
    if (bankName) bankFields.bankName = bankName;
    if (accountNumber) bankFields.accountNumber = accountNumber;
    bank = await Bank.findByIdAndUpdate(
      bank_Id,
      {
        $set: bankFields,
      },
      {
        new: true,
      }
    );
    return bank;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeBank = async ({ userId, bank_Id }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    let bank = await Bank.findById(bank_Id);
    if (!bank) {
      throw new Error("Bank Account not found");
    }
    if (bank.userId.toString() !== userId.toString()) {
      throw new Error("Account doesn't belong to you");
    }
    await Bank.findByIdAndRemove(bank_Id);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getBanks = async ({ userId }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    let banks = await Bank.find({ userId });
    return banks;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getExchanges = async ({ userId }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    let orders = await Order.find({ userId });
    return orders;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getSettings = async () => {
  try {
    const {
      BTC_ADDRESS,
      ETH_ADDRESS,
      USDT_ADDRESS,
      ACCOUNT_HOLDER_NAME,
      ACCOUNT_NUMBER,
      BANK_NAME,
      REFERRAL_ACTIVE,
      USDT_FEE,
      ETH_FEE,
      BTC_FEE,
      MIN_BUY_USD,
      MIN_BUY_NGN,
      REFERRAL_PERCENTAGE,
    } = settings[Enviroment];
    return {
      BTC_ADDRESS,
      ETH_ADDRESS,
      USDT_ADDRESS,
      ACCOUNT_HOLDER_NAME,
      ACCOUNT_NUMBER,
      BANK_NAME,
      REFERRAL_ACTIVE,
      USDT_FEE,
      ETH_FEE,
      BTC_FEE,
      MIN_BUY_USD,
      MIN_BUY_NGN,
      REFERRAL_PERCENTAGE,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getSwapRange = async ({ coinToSend, coinToRecieve }) => {
  const response = await Axios.get(`https://api.simpleswap.io/v1/get_ranges`, {
    params: {
      api_key: simpleSwapApiKey,
      fixed: true,
      currency_from: coinToSend === "USDT" ? "usdterc20" : coinToSend,
      currency_to: coinToRecieve === "USDT" ? "usdterc20" : coinToRecieve,
    },
  });
  const data = response.data;
  return data;
};

const createSwap = async ({
  userId,
  amount,
  coinToSend,
  pin,
  coinToRecieve,
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      throw new Error("Pin is not correct");
    }
    let address_to = "";
    if (coinToRecieve === "BTC") {
      // address_to = await getBtcAddress({ userId });
      address_to = "3DVdQ3v8f6aPoxzn2xxLm2wM52qnoKKR9i";
    } else if (coinToRecieve === "ETH") {
      address_to = await getETHAddress({ userId });
    } else if (coinToRecieve === "USDT") {
      address_to = await getETHAddress({ userId });
    }
    const _cointToSend = coinToSend === "USDT" ? "usdterc20" : coinToSend;

    const response = await Axios.post(
      `https://api.simpleswap.io/v1/create_exchange?api_key=${simpleSwapApiKey}`,
      {
        fixed: true,
        currency_from: _cointToSend,
        currency_to: coinToRecieve,
        amount,
        address_to,
      }
    );
    const data = response.data;
    // const addressToSend = data.address_from;
    const addressToSend = "0xEE1e511fcD9c2C03cFE672EA8a2A995E84a72375";
    const swapId = data.id;
    const amount_to = data.amount_to;
    const expected_amount = data.expected_amount;
    let transactionHx = "";
    if (coinToSend === "BTC") {
      transactionHx = await sendBTC({
        userId,
        recipientAddress: addressToSend,
        amount: expected_amount,
        pin,
      });
    } else if (coinToSend === "ETH") {
      transactionHx = await sendETH({
        userId,
        recipientAddress: addressToSend,
        amount: expected_amount,
        pin,
      });
    } else if (coinToSend === "USDT") {
      transactionHx = await sendUSDT({
        userId,
        recipientAddress: addressToSend,
        amount: expected_amount,
        pin,
      });
    }
    const swapFields = {
      userId,
      swapId,
      amountSent: expected_amount,
      coinSent: coinToSend,
      amountToRecieve: amount_to,
      coinRecieve: coinToRecieve,
    };
    let swap = new Swap(swapFields);
    swap = await swap.save();
    return { data, transactionHx };
  } catch (error) {
    throw error;
  }
};

const getSwaps = async ({ userId }) => {
  try {
    const swaps = await Swap.find({ userId });
    return swaps;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getNotifications = async ({ userId }) => {
  try {
    const notifications = await Notification.find({ userId });
    return notifications;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// ----- Need to be removed-----
const encryptPin = async ({ userId }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User Account not found");
    }
    const pin = user.pin;
    const salt = await bcrypt.genSalt(10);
    const encryptedPin = await bcrypt.hash(pin, salt);

    let userFields = {
      pin: encryptedPin,
    };
    await User.findByIdAndUpdate(
      userId,
      {
        $set: userFields,
      },
      {
        new: true,
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const generateReferralCode = async () => {
  try {
    const length = 8;
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let referralCode = "";
    let isCodeUnique = false;

    while (!isCodeUnique) {
      referralCode = "";
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        referralCode += characters[randomIndex];
      }

      const user = await User.findOne({ referralCode });
      if (!user) {
        isCodeUnique = true;
      }
    }
    return referralCode;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const generateWalletAddress = (req, res, next) => {
  const { wallet } = req.params;
  const user = req.user;
  const name = user.name;
  const passphrase = user.password;
  const userId = user._id;

  if (wallet === "Btc") {
    generateBtcWallet({
      name,
      passphrase,
      userId,
    });
  } else {
    generateETHWallet({ userId });
  }

  res.json({
    success: true,
  });
};

module.exports = {
  sendOTP,
  verifyEmail,
  addPin,
  updatePin,
  updateProfile,
  forgotPassword,
  login,
  logout,
  register,
  updatePassword,
  checkOTP,
  encryptPin,
  loginPin,
  addBank,
  editBank,
  removeBank,
  getBanks,
  getSettings,
  getExchanges,
  generateReferralCode,
  createSwap,
  getSwapRange,
  getSwaps,
  getNotifications,
  forgotPin,
  checkPinResetOTP,
  resetPin,
  generateWalletAddress,
};
