const express = require("express");
const { getProfile } = require("../controllers/profileController");
const { verifyToken } = require("../middlewares/authMiddleware");
const router = express.Router();

// Ambil daftar tholib berdasarkan filter nama/halaqah
router.get("/", verifyToken, getProfile);

module.exports = router;
