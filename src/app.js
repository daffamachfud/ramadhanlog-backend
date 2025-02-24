const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes"); // Import authRoutes

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Gunakan route yang tersedia
app.use("/api/auth", authRoutes); // Semua route di authRoutes akan memiliki prefix "/api/auth"

// Endpoint utama (optional)
app.get("/api", (req, res) => {
  res.json({ message: "API is running!" });
});

module.exports = app;
