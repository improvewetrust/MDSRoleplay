# MDS Roleplay — Backend (Vercel)

Backend สำรองบน Vercel ที่ **รันในภูมิภาคสหรัฐฯ ตายตัว** (`iad1`) เพื่อแก้ปัญหา
`unsupported_country_region_territory` ที่เกิดกับ Cloudflare Worker (egress สุ่มประเทศ)

โค้ดทำงานเหมือน Cloudflare Worker เดิมทุกอย่าง:
- `POST /session` — ออก ephemeral token ให้เบราว์เซอร์ต่อ OpenAI Realtime
- `POST /score` — รับ transcript แล้วให้คะแนน

## วิธี deploy (ครั้งเดียว)

ต้องมี Node.js ก่อน แล้ว:

```bash
cd vercel
npx vercel login           # ล็อกอิน (ฟรี — ใช้ GitHub/อีเมล)
npx vercel link            # สร้าง/ผูกโปรเจกต์ (กด Enter ตามค่าเริ่มต้นได้)
npx vercel env add OPENAI_API_KEY production   # วาง OpenAI API key ตอนถาม
npx vercel --prod          # deploy ขึ้น production
```

หลัง deploy จะได้ URL เช่น `https://mds-roleplay-backend.vercel.app`

> ถ้าต้องการล็อก origin ให้เรียกได้เฉพาะหน้าเว็บจริง:
> `npx vercel env add ALLOW_ORIGIN production` แล้วใส่ `https://improvewetrust.github.io`
> (ถ้าไม่ตั้ง จะ default เป็นค่านี้ให้อยู่แล้ว)

## เชื่อมกับหน้าเว็บ

เปิดหน้าโหมดเสียง (live / objection / oral) → ช่อง **Worker URL** ด้านบน
วาง URL ของ Vercel ที่ได้ (เช่น `https://mds-roleplay-backend.vercel.app`) แล้วกดบันทึก
ใช้งานได้เลย — ไม่ต้องแก้โค้ดหน้าเว็บ

## ทำไมแก้ปัญหาได้

OpenAI บล็อกตามพิกัด IP ที่ยิงคำขอ Cloudflare Workers egress จาก data center ที่
บางครั้งถูกระบุเป็นประเทศที่ไม่รองรับ ส่วน Vercel serverless (Hobby) รันที่ `iad1`
สหรัฐฯ ซึ่ง OpenAI รองรับ → egress คงที่ ไม่สุ่มประเทศ
