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
const DEFAULT_VOICE = "cedar";

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
                  transcription: { model: "whisper-1", language: "th" },
                  // threshold สูงขึ้น = ไวต่อเสียงรบกวน/เสียงสะท้อนน้อยลง (กัน AI ตอบเองจากเสียงหลอน)
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.62,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 900,
                  },
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
      // รองรับ 2 โหมด:
      //   1) Roleplay (live.html)  : ส่ง { rubric, transcript } -> ใช้ system/format มาตรฐาน (100 คะแนน)
      //   2) แบบกำหนดเอง (objection.html) : ส่ง { rubric, transcript, context, systemPrompt, outputFormat }
      if (url.pathname === "/score" && req.method === "POST") {
        const { rubric, transcript, context, systemPrompt, outputFormat } = await req.json();
        if (!transcript || !transcript.trim()) return json({ error: "ไม่มี transcript" }, 400);

        const DEFAULT_SYSTEM =
          "คุณเป็น Sales Coach ผู้เชี่ยวชาญ ประเมินการ roleplay ขายระบบ POS อย่างเข้มงวดตามเกณฑ์ที่ให้ แล้วสรุปผลแบบกระชับ ได้ใจความสำคัญ เป็นภาษาไทย";
        const DEFAULT_FORMAT =
          "🎯 คะแนนรวม: X/100\n" +
          "รายหมวด: Trust _/9 · Understand _/23 · Solution _/34 · Value & Objection _/24 · Close _/10\n\n" +
          "✅ ทำได้ดี\n- (2-3 ข้อ สั้น ๆ อ้างอิงสิ่งที่เซลส์พูดจริง)\n\n" +
          "⚠️ ต้องปรับ\n- (2-3 ข้อ สั้น ๆ พร้อมบอกวิธีแก้ที่ทำได้จริง)\n\n" +
          "💡 ครั้งหน้า: (1 ประโยคเด็ดที่นำไปใช้ได้ทันที)";

        const userContent =
          (context ? "===== โจทย์/ข้อโต้แย้งของลูกค้า =====\n" + context + "\n\n" : "") +
          "===== เกณฑ์/เฉลย (ใช้เป็น 'มาตรฐานการประเมิน' เท่านั้น — ห้ามลอกรูปแบบรายงาน/ตารางในเกณฑ์มาแสดง) =====\n" +
          rubric +
          "\n\n===== TRANSCRIPT (บรรทัด 'เซลส์:' = พนักงานขายที่ต้องประเมิน, 'ลูกค้า:' = AI ที่เล่นเป็นลูกค้า) =====\n" +
          transcript +
          "\n\n===== สรุปผลตามรูปแบบนี้เท่านั้น (กระชับ ห้ามทำตารางยาว) =====\n" +
          (outputFormat || DEFAULT_FORMAT);

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
              { role: "system", content: systemPrompt || DEFAULT_SYSTEM },
              { role: "user", content: userContent },
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
