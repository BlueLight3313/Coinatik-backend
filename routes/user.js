const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const {
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
  generateWalletAddress
} = require("../controllers/user");
const { check, validationResult } = require("express-validator");
const {
  pinValidator,
  isAuthenticatedUser,
  getSocketId,
  connectedUsers,
} = require("../util/helper");
const { ObjectId } = mongoose.Types;

//@route    POST api/user/register
//@desc     Register a User
//@access   Public
router.post(
  "/register",
  [
    check("name", "Full Name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check("phoneNumber", "phoneNumber is required").not().isEmpty(),
    check("password", "Password is required").not().isEmpty(),
  ],
  register
);

//@route    POST api/user/login
//@desc     Login a User
//@access   Public
router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").not().isEmpty(),
  ],
  login
);

//@route    POST api/user/login
//@desc     Login a User
//@access   Public
router.post(
  "/loginPin",
  [
    check("email", "Please include a valid email").isEmail(),
    check("pin", "pin is required").not().isEmpty(),
    check("pin").custom(pinValidator),
  ],
  loginPin
);

//@route    GET api/user/logout
//@desc     Logout a User
//@access   Public
router.get("/logout", logout);

//@route    GET api/user/user
//@desc     GET user
//@access   Public
router.get("/user", isAuthenticatedUser, async (req, res) => {
  res.json({
    user: req.user
  });
});

