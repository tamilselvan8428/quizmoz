import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";
import { Quiz } from "./models/Quiz.js";
import { Result } from "./models/Result.js";
import { Learning } from "./models/Learning.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment variables");
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }));
  app.use(express.json({ limit: '50mb' })); // For base64 images

  // MongoDB Connection
  mongoose.connect(MONGODB_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      // Seed default admin if no users exist
      const adminCount = await User.countDocuments({ role: 'ADMIN' });
      if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        const admin = new User({
          name: "System Admin",
          rollNo: "admin",
          password: hashedPassword,
          role: "ADMIN",
          department: "System"
        });
        await admin.save();
        console.log("Default admin created: admin / admin123");
      }
    })
    .catch(err => console.error("MongoDB connection error:", err));

  // Auth Middleware
  const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, rollNo, password, role, department, section, batch } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, rollNo, password: hashedPassword, role, department, section, batch });
      await user.save();
      res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { rollNo, password } = req.body;
      const user = await User.findOne({ rollNo });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET);
      res.json({ token, user: { id: user._id, name: user.name, rollNo: user.rollNo, role: user.role, department: user.department, section: user.section } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // User Routes
  app.get("/api/users", authenticate, async (req, res) => {
    try {
      const users = await User.find().select("-password");
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", authenticate, async (req, res) => {
    try {
      if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Forbidden" });
      await User.findByIdAndDelete(req.params.id);
      res.json({ message: "User deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id/password", authenticate, async (req, res) => {
    try {
      if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Forbidden" });
      const { password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
      res.json({ message: "Password updated successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/profile", authenticate, async (req, res) => {
    try {
      const { name, rollNo, department, section, batch, password } = req.body;
      const updateData = { name, rollNo, department, section, batch };
      
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true }
      ).select("-password");
      
      res.json({
        id: user._id,
        name: user.name,
        rollNo: user.rollNo,
        role: user.role,
        department: user.department,
        section: user.section,
        batch: user.batch
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Quiz Routes
  app.get("/api/quizzes", authenticate, async (req, res) => {
    try {
      const quizzes = await Quiz.find();
      res.json(quizzes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/quizzes", authenticate, async (req, res) => {
    try {
      const quizData = { ...req.body, createdBy: req.user.id };
      const quiz = new Quiz(quizData);
      await quiz.save();
      res.status(201).json(quiz);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/quizzes/:id", authenticate, async (req, res) => {
    try {
      const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(quiz);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/quizzes/:id", authenticate, async (req, res) => {
    try {
      await Quiz.findByIdAndDelete(req.params.id);
      res.json({ message: "Quiz deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Result Routes
  app.get("/api/results", authenticate, async (req, res) => {
    try {
      const results = await Result.find();
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/results", authenticate, async (req, res) => {
    try {
      const resultData = { ...req.body, studentId: req.user.id };
      const result = new Result(resultData);
      await result.save();
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/results/:id", authenticate, async (req, res) => {
    try {
      const result = await Result.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Learning Routes
  app.get("/api/learning", authenticate, async (req, res) => {
    try {
      const { studentId } = req.query;
      const sessions = await Learning.find({ studentId });
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/learning", authenticate, async (req, res) => {
    try {
      const { _id, ...data } = req.body;
      let session;
      if (_id) {
        session = await Learning.findByIdAndUpdate(_id, { ...data, lastUpdatedAt: new Date() }, { new: true });
      } else {
        session = new Learning({ ...data, studentId: req.user.id });
        await session.save();
      }
      res.json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/learning/:id", authenticate, async (req, res) => {
    try {
      await Learning.findByIdAndDelete(req.params.id);
      res.json({ message: "Session deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.join(__dirname, "../frontend"),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "../dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
