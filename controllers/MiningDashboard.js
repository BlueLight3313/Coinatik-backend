const UserSchema = require("../models/User");
const Miner = require('../models/Miner');

const MiningController = {
  async activeminer(req, res, next) {
    try {
      const { email } = req.query;

      const user = await UserSchema.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const hasActiveMiner = await Miner.find({ _id: { $in: user.minerIds } });

      res.json({ hasActiveMiner });
    } catch (error) {
      next(error);
    }
  },
  async minerprogress(req, res, next) {
    try {
      const { email, minerId } = req.query;

      const user = await UserSchema.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.minerIds || !user.minerIds.includes(minerId)) {
        return res.json({
          progress: 0,
          message: "User does not have an active miner",
        });
      }

      // Assuming miner_progress is a property of the Miner model, adjust it accordingly
      const miner = await Miner.findOne({ _id: minerId });

      if (!miner) {
        return res.status(404).json({ error: "Miner not found" });
      }

      res.json({ progress: miner.miner_progress });
    } catch (error) {
      next(error);
    }
  },
  async minerhistory(req, res, next) {
    try {
      const { email } = req.query;

      const user = await UserSchema.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const minerHistory = user.miner_history || [];

      res.json({ minerHistory });
    } catch (error) {
      next(error);
    }
  },
  async InstructionalVideo(req, res, next) {
    const videoUrl =
      "https://www.youtube.com/watch?v=4_C8J-d5O1Q&list=PLfAJSU55p-wtsa-Y2YgDGmyOA2tIvkWfm&index=28";

    // Redirect the client to the video URL
    res.redirect(videoUrl);
  },
  async TotalMinerRevenue(req, res, next) {
    try {
      const { minerId } = req.params;

      // Find the miner by ID
      const miner = await Miner.findById(minerId);

      if (!miner) {
        return res.status(404).json({ error: "Miner not found" });
      }

      // If the miner is rented, calculate revenue based on the rental duration
      if (miner.isRented && miner.rentalStartTime) {
        const currentTime = new Date();
        const rentalDurationInHours =
          (currentTime - miner.rentalStartTime) / (1000 * 60 * 60);
        const totalRevenue = rentalDurationInHours * miner.rentalRatePerHour;

        // Update the totalrevenu field in the Miner model
        miner.totalrevenu += totalRevenue;
        miner.rentalStartTime = currentTime; // Update the rental start time for future calculations
        await miner.save();

        res.json({ totalRevenue });
      } else {
        // Miner is not rented or rental information is missing
        res.json({ totalRevenue: miner.totalrevenu });
      }
    } catch (error) {
      // Pass the error to the error handling middleware
      next(error);
    }
  },
  async rentMiner(req, res, next) {
    try {
      const { minerId, userId } = req.params;
      const { duration } = req.body;
  
      // Find the miner by ID
      const miner = await Miner.findById(minerId);
  
      if (!miner) {
        return res.status(404).json({ error: "Miner not found" });
      }
  
      // Check if the miner is already rented
      if (miner.isRented) {
        return res.json({ success: false, message: "Miner is already rented" });
      }
  
      // Rent the miner
      miner.rentMiner(duration);
  
      // Save the updated miner details
      await miner.save();
  
      // Find the user by ID
      const user = await UserSchema.findById(userId);
  
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
  
      // Associate the rented miner with the user
      user.minerIds.push(miner._id);
  
      // Save the updated user details
      await user.save();
  
      // Set status to "rented" in the miner
      miner.status = "mining";
      await miner.save();
  
      res.json({ success: true, message: "Miner mining successfully" });
  
      // Set a timeout to check for the expiration of the rental duration
      setTimeout(async () => {
        // Check if the miner is still rented
        if (miner.isRented) {
          const currentTime = new Date();
          const rentalDurationInHours =
            (currentTime - miner.rentalStartTime) / (1000 * 60 * 60);
  
          // Assuming the miner's duration is in hours
          if (rentalDurationInHours >= miner.rentalDuration) {
            // Rental duration has expired
            miner.isRented = false;
            miner.rentalStartTime = null;
  
            // Save the updated miner details
            await miner.save();
  
            // Calculate the total revenue based on the mined coins and rate
            const totalRevenue =
              rentalDurationInHours * miner.rentalRatePerHour;
  
            // Add the miner to user's history
            user.miner_history.push(miner._id);
            await user.save();
  
            // Add the miner to miner's history with additional details
            miner.miner_history.push({
              coinMined: miner.miningcoin,
              expirationDate: currentTime,
              totalRevenueMined: totalRevenue,
            });
            await miner.save();
          }
        }
      }, miner.rentalDuration * 60 * 60 * 1000); // Set the timeout based on miner's duration in milliseconds
    } catch (error) {
      // Pass the error to the error handling middleware
      next(error);
    }
  }
