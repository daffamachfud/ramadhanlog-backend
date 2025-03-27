const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const { getRamadhanWrapped } = require("../controllers/wrappedController");

const router = express.Router();

// Endpoint untuk mencatat amalan harian
router.get("/get", verifyToken, getRamadhanWrapped)

module.exports = router;