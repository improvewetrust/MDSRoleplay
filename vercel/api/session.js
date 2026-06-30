// Vercel serverless function — ออก ephemeral token สำหรับ OpenAI Realtime
// รันที่ภูมิภาคสหรัฐฯ (ค่าเริ่มต้นของ Vercel) -> egress เป็น US เสมอ
// แก้ปัญหา unsupported_country_region_territory ที่เจอตอนใช้ Cloudflare egress สุ่มประเทศ

const REALTIME_MODEL = "gpt-realtime";
const DEFAULT_VOICE = "cedar";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "https://improvewetrust.github.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "Not found" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY ยังไม่ถูกตั้งค่า" });

  const { instructions, voice, autoResponse } = req.body || {};

  const body = JSON.stringify({
    session: {
      type: "realtime",
      model: REALTIME_MODEL,
      instructions: instructions || "",
      audio: {
        input: {
          transcription: { model: "gpt-4o-transcribe", language: "th" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.62,
            prefix_padding_ms: 300,
            silence_duration_ms: 1000,
            create_response: autoResponse === false ? false : true,
          },
        },
        output: { voice: voice || DEFAULT_VOICE },
      },
    },
  });

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "OpenAI session error", detail: data });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
