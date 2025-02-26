const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes"); // Import authRoutes

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://haizumapp.com',
  'http://haizumapp.com',
  'https://www.haizumapp.com',
  'http://www.haizumapp.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true
}));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.listen(5001, () => {
  console.log("RamadhanLog Backend Running on port 5001");
});
// Gunakan route yang tersedia
app.use("/api/auth", authRoutes); // Semua route di authRoutes akan memiliki prefix "/api/auth"
app.get("/", (req, res) => {
  res.send("RamadhanLog Backend Running!");
});
// Endpoint utama (optional)
app.get("/api", (req, res) => {
  res.json({ message: "API is running!" });
});

module.exports = app;
