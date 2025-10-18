const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// In-memory database
const registrations = [];

// Rate limiter: 5 requests per 15 minutes per IP
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 900,
});

app.post("/register", async (req, res) => {
  try {
    await rateLimiter.consume(req.ip);

    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    });

    const data = schema.parse(req.body);

    // Check for duplicate email
    const exists = registrations.find(r => r.email === data.email);
    if (exists) return res.status(409).json({ error: "Email already registered" });

    const newUser = {
      id: uuidv4(),
      name: data.name,
      email: data.email,
      status: "pending"
    };

    registrations.push(newUser);
    res.status(201).json({ message: "Registered successfully", user: newUser });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(429).json({ error: "Too many requests" });
  }
});

app.get("/registrations", (req, res) => {
  res.json(registrations);
});

app.put("/registrations/:id/approve", (req, res) => {
  const user = registrations.find(r => r.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.status = "approved";
  res.json({ message: "User approved", user });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
