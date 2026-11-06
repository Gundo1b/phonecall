
import express from "express";
import cors from "cors";
import "dotenv/config";
import { AccessToken } from "livekit-server-sdk";

const app = express();

app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173",
}));

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Local development only: no authenticated identities yet.
app.post("/api/call-token", async (req, res) => {
  try {
    const { callerId, contactId } = req.body;

    if (
      !UUID_PATTERN.test(callerId || "") ||
      !UUID_PATTERN.test(contactId || "") ||
      callerId === contactId
    ) {
      return res.status(400).json({
        error: "Invalid participant IDs",
      });
    }

    const roomName =
      "call-" + [callerId, contactId].sort().join("-");

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: callerId,
        ttl: "15m",
      }
    );

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    const jwt = await token.toJwt();

    res.json({
      token: jwt,
      serverUrl: process.env.LIVEKIT_URL,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Could not create a call token",
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Voice Chat Server is running",
    livekit: "Ready",
  });
});

app.listen(3001, "127.0.0.1", () => {
  console.log("Voice call server running on port 3001");
});
