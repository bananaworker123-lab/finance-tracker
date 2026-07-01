# Product Overview — Finance Tracker

## Vision
แอปพลิเคชันติดตามการเงินส่วนบุคคลแบบ Progressive Web App (PWA) ที่ทำงานทั้งหมดบน client-side ไม่มี server และไม่ต้องสมัครสมาชิก ผู้ใช้สามารถบันทึกรายรับ-รายจ่าย ติดตามบิลที่ยังไม่ได้จ่าย และวางแผนผ่อนชำระแบบหลาย tier ได้ในเครื่องเดียว

## Target User
ผู้ใช้งานทั่วไปที่ต้องการติดตามการเงินส่วนตัวบนมือถือ โดยไม่ต้องการให้ข้อมูลการเงินออนไลน์หรือผ่าน cloud ใด ๆ

## Core Value Propositions
- **Privacy-first** — ข้อมูลทั้งหมดเก็บใน IndexedDB บนอุปกรณ์ ไม่มี API call ออก
- **Zero-friction** — ไม่มี login, ไม่มี onboarding ยาว เปิดแอปใช้ได้ทันที
- **Smart installment** — ผ่อนสินค้าแบบ multi-segment (เช่น 3 เดือนแรก 3,500 บาท แล้วลดเป็น 2,500) บันทึกครั้งเดียว ระบบสร้างงวดให้อัตโนมัติ
- **Clear balance** — แสดง Available Balance, Pending Bills, Safe to Spend แยกชัดเจน

## Key Screens
| Screen | จุดประสงค์ |
|---|---|
| Dashboard | ภาพรวม balance, pending, due soon |
| History | รายการธุรกรรมทั้งหมด + ค้นหา/กรอง |
| Payments | จัดการบิลและแผนผ่อน + กดจ่าย |
| Plan Detail | รายละเอียดแผนผ่อน, schedule, close early |
| Summary | สถิติรายเดือน, bar chart, category breakdown, export CSV |

## Transaction Types
1. **Immediate** — รายรับ (Income) หรือรายจ่าย (Expense) ทันที บันทึกครั้งเดียวจบ
2. **Upcoming Bill** — บิลรายเดือนที่รอจ่าย (ค่าไฟ, ค่าน้ำ, streaming) สถานะ: upcoming → overdue → paid
3. **Installment Plan** — ผ่อนสินค้าแบบหลาย tier มี parent record + bill records รายงวด

## Out of Scope
- การเชื่อมต่อธนาคาร / open banking
- Multi-user / shared budget
- Cloud sync / backup
- Notification / push alert
- Currency conversion
