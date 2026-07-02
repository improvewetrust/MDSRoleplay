// Vercel serverless function — บันทึกผลการฝึกลง Google Sheet
// ส่งต่อข้อมูลไปยัง Google Apps Script Web App (ตั้ง URL ใน env: SHEET_WEBHOOK_URL)
// ต้องผ่านรหัสเข้าใช้งาน (env: ACCESS_CODE) เหมือน /session

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "https://improvewetrust.github.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "Not found" });

  const { accessCode, name, email, reason, mission, score, good, fix } = req.body || {};
  if (process.env.ACCESS_CODE && accessCode !== process.env.ACCESS_CODE)
    return res.status(401).json({ error: "รหัสเข้าใช้งานไม่ถูกต้อง" });
  if (!process.env.SHEET_WEBHOOK_URL)
    return res.status(500).json({ error: "SHEET_WEBHOOK_URL ยังไม่ถูกตั้งค่า" });
  if (!name || !email) return res.status(400).json({ error: "ข้อมูลไม่ครบ" });

  try {
    const r = await fetch(process.env.SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || "",
        email: email || "",
        reason: reason || "",
        mission: mission || "",
        score: score || "",
        good: good || "",
        fix: fix || "",
      }),
    });
    // Apps Script web app ตอบ 302 -> fetch ตามไปเอง ได้ 200 ถือว่าสำเร็จ
    if (!r.ok) return res.status(502).json({ error: "บันทึกลง Sheet ไม่สำเร็จ", status: r.status });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
