const express = require("express");
const { getHalaqahByMurabbi } = require("../controllers/halaqahController");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Endpoint untuk mencatat amalan harian
router.get("/murabbi", verifyToken, getHalaqahByMurabbi);

module.exports = router;