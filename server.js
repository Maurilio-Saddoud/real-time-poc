const express = require("express");
require("dotenv").config();
const path = require("path");
const app = express();

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// An endpoint which would work with the client code above - it returns
// the contents of a REST API request to this protected endpoint
app.get("/session1", async (req, res) => {
  try {
    const fetch = (await import("node-fetch")).default;
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-realtime-preview-2024-12-17",
        voice: "verse",
        instructions:
          "You are a friendly Pirate. Feel free to keep responding after each new statement",
      }),
    });
    const data = await r.json();

    // Send back the JSON we received from the OpenAI REST API
    res.send(data);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch session data" });
  }
});

app.get("/session2", async (req, res) => {
  try {
    const fetch = (await import("node-fetch")).default;
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-realtime-preview-2024-12-17",
        voice: "sage",
        instructions:
          "You are a wise wizard. Feel free to keep responding after each new statement"
      }),
    });
    const data = await r.json();

    // Send back the JSON we received from the OpenAI REST API
    res.send(data);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch session data" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
