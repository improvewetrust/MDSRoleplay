// Vercel serverless function — ให้คะแนนจาก transcript
// รองรับ 2 โหมด:
//   1) Roleplay (live.html)        : { rubric, transcript } -> ใช้ system/format มาตรฐาน (100 คะแนน)
//   2) แบบกำหนดเอง (objection/oral) : { rubric, transcript, context, systemPrompt, outputFormat }

const SCORING_MODEL = "gpt-4o";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "https://improvewetrust.github.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "Not found" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY ยังไม่ถูกตั้งค่า" });

  const { rubric, transcript, context, systemPrompt, outputFormat } = req.body || {};
  if (!transcript || !transcript.trim()) return res.status(400).json({ error: "ไม่มี transcript" });

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

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
    if (!r.ok) return res.status(r.status).json({ error: "OpenAI scoring error", detail: data });
    return res.status(200).json({ result: data.choices?.[0]?.message?.content || "(ประเมินไม่สำเร็จ)" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
