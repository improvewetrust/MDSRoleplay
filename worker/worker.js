// Cloudflare Worker — backend for MDS Voice Roleplay
// เก็บ OPENAI_API_KEY ไว้ฝั่งนี้เท่านั้น (อย่าวางใน frontend ที่เป็น public repo)
//
// 2 endpoints:
//   POST /session  { instructions, voice }  -> ออก ephemeral token สำหรับ OpenAI Realtime (WebRTC)
//   POST /score    { rubric, transcript }   -> ส่ง transcript เข้าโมเดลให้คะแนนตามเกณฑ์
//
// ตั้งค่า secret:  wrangler secret put OPENAI_API_KEY
// จำกัด origin:    ตั้ง env var ALLOW_ORIGIN = "https://improvewetrust.github.io" (แนะนำ)

const REALTIME_MODEL = "gpt-realtime";
const SCORING_MODEL = "gpt-4o";
const DEFAULT_VOICE = "alloy";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(env);
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY ยังไม่ถูกตั้งค่าใน Worker" }, 500);

    try {
      // ---- ออก ephemeral token สำหรับ Realtime (GA: /v1/realtime/client_secrets) ----
      if (url.pathname === "/session" && req.method === "POST") {
        const { instructions, voice } = await req.json();
        const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session: {
              type: "realtime",
              model: REALTIME_MODEL,
              instructions: instructions || "",
              audio: {
                input: {
                  transcription: { model: "whisper-1" },
                  turn_detection: { type: "server_vad", silence_duration_ms: 700 },
                },
                output: { voice: voice || DEFAULT_VOICE },
              },
            },
          }),
        });
        const data = await r.json();
        if (!r.ok) return json({ error: "OpenAI session error", detail: data }, r.status);
        return json(data);
      }

      // ---- ให้คะแนนจาก transcript ----
      if (url.pathname === "/score" && req.method === "POST") {
        const { rubric, transcript } = await req.json();
        if (!transcript || !transcript.trim()) return json({ error: "ไม่มี transcript" }, 400);
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: SCORING_MODEL,
            temperature: 0.2,
            messages: [
              { role: "system", content: rubric },
              {
                role: "user",
                content:
                  "ต่อไปนี้คือ transcript ของการ Roleplay (บรรทัดที่ขึ้นต้นด้วย 'เซลส์:' คือพนักงานขายที่ต้องประเมิน, 'ลูกค้า:' คือ AI ที่เล่นเป็นลูกค้า) โปรดประเมินตามเกณฑ์ในระบบข้างต้น:\n\n" +
                  transcript,
              },
            ],
          }),
        });
        const data = await r.json();
        if (!r.ok) return json({ error: "OpenAI scoring error", detail: data }, r.status);
        return json({ result: data.choices?.[0]?.message?.content || "(ประเมินไม่สำเร็จ)" });
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
};
