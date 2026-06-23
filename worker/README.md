# MDS Voice Roleplay — Backend (Cloudflare Worker)

Worker เล็ก ๆ ที่ทำหน้าที่ 2 อย่าง โดยเก็บ `OPENAI_API_KEY` ไว้ฝั่งเซิร์ฟเวอร์ (ห้ามวางคีย์ใน `live.html` เพราะ repo เป็น public):

- `POST /session` — ออก ephemeral token ให้เบราว์เซอร์ต่อ OpenAI Realtime (WebRTC) โดยตรง
- `POST /score` — รับ transcript แล้วส่งเข้าโมเดลให้คะแนนตามเกณฑ์

## วิธี deploy (ครั้งเดียว)

ต้องมี Node.js ก่อน แล้ว:

```bash
cd worker
npm install -g wrangler          # ถ้ายังไม่มี
wrangler login                   # ล็อกอิน Cloudflare (ฟรี)
wrangler secret put OPENAI_API_KEY   # วาง OpenAI API key ตอนถาม
wrangler deploy
```

หลัง deploy จะได้ URL เช่น `https://mds-roleplay-voice.<ชื่อ>.workers.dev`

## เชื่อมกับหน้าเว็บ

เปิด `live.html` ครั้งแรก จะมีช่องให้กรอก **Worker URL** (เก็บใน localStorage ของเบราว์เซอร์)
วาง URL ที่ได้จากขั้นบนลงไป แล้วเริ่มใช้งานได้เลย

## ค่าใช้จ่าย

- Cloudflare Worker: ฟรี (ภายในโควต้าปกติ)
- OpenAI Realtime: คิดตามนาทีเสียง (input/output) + ค่าให้คะแนนเล็กน้อยต่อครั้ง
- ดูราคาล่าสุดที่หน้า pricing ของ OpenAI

## ตั้งค่าที่ปรับได้ใน worker.js

- `REALTIME_MODEL` = `gpt-realtime`
- `SCORING_MODEL` = `gpt-4o`
- `DEFAULT_VOICE` = `alloy` (เปลี่ยนเป็นเสียงอื่นได้ เช่น `marin`, `cedar`)
- `ALLOW_ORIGIN` ใน `wrangler.toml` — ล็อกให้เรียกได้เฉพาะหน้าเว็บจริง
