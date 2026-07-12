import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";
import { Quiz } from "./models/Quiz.js";
import { Result } from "./models/Result.js";
import { Learning } from "./models/Learning.js";
import { StudyMaterial } from "./models/StudyMaterial.js";

dotenv.config();
dotenv.config({ path: "../.env" });

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

  // AI Routes
  app.post("/api/ai/generate-image", authenticate, async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not defined in backend env");
        return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
      }

      console.log("Generating image for prompt:", prompt);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              responseModalities: ["image"]
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini Image API response status:", response.status, "error:", errorText);
        return res.status(response.status).json({ error: `Gemini Image API error: ${errorText}` });
      }

      const data = await response.json();
      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData) {
        console.error("No image bytes returned in API response:", data);
        return res.status(500).json({ error: "No image bytes returned from Gemini Image API" });
      }

      res.json({ image: `data:${inlineData.mimeType};base64,${inlineData.data}` });
    } catch (err) {
      console.error("Failed to generate image:", err);
      res.status(500).json({ error: err.message });
    }
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

  // Study Material Routes
  app.get("/api/study-materials", authenticate, async (req, res) => {
    try {
      const { department } = req.query;
      const filter = {};
      if (department) filter.department = department;
      const materials = await StudyMaterial.find(filter).sort({ createdAt: -1 });
      res.json(materials);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/study-materials", authenticate, async (req, res) => {
    try {
      if (req.user.role !== 'STAFF' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Forbidden: Only Staff or Admin can upload study materials" });
      }
      const materialData = {
        ...req.body,
        uploadedBy: req.user.id,
        uploaderName: req.user.name,
      };
      const material = new StudyMaterial(materialData);
      await material.save();
      res.status(201).json(material);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/study-materials/:id", authenticate, async (req, res) => {
    try {
      const material = await StudyMaterial.findById(req.params.id);
      if (!material) return res.status(404).json({ error: "Material not found" });
      
      // Allow deletion if admin or the staff member who uploaded it
      if (req.user.role !== 'ADMIN' && material.uploadedBy.toString() !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to delete this material" });
      }

      await StudyMaterial.findByIdAndDelete(req.params.id);
      res.json({ message: "Study material deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });



  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
