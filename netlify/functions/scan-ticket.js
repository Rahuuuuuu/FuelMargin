// Required: set ANTHROPIC_API_KEY in Netlify dashboard
// Site settings → Environment variables → Add variable
// Key: ANTHROPIC_API_KEY  Value: your key from console.anthropic.com

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let image, mimeType;
  try {
    const body = JSON.parse(event.body);
    image = body.image;
    mimeType = body.mimeType || "image/jpeg";
  } catch {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }

  if (!image) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing image field" }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
    };
  }

  const systemPrompt = `You are reading a commercial truck scale ticket. Extract the axle weights and return them as JSON only — no explanation, no markdown, no preamble.

Return exactly this structure:
{
  "steer": { "value": number or null, "confidence": "high" | "medium" | "low" },
  "drives": { "value": number or null, "confidence": "high" | "medium" | "low" },
  "trailer": { "value": number or null, "confidence": "high" | "medium" | "low" }
}

Rules:
- All weights in pounds as whole numbers
- If the ticket shows tandem drive axles as a combined total, divide by 2 for the per-axle value and set confidence to "medium"
- If a value cannot be read clearly, set value to null and confidence to "low"
- Return only the JSON object — nothing else`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 256,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: image,
                },
              },
              {
                type: "text",
                text: "Extract the axle weights from this scale ticket.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error(`API returned ${response.status}`);
    }

    const apiData = await response.json();
    const rawText = apiData?.content?.[0]?.text?.trim();

    if (!rawText) throw new Error("Empty response from API");

    // Strip markdown fences if model wraps in them
    const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean);

    // Validate shape
    const result = {
      steer:   { value: parsed.steer?.value   ?? null, confidence: parsed.steer?.confidence   ?? "low" },
      drives:  { value: parsed.drives?.value  ?? null, confidence: parsed.drives?.confidence  ?? "low" },
      trailer: { value: parsed.trailer?.value ?? null, confidence: parsed.trailer?.confidence ?? "low" },
    };

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("scan-ticket error:", err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not read ticket" }),
    };
  }
};

/*
 Implemented items:
 1. POST handler accepting { image: base64, mimeType }
 2. Calls Anthropic Messages API using model claude-opus-4-5
 3. System prompt instructs JSON-only response with steer/drives/trailer + confidence
 4. Parses and validates response shape before returning
 5. Graceful error handling — 500 + { error } on failure
 6. CORS headers allowing requests from any origin
 7. OPTIONS preflight handled (204)
 8. ANTHROPIC_API_KEY env-var reminder at top of file
*/
