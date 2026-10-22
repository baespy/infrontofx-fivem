# เริ่มใช้ infrontofx FiveM

ชุดนี้ประกอบด้วย MCP สำหรับช่วยพัฒนา และ resource สำหรับส่งสถานะ FiveM ไปยังเครื่องมือภายนอก ทั้งสองส่วนใช้งานแยกกันได้

## ใช้ MCP กับงานเขียนสคริปต์

ติดตั้ง dependency ด้วย `npm ci` แล้วเพิ่ม MCP ตาม README โดยระบุพาธจริงของไฟล์ `src/mcp.mjs` และโฟลเดอร์ resources

เมื่อเพิ่มแล้ว ให้เริ่ม session ใหม่ของโปรแกรม AI เพื่อโหลดรายการเครื่องมือ ลองสั่ง:

> ใช้ infrontofx-skill ตรวจ resource 1nfx_dailylogin ด้วย infrontofx-fivem แยกปัญหาที่พิสูจน์แล้วออกจากข้อสังเกต และอย่าแก้ไฟล์ก่อนรายงานผล

หรือ:

> ค้น GET_PLAYER_PED ฝั่ง server จากฐาน Native ทางการ แล้ววางแผน resource NUI ที่ใช้ Vue ตามมาตรฐาน infrontofx

MCP นี้อ่านและวิเคราะห์เท่านั้น ไม่แก้ไฟล์ ไม่เรียก SQL และไม่สั่งเซิร์ฟเวอร์เกม เครื่องมือ AI ที่ใช้งาน MCP อาจมีเครื่องมือแก้ไฟล์ของตัวเองแยกต่างหาก

## ใช้ resource ส่งสถานะ

1. แตกไฟล์ resource จากหน้า Releases หรือรัน `npm run build` จาก source
2. นำ `1nfx_bridge` และ `1nfx_telemetry` ไปไว้ในโฟลเดอร์ resources ของเซิร์ฟเวอร์ทดสอบ
3. สร้าง token แบบสุ่มอย่างน้อย 32 ตัวอักษร เก็บใน config ฝั่ง server โดยใช้ `set infrontofx_bridge_token` ห้ามใช้ `setr`
4. โหลด config นั้นก่อน `ensure 1nfx_bridge` และ `ensure 1nfx_telemetry` โดยเริ่ม es_extended ก่อนด้วย
5. ตั้ง environment variable `INFRONTOFX_BRIDGE_TOKEN` ในเครื่องมือทดสอบให้ตรงกัน แล้วรัน `node scripts/telemetry-client.mjs`

ค่าเริ่มต้นเปิดรับเฉพาะ localhost ที่พอร์ต 30125 และ path `/live` ถ้าเชื่อมข้ามเครื่องต้องจัด TLS, reverse proxy และ firewall ก่อน

ตัวอย่างนี้ส่งจำนวนผู้เล่น จำนวน resources และเวลา ไม่มีรายชื่อผู้เล่น และไม่มีคำสั่งจัดการเงิน ไอเท็ม หรือ restart resource

## ก่อนใช้กับเซิร์ฟเวอร์จริง

ทดสอบใน FXServer จริงก่อน: start/stop ทั้งสอง resource, reconnect, token ผิด, ข้อความผิดรูปแบบ, ผู้รับช้า และสิทธิ์ของ resource ที่เรียก export

ผลทดสอบ Node และ CI ไม่ใช่ผลทดสอบในเกม และไม่ยืนยันว่า resource เร็วขึ้น ต้องวัดด้วย resmon/profiler ตาม workload จริง

คู่มือภาษาอังกฤษและลิงก์แหล่งข้อมูลอยู่ใน README.md
