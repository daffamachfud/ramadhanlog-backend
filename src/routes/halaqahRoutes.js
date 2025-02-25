const express = require("express");
const { getHalaqahByMurabbi, addHalaqah } = require("../controllers/halaqahController");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Endpoint untuk mencatat amalan harian
router.get("/murabbi", verifyToken, getHalaqahByMurabbi);
router.post("/add", verifyToken, addHalaqah);

module.exports = router;