,  
  async listAllAvailableMiner(req, res, next) {
    try {
      // Retrieve a list of all miners for admin view
      const allMiners = await Miner.find();
      res.json(allMiners);
    } catch (error) {
      next(error);
    }
  },
  async listAllMiner(req, res, next) {
    try {
      // Retrieve a list of all available miners
      const allMiners = await Miner.find({ isRented: false, isAvailable: true });
      res.json(allMiners);
    } catch (error) {
      next(error);
    }
  },
  
  async AddNewMiner(req, res, next) {
    try {
      const {
        minerName,//
        miningprob,//
        minduration,//
        miningprofit,//
        isAvailable,
        rentalRatePerHour//
      } = req.body;

      // Create a new miner
      const newMiner = new Miner({
        minerName,
        miningprob,
        minduration,
        miningprofit,
        isAvailable,
        rentalRatePerHour,
        // Add other fields as needed based on your schema
        totalFees:"",//
        cputemp:"78.9",//
        miningPower:"600",//
        totalmined: 0,
        miner_progress: 0,
        miner_history: [],
        graphdata: [],
        duration: 0,
      });

      // Save the new miner to the database
      await newMiner.save();

      res.json({ success: true, message: "Miner added successfully" });
    } catch (error) {
      // Pass the error to the error handling middleware
      next(error);
    }
  },

  async getUserById(req, res, next) {
    try {
      let  userId  = req.user._id;
  
      // Find the user by ID
      const user = await UserSchema.findById(userId);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      res.json({ user });
    } catch (error) {
      next(error);
    }
  },
  //router.get('/totalIncomeFromMiners')
  async totalMinerUsersWithPercentage(req, res, next) {
    try {
      const totalUsers = await UserSchema.countDocuments();
      const usersWithMiners = await UserSchema.countDocuments({ minerIds: { $gt: [] } });
    
      const percentage = (usersWithMiners / totalUsers) * 100;
  
      res.json({ totalUsersWithMiners: usersWithMiners, percentageOfUsersWithMiners: percentage });
    } catch (error) {
      next(error);
    }
  },
  // router.get('/weeklyIncomeFromMiners')
  async weeklyIncomeFromMiners(req, res, next) {
    try {
      // Calculate the start date for the current week
      const currentDate = new Date();
      const startOfWeek = new Date(currentDate);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  
      // Retrieve all miners
      const allMiners = await Miner.find();
  
      // Calculate total income for the current week
      let totalIncome = 0;
  
      allMiners.forEach((miner) => {
        miner.miner_history.forEach((history) => {
          if (
            history.expirationDate >= startOfWeek &&
            history.expirationDate <= currentDate
          ) {
            totalIncome += history.totalRevenueMined || 0;
          }
        });
      });
  
      res.json({ totalIncome });
    } catch (error) {
      next(error);
    }
  },
  //router.put('/miners/:minerId/changeAvailability)
  async changeAvailability(req,res){
    try {
      const { minerId } = req.params;
      const { isAvailable } = req.body;
  
      // Find the miner by ID
      const miner = await Miner.findById(minerId);
  
      if (!miner) {
        return res.status(404).json({ error: 'Miner not found' });
      }
  
      // Update isAvailable status
      miner.isAvailable = isAvailable;
  
      // Save the updated miner details
      await miner.save();
  
      res.json({ success: true, message: 'isAvailable status updated successfully' });
    } catch (error) {
      next(error);
    }
  },
  //router.put('/miners/:minerId/edit')
  async editminner(req,res){
    try {
      const { minerId } = req.params;
      const { rentalRatePerHour, miningProfit,minerName,miningprob,isAvailable,minduration } = req.body;
  
      // Find the miner by ID
      const miner = await Miner.findById(minerId);
  
      if (!miner) {
        return res.status(404).json({ error: 'Miner not found' });
      }
  
      // Update miner details
      miner.rentalRatePerHour = rentalRatePerHour;
      miner.miningProfit = miningProfit;
      miner.minduration = minduration;
      miner.minerName = minerName;
      miner.miningprob = miningprob;
      miner.isAvailable = isAvailable;

  
      // Save the updated miner details
      await miner.save();
  
      res.json({ success: true, message: 'Miner details updated successfully' });
    } catch (error) {
      next(error);
    }
  },
  //router.delete('/miners/:minerId/delete')
  async deleteminner(req,res) {
    try {
      const { minerId } = req.params;
  
      // Find the miner by ID and delete it
      const result = await Miner.deleteOne({ _id: minerId });
  
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Miner not found' });
      }
  
      res.json({ success: true, message: 'Miner deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
};

module.exports = MiningController;
