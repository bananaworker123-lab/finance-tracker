# Requirements — Finance Tracker PWA

## Functional Requirements

---

### FR-001: บันทึกรายรับ-รายจ่ายทันที (Immediate Transaction)

**User Story:**
As a user, I want to record an income or expense immediately so that my current balance is always up to date.

**Acceptance Criteria:**

- GIVEN ผู้ใช้กดปุ่ม FAB (+) หรือเลือก Expense/Income tab ใน AddSheet
- WHEN กรอก amount, เลือก category, ใส่ note (optional) แล้วกด Save
- THEN record ถูกบันทึกใน `db.transactions` พร้อม type, amount, category, emoji, tile, date (ISO string), note
- AND Dashboard แสดง balance อัปเดตทันที
- AND History แสดง record ใหม่ที่ด้านบนสุดของเดือนปัจจุบัน

**Edge Cases:**
- amount ต้องเป็นตัวเลขบวก > 0
- category ต้องเลือกก่อน Save ได้
- note เป็น optional (empty string ได้)

---

### FR-002: บันทึกบิลรายเดือน (Upcoming Bill)

**User Story:**
As a user, I want to add recurring bills so that I can track what I still need to pay this month.

**Acceptance Criteria:**

- GIVEN ผู้ใช้เปิด AddSheet → Bill tab
- WHEN กรอก name, amount, due_date, category แล้วกด Save
- THEN record ถูกบันทึกใน `db.bills` พร้อม `status: 'upcoming'`, `installment_id: null`
- AND บิลปรากฏใน Payments screen ใต้ Bills tab
- AND Pending total บน Dashboard รวม amount ของบิลนี้ด้วย

**Edge Cases:**
- due_date ที่ผ่านมาแล้ว → status ต้อง auto-set เป็น `'overdue'` เมื่อแอปเปิดครั้งถัดไป (ผ่าน `updateOverdueBills()`)
- ชื่อบิลซ้ำได้ (ไม่มี unique constraint)

---

### FR-003: บันทึกแผนผ่อนชำระ (Installment Plan)

**User Story:**
As a user, I want to create a multi-tier installment plan so that monthly payment amounts can change across periods without re-entering data.

**Acceptance Criteria:**

- GIVEN ผู้ใช้เปิด AddSheet → Plan tab
- WHEN กรอก name, start_month, due_day, category และเพิ่ม segments (amount_per_period + periods) อย่างน้อย 1 segment แล้วกด Save
- THEN record parent ถูกบันทึกใน `db.installments`
- AND ระบบ generate `db.bills` records ให้ครบทุกงวดตามทุก segment โดยอัตโนมัติ
- AND งวดที่ 1 ที่เลย due_date แล้วได้ `status: 'overdue'`; งวดที่ยังไม่ถึงได้ `status: 'upcoming'`
- AND แผนปรากฏใน Payments screen ใต้ Plans tab พร้อม progress bar

**Segment Rules:**
- แต่ละ segment มี `amount_per_period` และ `periods` (จำนวนงวด)
- bills ถูก generate เรียงตาม segment ก่อน-หลัง
- total_installments = sum ของ periods ทุก segment

---

### FR-004: กดจ่ายบิลรายตัว (Mark Bill Paid)

**User Story:**
As a user, I want to mark a bill as paid so that it moves out of my pending obligations.

**Acceptance Criteria:**

- GIVEN มีบิล status เป็น `'upcoming'` หรือ `'overdue'` ใน Payments screen
- WHEN ผู้ใช้กดปุ่ม "Mark as paid"
- THEN `db.bills` record อัปเดต `status: 'paid'`, `paid_date: now`, `paid_amount: bill.amount`
- AND **ไม่มี** record ใหม่ถูกเพิ่มใน `db.transactions`
- AND บิลปรากฏในหน้า History ในเดือนนั้น ๆ ในฐานะ expense row (synthesised จาก `db.bills`)
- AND Dashboard อัปเดต: balance ลด, pending ลด

**Concurrency:**
- GIVEN ผู้ใช้กดปุ่ม "Mark as paid" ซ้ำอย่างรวดเร็ว (double-tap)
- THEN update เกิดขึ้นแค่ครั้งเดียว (in-flight lock via `useRef(new Set())`)
- AND transaction count ไม่เพิ่มขึ้น

---

### FR-005: กดจ่ายงวดถัดไปของแผนผ่อน (Mark Installment Payment Paid)

**User Story:**
As a user, I want to mark the next installment payment as paid from both the Payments screen and the Plan Detail screen.

**Acceptance Criteria:**