//@route    GET api/user/sendOTP
//@desc     Send OTP to a user
//@access   Private
router.post("/sendOTP", async (req, res) => {
  try {
    const { email } = req.body;
    await sendOTP({ email });
    res.json({ msg: "OTP Successfully Sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/user/checkOTP
//@desc     Check OTP of a user
//@access   Private
router.post("/checkOTP", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const isCorrectOTP = await checkOTP({ email, otp });
    res.json({ isCorrectOTP });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/user/verify
//@desc     Verify an Email
//@access   Private
router.post("/verifyEmail", isAuthenticatedUser, async (req, res) => {
  try {
    const { otp } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const user = await verifyEmail({ userId, otp });
    res.json({ user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/user/addPin
//@desc     Add a Pin for a user account
//@access   Private
router.post(
  "/addPin",
  isAuthenticatedUser,
  [
    check("pin", "PIN must be 4 characters")
      .not()
      .isEmpty()
      .isLength({ min: 4, max: 4 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { pin } = req.body;
      const userIdStr = req.user._id;
      const userId = new ObjectId(userIdStr);
      const user = await addPin({ userId, pin });
      res.json({ user });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errorMsg: error.message });
    }
  }
);

//@route    POST api/user/updatePin
//@desc     update a Pin for a user account
//@access   Private
router.post(
  "/updatePin",
  isAuthenticatedUser,
  [
    check("currentPin").custom(pinValidator),
    check("newPin").custom(pinValidator),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { currentPin, newPin } = req.body;
      const userIdStr = req.user._id;
      const userId = new ObjectId(userIdStr);
      await updatePin({ userId, currentPin, newPin });
      res.json({ msg: "Pin Updated" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errorMsg: error.message });
    }
  }
);

//@route    POST api/user/updateProfile
//@desc     update a profile account
//@access   Private
router.post("/updateProfile", isAuthenticatedUser, async (req, res) => {
  try {
    const {
      name,
      userName,
      country,
      email,
      phoneNumber,
      image,
      currency,
      currencySymbol,
      language,
    } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const user = await updateProfile({
      userId,
      name,
      email,
      phoneNumber,
      image,
      userName,
      country,
      currency,
      currencySymbol,
      language,
    });
    res.json({ user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/user/forgotPassword
//@desc     Reset a Password
//@access   Private
router.post("/forgotpassword", async (req, res) => {
  try {
    const { otp, email, password } = req.body;
    await forgotPassword({
      otp,
      email,
      password,
    });
    res.json({ msg: "Password updated Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

router.post("/forgotPin", forgotPin);

router.post("/forgotPinVerify", checkPinResetOTP);

router.post("/resetPin", resetPin);

router.post("/wallet/:wallet/address/generate", isAuthenticatedUser, generateWalletAddress);

//@route    POST api/user/updatepassword
//@desc     update a user password
//@access   Private
router.post("/updatePassword", isAuthenticatedUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    await updatePassword({
      userId,
      currentPassword,
      newPassword,
    });
    res.json({ msg: "Password updated Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/user/addBank
//@desc     Add a Bank Account
//@access   Private
router.post(
  "/addBank",
  [
    check("accountHolder", "Account Holder Name is required").not().isEmpty(),
    check("bankName", "Bank Name is required").not().isEmpty(),
    check("accountNumber", "Account Number is required").not().isEmpty(),
  ],
  isAuthenticatedUser,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { accountHolder, bankName, accountNumber } = req.body;
      const userIdStr = req.user._id;
      const userId = new ObjectId(userIdStr);
      const bank = await addBank({
        userId,
        accountHolder,
        bankName,
        accountNumber,
      });
      res.json({ bank });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errorMsg: error.message });
    }
  }
);

//@route    POST api/user/editBank
//@desc     Edit a Bank Account
//@access   Private
router.post(
  "/editBank",
  [
    check("bankId", "Bank Id is required").not().isEmpty(),
    check("accountHolder", "Account Holder Name is required").not().isEmpty(),
    check("bankName", "Bank Name is required").not().isEmpty(),
    check("accountNumber", "Account Number is required").not().isEmpty(),
  ],
  isAuthenticatedUser,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { bankId, accountHolder, bankName, accountNumber } = req.body;
      const userIdStr = req.user._id;
      const userId = new ObjectId(userIdStr);
      const bank_Id = new ObjectId(bankId);
      const bank = await editBank({
        bank_Id,
        userId,
        accountHolder,
        bankName,
        accountNumber,
      });
      res.json({ bank });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errorMsg: error.message });
    }
  }
);

//@route    POST api/user/removeBank
//@desc     Remove a Bank Account
//@access   Private
router.post(
  "/removeBank",
  [check("bankId", "Bank Id is required").not().isEmpty()],
  isAuthenticatedUser,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { bankId } = req.body;
      const userIdStr = req.user._id;
      const userId = new ObjectId(userIdStr);
      const bank_Id = new ObjectId(bankId);
      await removeBank({
        bank_Id,
        userId,
      });
      res.json({ msg: "Bank was removed Successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errorMsg: error.message });
    }
  }
);

//@route    GET api/user/banks
//@desc     Get list of Banks
//@access   Private
router.get("/banks", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const banks = await getBanks({
      userId,
    });
    res.json({ banks });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/user/exchanges
//@desc     Get list of all buy and sells
//@access   Private
router.get("/exchanges", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const orders = await getExchanges({
      userId,
    });
    res.json({ orders });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/user/swapRange
//@desc     Min and Maximum for a coin that you can swap
//@access   Private
router.post("/swapRange", isAuthenticatedUser, async (req, res) => {
  try {
    const { coinToSend, coinToRecieve } = req.body;
    const range = await getSwapRange({
      coinToSend,
      coinToRecieve,
    });
    res.json({ range });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/user/createSwap
//@desc     Create a swap transaction
//@access   Private
router.post("/createSwap", isAuthenticatedUser, async (req, res) => {
  try {
    const { amount, coinToSend, coinToRecieve, pin } = req.body;
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const swap = await createSwap({
      userId,
      amount,
      coinToSend,
      coinToRecieve,
      pin,
    });
    res.json({ swap });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/user/swaps
//@desc     Get list of all Swaps
//@access   Private
router.get("/swaps", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const swaps = await getSwaps({
      userId,
    });
    res.json({ swaps });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/user/settings
//@desc     GET settings for a application for normal user
//@access   Private
router.get("/settings", isAuthenticatedUser, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    GET api/user/notifications
//@desc     Get list of all Notifications
//@access   Private
router.get("/notifications", isAuthenticatedUser, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const userId = new ObjectId(userIdStr);
    const notifications = await getNotifications({
      userId,
    });
    res.json({ notifications });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

module.exports = router;
