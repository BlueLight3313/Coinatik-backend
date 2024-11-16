const generateRandomCode = () => {
  const min = 1000;
  const max = 9999;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code;
};

const pinValidator = (value, { req }) => {
  if (!/^\d{4}$/.test(value)) {
    throw new Error("PIN must be exactly 4 digits long and numeric");
  }
  return true;
};

const isAuthenticatedUser = (req, res, next) => {
  console.log('user-local:', req.isAuthenticated('user-local'));
  console.log('admin-local:', req.isAuthenticated('admin-local'));

  if (
    req.isAuthenticated('user-local') ||
    (req.isAuthenticated('admin-local'))
  ) {
    return next();
  } else {
    return res.status(401).json({ errorMsg: 'Unauthorized Access' });
  }
};




const isAuthenticatedAdmin = (req, res, next) => {
  
  console.log('admin-local:', req.isAuthenticated('admin-local'));

  if (req.isAuthenticated("admin-local")) {
    return next();
  } else {
    return res
      .status(401)
      .json({ errorMsg: "Unauthorized Access: Admin Access Only" });
  }
};

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const allowedOrderStatus = ["pending", "confirming", "completed", "rejected"];

const allowedEnvs = ["test", "prod"];

const connectedUsers = {};

const connectSocket = ({ userId, socketId }) => {
  console.log("userId=" + userId);
  console.log("socketId=" + socketId);
  connectedUsers[userId] = socketId;
};

const getSocketId = ({ userId }) => {
  const socketId = connectedUsers[userId];
  return socketId;
};

const disconnectSocket = ({ socketId }) => {
  const userId = Object.keys(connectedUsers).find(
    (key) => connectedUsers[key] === socketId
  );
  if (userId) {
    delete connectedUsers[userId];
    console.log(`User ${userId} disconnected.`);
  }
};

module.exports = {
  generateRandomCode,
  pinValidator,
  isAuthenticatedUser,
  isAuthenticatedAdmin,
  daysOfWeek,
  allowedOrderStatus,
  allowedEnvs,
  connectSocket,
  disconnectSocket,
  getSocketId,
  connectedUsers,
};
