# Personal Finance Tracker — PWA

## Overview

Mobile-first PWA สำหรับติดตามรายรับ-รายจ่ายส่วนตัว รองรับการลงรายการล่วงหน้า บิลรายเดือน และการผ่อนชำระแบบหลายช่วง ข้อมูลทั้งหมดเก็บใน device (IndexedDB) ไม่ต้อง login ไม่ต้อง server

---

## Transaction Types

### 1. Immediate Transaction
รายรับหรือรายจ่ายที่เกิดขึ้นทันที ตัดยอดเลย

Fields:
- type: income | expense
- amount
- category
- date
- note (optional)

### 2. Upcoming Bill
รายจ่ายที่ลงไว้ล่วงหน้า ยังไม่ตัดยอด รอจนกว่าจะกดชำระ

Fields:
- name
- amount (แก้ไขได้ก่อนจ่าย)
- due_date
- category
- note (optional)
- status: upcoming | overdue | paid

Behavior:
- ระบบเปลี่ยน status เป็น `overdue` อัตโนมัติเมื่อเลย due_date แล้วยังไม่จ่าย
- เมื่อกด "ชำระแล้ว" ให้ใส่วันที่จ่ายจริง แล้วตัดยอดเป็นรายจ่าย
- แก้ไขยอดก่อนกดจ่ายได้ (เผื่อยอดจริงต่างจากที่ประมาณไว้)

### 3. Installment (ผ่อนชำระ)
ชุดของ Upcoming Bill ที่ link กัน มี parent-child relationship

#### การคีย์ข้อมูล

1. ชื่อรายการ (เช่น "ผ่อน iPhone 16")
2. เดือนที่เริ่มต้น (เช่น ก.ค. 2025)
3. วันครบกำหนดในแต่ละเดือน (เช่น วันที่ 15)
4. เพิ่ม "ช่วง" ได้หลายช่วง โดยแต่ละช่วงระบุ:
   - ยอดต่องวด (บาท)
   - จำนวนงวด

ระบบจะ generate งวดทั้งหมดให้อัตโนมัติ นับต่อเนื่องจากเดือนเริ่มต้น

#### ตัวอย่าง

| ช่วง | ยอดต่องวด | จำนวนงวด |
|------|-----------|----------|
| ช่วงที่ 1 | 3,500 | 6 |
| ช่วงที่ 2 | 2,800 | 6 |
| ช่วงที่ 3 | 1,200 | 3 |

→ รวม 15 งวด ระบบสร้างให้อัตโนมัติ

รองรับ:
- งวดเท่ากันทั้งหมด → ใส่แค่ 1 ช่วง
- งวดไม่เท่า แต่เท่าเป็นช่วงๆ → ใส่หลายช่วง

#### Installment Behavior
- แต่ละงวด flow เดิม: upcoming → overdue → paid
- แก้ไขยอดแต่ละงวดก่อนจ่ายได้ (เผื่อดอกเบี้ยลอยตัว)
- ปิดก่อนกำหนด: mark งวดที่เหลือเป็น "ยกเลิก/ปิดบัญชี" ได้
- ดู history ทุกงวดของ installment นั้นในหน้าเดียว
- แสดง progress: จ่ายไปแล้ว Y งวด / Z งวด

---

## Functional Requirements

### Dashboard
- ยอด balance จริง (รายรับ − รายจ่ายที่จ่ายแล้วเท่านั้น)
- ยอด "รอจ่าย" แสดงแยกชัดเจน (Upcoming + Installment ที่ยังไม่จ่าย)
- ยอด balance หลังหักรายการรอจ่ายทั้งหมด
- รายการใกล้ครบกำหนด (ภายใน 7 วัน)
- รายการที่ overdue

### Monthly Summary
- รายรับรวม
- รายจ่ายจริง (paid)
- รายจ่ายรอ (upcoming/overdue ในเดือนนั้น)
- breakdown ตาม category

### Upcoming Bills View
- แสดงรายการทั้งหมดที่ยังไม่จ่าย
- sort ตาม due_date
- filter: upcoming | overdue | paid
- badge แสดงจำนวนรายการที่ใกล้ครบกำหนด

### Installment View
- รายการ installment ทั้งหมด
- progress per installment
- ขยายดู timeline งวดทั้งหมดได้

### Transaction History
- รายการทั้งหมดที่ผ่านมา
- filter ตาม: เดือน, category, type
- search ชื่อรายการ
- แก้ไข / ลบได้

### Export
- export ข้อมูลเป็น CSV (รายเดือนหรือทั้งหมด)

### Categories
- มี default categories ให้
- เพิ่ม/แก้ไข category เองได้

---

## Non-Functional Requirements

### Platform
- Mobile-first, PWA
- Add to Home Screen ได้ (manifest + service worker)
- ใช้งาน offline ได้เต็มรูปแบบ
- รองรับ iOS Safari และ Android Chrome

### Data Storage
- IndexedDB (ผ่าน library เช่น Dexie.js)
- ข้อมูลเก็บใน device ทั้งหมด ไม่มี server
- ไม่ต้อง login / account

### Performance
- โหลดเร็ว First Contentful Paint < 2s
- ใช้งานลื่นบนมือถือ mid-range

### UI/UX
- ตัวเลขอ่านง่าย ชัดเจน
- การ input ที่ง่าย ใช้มือข้างเดียวได้
- แสดง status ด้วยสีและ icon ชัดเจน (upcoming, overdue, paid)
- Notification / badge แจ้งเตือนรายการใกล้ครบกำหนด (PWA notification)

---

## Tech Stack (Suggested)

- **Framework**: React + Vite
- **Styling**: Tailwind CSS
- **Storage**: Dexie.js (IndexedDB wrapper)
- **PWA**: vite-plugin-pwa
- **Deploy**: Vercel หรือ Netlify (free tier)

---

## Data Model (Draft)

```ts
// Immediate transaction
Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  date: string
  note?: string
}

// Upcoming bill / installment งวด
Bill {
  id: string
  installment_id?: string   // ถ้าเป็นส่วนของ installment
  name: string
  amount: number
  due_date: string
  category: string
  note?: string
  status: 'upcoming' | 'overdue' | 'paid'
  paid_date?: string
  paid_amount?: number      // อาจต่างจาก amount ที่ตั้งไว้
  cancelled?: boolean       // สำหรับงวดที่ยกเลิก (ปิดก่อนกำหนด)
}

// Installment parent
Installment {
  id: string
  name: string
  start_month: string       // YYYY-MM
  due_day: number           // วันที่ในเดือน
  category: string
  note?: string
  segments: InstallmentSegment[]
  total_installments: number
}

InstallmentSegment {
  amount_per_period: number
  periods: number
}
```
