const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
const authRoutes = require('./routes/auth');
const dashboardRoutes = require("./routes/dashboardRoutes");
const amalanRoutes = require("./routes/amalanRoutes");
const halaqahRoutes = require("./routes/halaqahRoutes");
const laporanRoutes = require("./routes/laporanRoutes");
const profileRoutes = require("./routes/profileRoutes");
const wrappedRoutes = require("./routes/wrappedRoutes");
const postRoutes = require("./routes/postRoutes");

dotenv.config();
const app = express();

// Ambil daftar origin dari .env (comma-separated). Fallback ke default list jika kosong.
const defaultAllowedOrigins = [
  "http://localhost:3000",
  "https://haizumapp.com",
  "http://haizumapp.com",
  "https://www.haizumapp.com",
  "http://www.haizumapp.com",
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const effectiveAllowed = allowedOrigins.length ? allowedOrigins : defaultAllowedOrigins;

// Mendukung wildcard subdomain, contoh: https://*.haizumapp.com
function isOriginAllowed(origin, patterns) {
  if (!origin) return true; // non-browser clients
  try {
    const url = new URL(origin);
    const originExact = `${url.protocol}//${url.host}`;
    return patterns.some((pattern) => {
      if (pattern === "*") return true;
      // Exact match (dengan atau tanpa port)
      if (!pattern.includes("*")) {
        return origin === pattern || originExact === pattern;
      }

      // Wildcard support: https://*.domain.com atau *.domain.com
      let proto = null;
      let hostPattern = pattern;
      if (pattern.includes("://")) {
        const [p, rest] = pattern.split("://");
        proto = `${p}:`; // e.g. 'https:'
        hostPattern = rest;
      }
      if (proto && url.protocol !== proto) return false;
      if (hostPattern.startsWith("*.")) {
        const domain = hostPattern.slice(2); // 'haizumapp.com'
        return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
      }
      // pola wildcard lain tidak didukung: fallback exact
      return origin === pattern || originExact === pattern;
    });
  } catch (e) {
    // Jika parsing gagal, lakukan perbandingan sederhana
    return patterns.includes(origin);
  }
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin, effectiveAllowed)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
    res.send("RamadhanLog Backend Running!");
});
app.get("/api", (req, res) => {
    res.json({ message: "API is running!" });
  });
app.use('/api/auth', authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/amalan", amalanRoutes)
app.use("/api/halaqah", halaqahRoutes)
app.use("/api/laporan-tholib", laporanRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/wrapped", wrappedRoutes);
app.use("/api/post", postRoutes);

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`🚀 Server berjalan di http://localhost:${PORT}`));
