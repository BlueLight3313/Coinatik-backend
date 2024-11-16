const User = require("../models/User");
const bcrypt = require("bcryptjs");
const localStrategy = require("passport-local").Strategy;

const IntializePassport = function (passport) {
  // Local strategy for regular users
  passport.use(
    "user-local",
    new localStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await User.findOne({ email: email });
          if (!user) {
            return done(null, false, {
              message: "No user found with this email address",
            });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password" });
          }
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  // Local Strategy for users with email and pin
  passport.use(
    "user-pin",
    new localStrategy(
      { usernameField: "email", passwordField: "pin" },
      async (email, pin, done) => {
        try {
          const user = await User.findOne({ email: email });
          if (!user) {
            return done(null, false, {
              message: "No user found with this email address",
            });
          }
          if (!user.pin) {
            return done(null, false, {
              message: "No PIN found for this user",
            });
          }
          
          // Assuming PIN is stored in the database as user.pin
          const isMatch = await bcrypt.compare(pin, user.pin);
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect PIN" });
          }
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Local strategy for admin users
  passport.use(
    "admin-local",
    new localStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await User.findOne({ email: email });
          if (!user) {
            return done(null, false, {
              message: "No Admin found with this email address",
            });
          }

          if (!user.isAdmin) {
            return done(null, false, {
              message: "Admin Access is required",
            });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password" });
          }
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialize and deserialize user functions remain the same
  passport.serializeUser((user, cb) => {
    cb(null, user.id);
  });

  passport.deserializeUser(async (id, cb) => {
    try {
      const user = await User.findOne({ _id: id });
      return cb(null, user);
    } catch (error) {
      return cb(error);
    }
  });
};

module.exports = IntializePassport;