- GIVEN มีแผนผ่อนที่ยังมีงวดค้างอยู่
- WHEN ผู้ใช้กด "Mark Payment N paid" ใน Payments card หรือ PlanDetail
- THEN `db.bills` record ของงวดนั้นอัปเดต `status: 'paid'`, `paid_date`, `paid_amount`
- AND **ไม่มี** record ใหม่ใน `db.transactions`
- AND progress bar ใน Payments card และ PlanDetail อัปเดต (paid count +1)
- AND lock pattern เดียวกับ FR-004 ป้องกัน double-fire

---

### FR-006: ปิดแผนผ่อนก่อนกำหนด (Close Plan Early)

**User Story:**
As a user, I want to close an installment plan early so that remaining unpaid periods are removed from my pending obligations.

**Acceptance Criteria:**

- GIVEN ผู้ใช้อยู่ใน PlanDetail screen
- WHEN กดปุ่ม "Close plan early" และยืนยัน
- THEN bills ทุกงวดที่ยัง `status !== 'paid'` ถูกอัปเดตเป็น `status: 'cancelled'`
- AND แผนผ่อนหายออกจาก pending total บน Dashboard
- AND History ไม่แสดง cancelled bills

---

### FR-007: หน้า Dashboard

**User Story:**
As a user, I want to see my financial overview at a glance when I open the app.

**Acceptance Criteria:**

- **Available Balance** = sum(income transactions) − sum(expense transactions) − sum(paid_amount จาก bills ที่ status = 'paid')
- **Pending Total** = sum(amount จาก bills ที่ status ∈ {upcoming, overdue})
- **Safe to Spend** = Available Balance − Pending Total
- **Due Soon** = bills ที่ status ≠ 'paid' และ due_date อยู่ภายใน 7 วันข้างหน้า เรียงตาม due_date
- SparkBars แสดงสัดส่วน income vs expense 6 เดือนล่าสุด

---

### FR-008: หน้า History

**User Story:**
As a user, I want to browse all past transactions and filter by month, type, and keyword.

**Acceptance Criteria:**

- แสดง transactions ทั้งหมด + paid bills (synthesised เป็น expense rows) รวมกัน
- เรียง newest-first ภายใน month
- **Month picker** — เลือกเดือนได้ แสดง < > นำทาง
- **Type filter chips** — All / Income / Expense
- **Search** — กรองตาม note หรือ category name (case-insensitive)
- แต่ละ row แสดง emoji, ชื่อ, วันที่, amount (income = สีเขียว, expense = ลบ)

---

### FR-009: หน้า Summary / Statistics

**User Story:**
As a user, I want to see spending statistics and export data as CSV.

**Acceptance Criteria:**

- **Period tabs:** This Month / Last 3 Months / Last 6 Months
- **Stats row:** Total Income, Total Expense, Net Savings
- **6-month bar chart:** income vs expense แต่ละเดือน
- **Category breakdown:** แต่ละ category มี % และยอดรวม เรียงจากมากสุด
- **Export CSV** — download ไฟล์ที่มีทุก transaction + paid bills ของช่วงที่เลือก

---

### FR-010: จัดการ Categories

**User Story:**
As a user, I want to choose from default categories when recording transactions.

**Acceptance Criteria:**

- Default categories seed เมื่อ DB ถูกสร้างครั้งแรก: Food, Transport, Shopping, Bills, Salary, Entertainment, Health, Coffee, Groceries, Internet, Phone, Travel, Other
- แต่ละ category มี name, emoji, color tile
- Category grid แสดงใน AddSheet สำหรับ Expense/Income/Bill/Plan tabs

---

## Non-Functional Requirements

### NFR-001: Performance
- First Contentful Paint < 1.5s บน mid-range Android (offline, cached)
- DB write (markPaid) < 100ms
- useLiveQuery re-render < 50ms หลัง DB update

### NFR-002: Offline
- แอปทำงานได้เต็มรูปแบบโดยไม่มีอินเทอร์เน็ต (PWA + Workbox cache)
- ข้อมูลไม่หายเมื่อปิดแล้วเปิดแอปใหม่ (IndexedDB persistent)

### NFR-003: Responsiveness
- ออกแบบสำหรับหน้าจอ 402×858px (phone mockup frame)
- ไม่ต้อง responsive สำหรับ desktop layout

### NFR-004: Data Integrity
- ห้าม double-count: paid bill ต้องไม่ปรากฏทั้งใน `db.transactions` และ `paidBillsAsTx` ในเวลาเดียวกัน
- `updateOverdueBills()` ต้องรันทุกครั้งที่แอปเปิด (ใน `App.jsx` useEffect)

### NFR-005: Accessibility
- ปุ่มทุกปุ่มต้องกดได้บน touch screen (min tap target 44×44px)
- ข้อความทุกจุดต้องอ่านออกโดยไม่ต้องขยายจอ

### NFR-006: Testability
- Business logic (DB operations, balance calculation) ต้องมี unit test ครอบคลุม
- Test ต้องรันได้โดยไม่ต้องเปิด browser (`vitest` + `fake-indexeddb`)
