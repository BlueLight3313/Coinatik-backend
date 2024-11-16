const express = require("express");
const router = express.Router();
const { isAuthenticatedUser } = require("../util/helper");

const MiningController = require("../controllers/MiningDashboard");

router.get(
  "/activeMiner",
  MiningController.activeminer
);
router.get(
  "/miner-progress",
  isAuthenticatedUser,
  MiningController.minerprogress
);
router.get(
  "/minerHistory",
  MiningController.minerhistory
);
router.get("/bitcoin-instruction-video", MiningController.InstructionalVideo);

router.get(
  "/miners/:minerId/revenue",
  isAuthenticatedUser,
  MiningController.TotalMinerRevenue
);
router.post(
  "/:minerId/:userId/rent",
  MiningController.rentMiner
);
router.get("/allMiners", isAuthenticatedUser, MiningController.listAllMiner);

router.get("/allAdminMiners",MiningController.listAllAvailableMiner);

router.get("/minerUsers",MiningController.totalMinerUsersWithPercentage);

router.get("/weeklyIncome",MiningController.weeklyIncomeFromMiners);

router.put("/:minerId/changeActive",MiningController.changeAvailability);

router.put("/:minerId/editMiner",MiningController.editminner);

router.delete("/:minerId/deleteMiner",MiningController.deleteminner)

router.post("/addMiner",MiningController.AddNewMiner)

router.get("/me", isAuthenticatedUser, MiningController.getUserById);


module.exports = router;