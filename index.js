const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { SerialPort } = require("serialport");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SERIAL_PATH = process.env.SERIAL_PORT || "/dev/cu.usbserial-5B0C1058611";
const BAUD_RATE = 115200;
const MONGODB_URI = process.env.MONGODB_URI;
const stressDataSchema = new mongoose.Schema(
  {
    pulse_value: { type: Number, required: true },
    heart_rate: { type: Number, required: true },
    temperature: { type: Number, required: true },
    stress: { type: String, required: true },
  },
  { timestamps: true }
);

const StressData = mongoose.model("StressData", stressDataSchema);

async function connectMongo() {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is not set. Add it in your environment.");
    }
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
}

function setupSerial() {
  const serialPort = new SerialPort({
    path: SERIAL_PATH,
    baudRate: BAUD_RATE,
    autoOpen: true,
  });

  let buffer = "";

  serialPort.on("open", () => {
    console.log(`Serial port opened: ${SERIAL_PATH} @ ${BAUD_RATE}`);
  });

  serialPort.on("error", (error) => {
    console.error("Serial port error:", error.message);
  });

  serialPort.on("data", async (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const payload = JSON.parse(trimmed);

        if (
          typeof payload.pulse_value !== "number" ||
          typeof payload.heart_rate !== "number" ||
          typeof payload.temperature !== "number" ||
          typeof payload.stress !== "string"
        ) {
          console.warn("Invalid payload shape, skipping:", trimmed);
          continue;
        }

        await StressData.create(payload);
        console.log("Saved sensor data:", payload);
      } catch (error) {
        console.warn("Failed to parse/save serial JSON:", trimmed, error.message);
      }
    }
  });
}

app.get("/data", async (req, res) => {
  try {
    const records = await StressData.find().sort({ createdAt: -1 }).limit(20);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.get("/", (req, res) => {
  res.json({ message: "IOT Stress Prediction backend is running" });
});

async function startServer() {
  await connectMongo();
  setupSerial();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
