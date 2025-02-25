const express = require("express");
const { getDashboardMurabbi } = require("../controllers/dashboardController"); // ✅ Pastikan import benar
const { verifyToken, checkMurabbi } = require("../middlewares/authMiddleware");


const router = express.Router();

router.get("/murabbi", verifyToken, checkMurabbi, getDashboardMurabbi);

module.exports = router;
