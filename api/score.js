export const config = { maxDuration: 60 };

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function pickTextFromOutputs(outputs) {
  if (!outputs || typeof outputs !== "object") return "";
  const keys = ["result", "answer", "text", "output", "summary", "content"];
  for (const key of keys) {
    if (typeof outputs[key] === "string" && outputs[key].trim()) return outputs[key];
  }
  return JSON.stringify(outputs, null, 2);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST method is allowed" });

  try {
    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing DIFY_API_KEY in Vercel Environment Variables." });
    }

    const { company_name, country_or_region, extra_notes } = req.body || {};
    if (!company_name || !country_or_region) {
      return res.status(400).json({ error: "company_name 和 country_or_region 是必填项" });
    }

    const difyResponse = await fetch("https://api.dify.ai/v1/workflows/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: {
          company_name,
          country_or_region,
          extra_notes: extra_notes || ""
        },
        response_mode: "streaming",
        user: "public-web-user"
      })
    });

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      return res.status(difyResponse.status).json(safeJsonParse(errorText) || { error: errorText });
    }

    if (!difyResponse.body) return res.status(500).json({ error: "Dify response body is empty" });

    const reader = difyResponse.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let finalOutputs = null;
    let finalText = "";
    let events = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;

        const jsonText = dataLine.replace(/^data:\s*/, "").trim();
        if (!jsonText || jsonText === "[DONE]") continue;

        const eventData = safeJsonParse(jsonText);
        if (!eventData) continue;

        events.push(eventData.event || "unknown");

        if (eventData.event === "error") {
          return res.status(500).json({
            error: eventData.message || eventData.data?.message || "Dify workflow error",
            detail: eventData
          });
        }

        if (eventData.event === "workflow_finished") {
          finalOutputs = eventData.data?.outputs || null;
          finalText = pickTextFromOutputs(finalOutputs);
        }

        if (eventData.event === "text_chunk" && eventData.data?.text) finalText += eventData.data.text;
        if (eventData.event === "message" && eventData.answer) finalText += eventData.answer;
      }
    }

    if (finalOutputs) {
      return res.status(200).json({
        ok: true,
        data: {
          outputs: finalOutputs,
          result: finalText
        }
      });
    }

    if (finalText.trim()) {
      return res.status(200).json({
        ok: true,
        data: {
          outputs: { result: finalText },
          result: finalText
        }
      });
    }

    return res.status(500).json({
      error: "Dify streaming finished, but no workflow result was found.",
      events
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
}
