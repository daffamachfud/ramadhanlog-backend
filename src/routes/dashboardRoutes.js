const express = require("express");
const { getDashboardMurabbi, getDashboardTholib, getDashboardMurabbiReported, getDashboardMurabbiUnreported } = require("../controllers/dashboardController"); // ✅ Pastikan import benar
const { verifyToken, checkMurabbi, checkTholib } = require("../middlewares/authMiddleware");


const router = express.Router();

router.get("/murabbi", verifyToken, checkMurabbi, getDashboardMurabbi);
router.get("/tholib", verifyToken, checkTholib, getDashboardTholib);
router.get("/murabbi/reported", verifyToken, checkMurabbi, getDashboardMurabbiReported)
router.get("/murabbi/unreported", verifyToken, checkMurabbi, getDashboardMurabbiUnreported)
module.exports = router;
