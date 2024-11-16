const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const settings = require("./config/settings.json");
const Enviroment = settings.env;
const { USDTAddress } = require("./constants/tokens");
const ERC20ABI = require("./constants/ERC20ABI.json");
const { Web3 } = require("web3");
const infuraAPIkey = settings[Enviroment].INFURA_API;
const web3 = new Web3(infuraAPIkey);
require("dotenv").config();
const cors = require("cors");
const connectDB = require("./config/db");
const session = require("express-session");
const MemoryStore = require('memorystore')(session)
const cookieParser = require("cookie-parser");
const passport = require("passport");
const MongoStore = require('connect-mongo');
const IntializePassport = require("./config/passport");
const { error } = require("console");
const { usdtNotification } = require("./controllers/usdt");
const { connectSocket, disconnectSocket } = require("./util/helper");
const secret = settings[Enviroment].SESSION_SECRET;
const PORT =  process.env.PORT || 3005;
const usdtContract = new web3.eth.Contract(ERC20ABI, USDTAddress);
const FileStore = require('session-file-store')(session);

// Connect to Database
connectDB();
// Middleware
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(
  cors({
    credentials: true,
    origin: ['https://admin.coinatik.com', 'https://api.coinatik.com', 'https://coinatik.com','http://localhost:3001', 'http://localhost:5174'],
  })
);

const io = new Server(server, {
  cors: {
    origin: ['https://admin.coinatik.com', 'https://api.coinatik.com', 'https://coinatik.com','http://localhost:3001', 'http://localhost:5174'],
    methods: ["GET", "POST"],
    credentials: true,
  },
});


app.use((req, res, next) => {
  req.io = io;
  return next();
});


app.use(
  session({
    // cookie:{ 
    //   secure:false,
    //   sameSite:"none",
    //   maxAge: 8640000 },
    secret,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: settings.env === 'test' ? settings.test.MONGO_URI : settings.prod.MONGO_URI }),
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000, // Example: 14 days for "Remember Me" functionality
      httpOnly: false,
      secure: false, // Set to true in production if using HTTPS
      sameSite: 'lax' // Can adjust based on your requirements
    }
  })
);

// app.use((req, res, next) => {
//   res.append('Access-Control-Expose-Headers', 'Set-Cookie');
//   next();
// });

// passport.use(new RememberMeStrategy(
//   function(token, done) {
//     Token.consume(token, function (err, user) {
//       if (err) { return done(err); }
//       if (!user) { return done(null, false); }
//       return done(null, user);
//     });
//   },
//   function(user, done) {
//     var token = utils.generateToken(64);
//     Token.save(token, { userId: user.id }, function(err) {
//       if (err) { return done(err); }
//       return done(null, token);
//     });
//   }
// ));

app.use(cookieParser(secret));
app.use(passport.initialize());
app.use(passport.session());
IntializePassport(passport);
// app.use(passport.authenticate('remember-me'));
// Intialize passport
//Define Routes
app.get("/",(req,res) => {
  res.json("HELLO")
})

app.use("/api/btc", require("./routes/btc"));
app.use("/api/eth", require("./routes/eth"));
app.use("/api/usdt", require("./routes/usdt"));
app.use("/api/user", require("./routes/user"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/miner", require("./routes/Minner"));
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Run when client connects
// io.on("connection", (socket) => {
//   console.log("Socket connected:" + socket.id);
//   socket.on("connectUser", ({ id }) => {
//     try {
//       const userId = id.toString();
//       const socketId = socket;
//       socket.join(userId);
//       connectSocket({ userId, socketId });
//       console.log("Connected Socket Id=" + socket.id);
//     } catch (error) {
//       console.error("Error Connecnting :", error);
//     }
//   });
//   socket.on("sendMessage", ({ id, message }) => {
//     try {
//       console.log("message=" + message);
//       const userId = id.toString();
//       socket.join(userId);
//       io.to(userId).emit("message", message);
//     } catch (error) {
//       console.error("Error Connecnting :", error);
//     }
//   });
//   socket.on("disconnect", () => {
//     const socketId = socket.id;
//     disconnectSocket({ socketId });
//   });
// });
