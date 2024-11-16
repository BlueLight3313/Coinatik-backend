const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { check, validationResult } = require("express-validator");
const {
  register,
  login,
  checkOTP,
  getUsers,
  updateOrder,
  getOrders,
  updateSettings,
  updateEnv,
} = require("../controllers/admin");
const { logout, updateProfile } = require("../controllers/user");
const { isAuthenticatedAdmin } = require("../util/helper");
const { ObjectId } = mongoose.Types;
const fs = require("fs");
const path = require('path');
let settings = require("../config/settings.json");
const Enviroment = settings.env;

//@route    POST api/admin/register
//@desc     Register an admin
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

//@route    POST api/admin/login
//@desc     Login admin
//@access   Public
router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").not().isEmpty(),
  ],
  login
);

router.post(
  "/checkOtp",
  [
    check("email", "Please include a valid email").isEmail(),
    check("code", "Code is required").not().isEmpty(),
  ],
  checkOTP
);

//@route    GET api/admin/logout
//@desc     Logout admin
//@access   Public
router.get("/logout", logout);

//@route    GET api/admin/user
//@desc     GET user
//@access   Public
router.get("/user", isAuthenticatedAdmin, async (req, res) => {
  res.json({
    user: req.user,
  });
});

//@route    POST api/admin/getUsers
//@desc     Get all users
//@access   Private
router.get("/getUsers", isAuthenticatedAdmin, async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/admin/updateUserProfile
//@desc     Update a user profile
//@access   Private
router.post("/updateUserProfile", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { userId, name, email, phoneNumber, image } = req.body;
    const user_id = new ObjectId(userId);
    const user = await updateProfile({
      userId: user_id,
      name,
      email,
      phoneNumber,
      image,
    });
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/admin/getOrders
//@desc     Get all Orders
//@access   Private
router.get("/getOrders", isAuthenticatedAdmin, async (req, res) => {
  try {
    const orders = await getOrders();
    res.json({ orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/admin/updateOrder
//@desc     Update an Order
//@access   Private
router.post("/updateOrder", isAuthenticatedAdmin, async (req, res) => {
  try {
    const userIdStr = req.user._id;
    const adminId = new ObjectId(userIdStr);
    const { orderId, status, message, pin } = req.body;
    const order_id = new ObjectId(orderId);
    const io = req.io;
    const order = await updateOrder({
      adminId,
      orderId: order_id,
      status,
      message,
      pin,
      io,
    });
    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/admin/updateSettings
//@desc     Update Settings for applications
//@access   Private
router.post("/updateSettings", isAuthenticatedAdmin, async (req, res) => {
  try {
    const dataObj = req.body;
    await updateSettings(dataObj);
    res.json({ msg: "Settings Updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

//@route    POST api/admin/updateEnv
//@desc     Update Enviroment
//@access   Private
router.post("/updateEnv", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { env } = req.body;
    await updateEnv({ env });
    console.log("Environment updated successfully");
    res.status(200).json({ msg: "Environment updated successfully", env });
  } catch (error) {
    console.error(error);
    res.status(500).json({ errorMsg: error.message });
  }
});


const getSettings = async () => {
  try {
    const filePath = path.join(__dirname, "../config/settings.json");
    const rawData = fs.readFileSync(filePath);
    const jsonData = JSON.parse(rawData);
    return jsonData;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

//@route    GET api/user/settings
//@desc     GET settings for a application for normal user
//@access   Private
router.get("/settings", isAuthenticatedAdmin, async (req, res) => {
  try {
    let new_settings = await getSettings();
    console.log(new_settings)
    res.status(200).json({ settings: new_settings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMsg: error.message });
  }
});

module.exports = router;
