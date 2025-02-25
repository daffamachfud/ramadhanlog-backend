const express = require("express");
const { getDashboardMurabbi, getDashboardTholib } = require("../controllers/dashboardController"); // ✅ Pastikan import benar
const { verifyToken, checkMurabbi, checkTholib } = require("../middlewares/authMiddleware");


const router = express.Router();

router.get("/murabbi", verifyToken, checkMurabbi, getDashboardMurabbi);
router.get("/tholib", verifyToken, checkTholib, getDashboardTholib);

module.exports = router;
