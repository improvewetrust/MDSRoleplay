# ตั้งค่า Google Sheet บันทึกผลการฝึก (ทำครั้งเดียว ~5 นาที)

## 1) สร้าง Google Sheet
1. เปิด https://sheets.new (บัญชี Google ของคุณ)
2. ตั้งชื่อไฟล์ เช่น `MDS Roleplay — Training Log`
3. แถวแรก (หัวตาราง) ใส่ 8 คอลัมน์:
   `Timestamp | ชื่อ | Email | เหตุผล | Mission | คะแนนรวม | ทำได้ดี | ต้องปรับ`

## 2) วาง Apps Script
1. ในชีต: เมนู **Extensions → Apps Script**
2. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้:

```javascript
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sh.appendRow([
    new Date(), d.name || "", d.email || "", d.reason || "",
    d.mission || "", d.score || "", d.good || "", d.fix || ""
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. กด **Deploy → New deployment**
4. กดไอคอนเฟือง เลือก type = **Web app**
5. ตั้งค่า:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. กด **Deploy** → อนุญาตสิทธิ์ (Authorize) → คัดลอก **Web app URL**
   (หน้าตา `https://script.google.com/macros/s/XXXX/exec`)

## 3) ผูกกับ Vercel backend
ใน Terminal:

```bash
cd "/Users/phagorn/Desktop/MDSRoleplay/vercel"
npx vercel env add ACCESS_CODE production        # พิมพ์รหัสทีม (Wongnai00)
npx vercel env add SHEET_WEBHOOK_URL production  # วาง Web app URL จากข้อ 2
npx vercel --prod                                # deploy ใหม่ให้ env มีผล
```

## เสร็จแล้วได้อะไร
- ทุกโหมดเสียง (Oral / Objection / Roleplay Paid) จะบังคับกรอก
  รหัสทีม + ชื่อ + email + เหตุผล ก่อนเริ่มฝึกทุกครั้ง
- รหัสถูกตรวจที่ฝั่งเซิร์ฟเวอร์ (ไม่มีรหัสอยู่ในโค้ดหน้าเว็บ)
- จบการฝึกแต่ละครั้ง ระบบบันทึกลงชีตอัตโนมัติ:
  เวลา · ชื่อ · email · เหตุผล · mission · คะแนนรวม · ทำได้ดี · ต้องปรับ
