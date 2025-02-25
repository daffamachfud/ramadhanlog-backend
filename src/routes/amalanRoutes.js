const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const { catatAmalanHarian, getAllAmalan, getAmalanHarian} = require("../controllers/amalanController");

const router = express.Router();

// Endpoint untuk mencatat amalan harian
router.post("/amalan-harian", verifyToken, catatAmalanHarian);
router.get("/get", verifyToken, getAllAmalan);
router.get("/harian", verifyToken, getAmalanHarian)

module.exports = router;