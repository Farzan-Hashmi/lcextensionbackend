import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import { existsSync } from "fs";
// If you are on Node < 18, you might need: import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow iframe embedding (including Chrome extensions)
app.use((req, res, next) => {
  // Remove X-Frame-Options to allow framing
  res.removeHeader("X-Frame-Options");
  // Don't set frame-ancestors - it blocks Chrome extensions
  // The extension's host_permissions handle the security
  next();
});

const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY;
const MOCHI_API_KEY = process.env.MOCHI_API_KEY;

const openai = new OpenAI({
  apiKey: CHATGPT_API_KEY,
});

// API Routes - must be defined before static file serving
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// ---------------------------------------------------------
// Manual Schema Definition (Without Zod)
// ---------------------------------------------------------
const manualJsonSchema = {
  name: "code_solution_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      solutionExplanation: {
        type: "string",
        description: "The solution and explanation text",
      },
      code: {
        type: "string",
        description: "The code block portion only",
      },
    },
    required: ["solutionExplanation", "code"],
    additionalProperties: false,
  },
};

async function generateCodeResponse(message) {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content:
          "Please separate the solution/explanation and the code in the following message: I want to be able to later paste the code in a markdown editor. For the explanation, keep it minimal. Only adjust my explanation for readability purposes. Don't add anything additional to the explanation." +
          message,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: manualJsonSchema,
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No content returned");

  return JSON.parse(content);
}

async function generateProblemDescription(description) {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content:
          "The following text is a description of a problem that is slightly misformatted. All that I need you to do is clean up the formatting of the text so I can paste it in a markdown editor. Put the examples and constraints in seperate markdown blocks (by seperate I mean split the examples into their own markdown blocks). There will be irrelevant text that comes up because I copy pasted the entire site. You can remove that text that seems like it was copy-pasted on accident. Just bold the title of the problem (don't use any # or header markdown things). DO NOT modify anything else including the actualy words themselves or anything else. JUST focus on formatting. Also if the contraint is seemingly a random number like 104 or 103 or something it could actually be 10^4 or 10^3. When I copy and paste the exponents are removed so that's why they appear like that." +
          description,
      },
    ],
  });
  return response.choices[0]?.message?.content;
}

// ---------------------------------------------------------
// Helper: Create Mochi Flashcard
// ---------------------------------------------------------
async function createMochiCard(
  problemDescription,
  solutionExplanation,
  codeSnippet
) {
  if (!MOCHI_API_KEY) {
    console.warn("Skipping Mochi card creation: MOCHI_API_KEY is missing.");
    return null;
  }

  const DECK_ID = "QKtBzxLx";
  const url = "https://app.mochi.cards/api/cards/";

  // Format the content: Solution Code inside a Markdown block
  const cardContent =
    "What is the key techinque to solve this problem?\n" +
    problemDescription +
    "\n---\n" +
    solutionExplanation +
    "\n" +
    "```python\n" +
    codeSnippet +
    "\n```";

  // Mochi uses Basic Auth with the API Key as the username
  const auth = Buffer.from(`${MOCHI_API_KEY}:`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      content: cardContent,
      "deck-id": DECK_ID,
      "archived?": false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mochi API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

app.post("/api/data", async (req, res) => {
  try {
    const { message, description } = req.body;
    if (!message || !description) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Immediately return success response
    res.json({
      status: "submitted",
      message: "Now processing",
    });

    // Process in the background (fire and forget)
    (async () => {
      try {
        // 1. Get structured answer from OpenAI
        const [problemDescription, solutionExplanationAndCode] =
          await Promise.all([
            generateProblemDescription(description),
            generateCodeResponse(message),
          ]);

        const result = {
          problemDescription,
          solutionExplanation: solutionExplanationAndCode.solutionExplanation,
          code: solutionExplanationAndCode.code,
        };

        // 2. Create the Flashcard in Mochi automatically using the code portion
        console.log("Creating Mochi card...");
        const mochiCard = await createMochiCard(
          problemDescription,
          result.solutionExplanation,
          result.code
        );

        if (mochiCard) {
          console.log(`✅ Card created in Mochi: ${mochiCard.id}`);
        }

        console.log("✅ Processing completed successfully");
      } catch (error) {
        console.error("Error in background processing:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Error details:", errorMessage);
      }
    })();
  } catch (error) {
    console.error("Error handling request:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({
      error: "Failed to submit request",
      details: errorMessage,
    });
  }
});

// Serve static files from React app build directory
const buildPath = path.join(__dirname, "..", "frontend", "dist");
console.log(`Looking for frontend build at: ${buildPath}`);

if (existsSync(buildPath)) {
  console.log(`✅ Frontend build found at ${buildPath}`);
  app.use(express.static(buildPath));

  // Catch all handler
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  console.warn(`⚠️  Frontend build directory not found at ${buildPath}`);
  console.warn(
    "⚠️  API endpoints will still work, but frontend will not be served"
  );

  // Still handle API routes
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.status(503).json({
      error: "Frontend not built",
      message: "Please build the frontend first: cd frontend && npm run build",
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
