const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const cors = require("cors");
const uploadRoutes = require("./routes/upload");
const sseRoutes = require("./routes/sse");
const processRoutes = require("./routes/process");
const advancedRoutes = require("./routes/advanced");
const sseManager = require("./services/sseManager");

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Allowed origins (Netlify + Local)
const allowedOrigins = [
  "http://localhost:5173",
  "https://extraordinary-dieffenbachia-757a4c.netlify.app"
];

// ✅ Manual CORS middleware for full control
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Preflight check
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ✅ JSON and URL parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve frontend if needed (Netlify not using this)
app.use(express.static("dist"));

// ✅ API routes
app.use("/api", uploadRoutes);
app.use("/api", sseRoutes);
app.use("/api", processRoutes);
app.use("/api", advancedRoutes);

// ✅ Health check
app.get("/", (req, res) => {
  res.json({
    message: "Resume Analyzer API is running",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
});

// ✅ Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// ✅ Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down...`);
  sseManager.shutdown();
  server.close(() => {
    console.log("Server shut down gracefully.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forcing shutdown after timeout.");
    process.exit(1);
  }, 10000);
};

["SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"].forEach(signal => {
  process.on(signal, () => gracefulShutdown(signal));
});
