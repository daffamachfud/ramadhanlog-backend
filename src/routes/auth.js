const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Register (Jangan pakai middleware autentikasi)
router.post('/register', authController.register);

// Login (Jangan pakai middleware autentikasi)
router.post('/login', authController.login);

module.exports = router;
