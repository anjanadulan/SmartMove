# SmartMove Transport Solutions

> An Enterprise Polyglot Transit Reservation, Digital Ticketing, and Fleet Management System.

---

## 📌 Project Overview

**SmartMove Transport Solutions** is a modern intercity coach reservation and fleet management system built to demonstrate **Polyglot Persistence**, strict **Third Normal Form (3NF)** relational database modeling, advanced **PL/SQL procedural business logic**, and **NoSQL document-store analytics**.

The system features two interconnected application portals:
* **Passenger Portal**: Real-time schedule search, interactive 2x2 luxury bus cabin seat selection (A1–D10), atomic ticket reservations, instant cancellations with refund processing, printable digital boarding passes with QR codes, and multimedia feedback.
* **Admin Workspace**: Fleet registration, driver roster management, transit route & fare management, trip scheduling, workshop maintenance logs, counter payment settlements, broadcast travel advisories, and direct execution of **5 PL/SQL analytical business reports**.

---

## 🏛️ System Architecture: Polyglot Persistence

The application adopts a **Polyglot Architecture**, dividing responsibilities between two database engines:

```
                          ┌─────────────────────────────────────┐
                          │     Next.js 16 Web Application      │
                          │   (TypeScript / Tailwind / React)   │
                          └──────────────┬───────────────┬──────┘
                                         │               │
                 ACID Transactions       │               │ Flexible Content
                 & Strict Relational     │               │ & Media Metadata
                                         ▼               ▼
                        ┌──────────────────┐   ┌──────────────────┐
                        │ Oracle 21c / XE  │   │   MongoDB 7.0+   │
                        │ (Relational/3NF) │   │ (Document Store) │
                        └──────────────────┘   └──────────────────┘
```

### 1. Oracle Database (Relational Core — ACID Compliance)
* **Tables**: 11 3NF normalized tables ensuring zero data redundancy.
* **Integrity**: Enforces primary keys, foreign keys, and domain checks (`CHECK (arrival_at > departure_at)`, `CHECK (fare > 0)`).
* **Concurrency Control**: Employs **Pessimistic Locking** (`SELECT ... FOR UPDATE`) in stored procedures to eliminate race conditions and mathematically prevent double-booking during simultaneous checkouts.
* **Automated Auditing**: Row-level trigger (`trg_booking_status_history`) automatically tracks all lifecycle state transitions into an immutable audit table without table mutation errors.
* **PL/SQL Procedural Logic**: 15 pre-compiled stored procedures and functions manage trip dispatching, seat holds, fare validation, payments, cancellations, and refunds.
* **Analytical Reporting**: 5 pre-compiled business reports implemented with explicit cursors (`OPEN`, `FETCH`, `EXIT WHEN %NOTFOUND`, `CLOSE`), loops, and aggregations.

### 2. MongoDB Community (NoSQL Document Store — BASE Availability)
* **Collections**: 5 BSON collections storing semi-structured and polymorphic data:
  * `feedback_content`: Passenger reviews with 1–5 star ratings, sentiment keyword arrays (`["clean", "comfortable"]`), and embedded staff reply subdocuments.
  * `vehicle_assets`: Heterogeneous vehicle document metadata (fitness certificates, insurance expiration dates, inspection photos).
  * `announcements`: Real-time operational travel advisories with active visibility flags.
  * `notifications`: User-specific notification dispatches with read tracking.
  * `trip_media`: Scenic route photography and travel media.
* **Aggregation Pipelines**: Utilizes `$group`, `$avg`, `$sort`, and `$in` operators to calculate live vehicle and driver performance metrics without relational table overhead.

---

## 📂 Repository Structure

```text
├── database/
│   ├── oracle/                         # 15 Oracle Database SQL scripts
│   │   ├── 01_users.sql                # User creation & Least Privilege security roles
│   │   ├── 02_schema.sql               # 11 3NF tables & booking audit trigger
│   │   ├── 03_business_logic.sql       # Core procedures: booking, seats, payments, refunds
│   │   ├── 04_management_operations.sql# CRUD procedures for fleet, drivers, routes & users
│   │   ├── 05_trip_operations.sql      # Trip rescheduling, cascading cancellation, completion
│   │   ├── 06_reports.sql              # 5 analytical business reports with explicit cursors
│   │   ├── 07_sample_data.sql          # Authentic Sri Lankan transit seed data
│   │   ├── 08_permissions.sql          # Public trip views & granular application grants
│   │   ├── 09_basic_operations.sql     # Unit test verification script for CRUD operations
│   │   ├── 10_booking_example.sql      # Full transaction verification with automated rollback
│   │   ├── 11_web_integration.sql      # Web sequences, session indexing & pessimistic locking
│   │   ├── 12_passenger_portal.sql     # Review uniqueness index & atomic refund procedures
│   │   ├── 13_admin_workspace.sql      # Admin session tables & mass trip cancellation
│   │   ├── 14_grant_reports.sql        # Date-range revenue report & execution grants
│   │   └── 15_web_procedures_update.sql# Production procedure signature alignments
│   │
│   └── mongodb/                        # MongoDB NoSQL scripts
│       ├── setup.js                    # Database & collection initialization
│       ├── queries.js                  # 8 analytical queries & aggregation pipelines
│       └── sample-content.json         # Seed documents and schema examples
│
├── web/                                # Next.js 16 Web Application
│   ├── app/                            # App Router pages (Passenger & Admin routes)
│   ├── components/                     # Reusable UI components & luxury cabin map
│   ├── lib/                            # Oracle DB & MongoDB connection clients
│   ├── public/                         # Static media assets & uploaded images
│   ├── package.json                    # Node.js dependencies
│   └── .env.example                    # Environment variable configuration template
│
├── .gitignore                          # Excludes local environments, build artifacts & docs
└── README.md                           # Master project documentation
```

---

## 🚀 Setup & Installation Guide

### Prerequisites
* **Oracle Database 21c XE** (or 19c / 18c XE) installed with Pluggable Database `XEPDB1`.
* **MongoDB Community Server 7.0+** running locally on port `27017`.
* **Node.js v20.x or v22.x** and **npm** (or pnpm).

---

### Step 1: Initialize Oracle Database
Open SQL*Plus or Oracle SQL Developer, connect as `SYS AS SYSDBA` in container `XEPDB1`, and run the scripts in sequential order:

```sql
-- Connect to pluggable database
ALTER SESSION SET CONTAINER = XEPDB1;

-- 1. Create users and roles
@database/oracle/01_users.sql

-- 2. Connect as smartmove_database and create schema & business logic
CONNECT smartmove_database/Owner123pw@localhost:1521/XEPDB1;
@database/oracle/02_schema.sql
@database/oracle/03_business_logic.sql
@database/oracle/04_management_operations.sql
@database/oracle/05_trip_operations.sql
@database/oracle/06_reports.sql
@database/oracle/07_sample_data.sql
@database/oracle/08_permissions.sql

-- 3. Run production web integration scripts
@database/oracle/11_web_integration.sql
@database/oracle/12_passenger_portal.sql
@database/oracle/13_admin_workspace.sql
@database/oracle/14_grant_reports.sql
@database/oracle/15_web_procedures_update.sql
```

---

### Step 2: Initialize MongoDB
Ensure the MongoDB daemon (`mongod`) is running, then execute the setup script via `mongosh`:

```bash
mongosh < database/mongodb/setup.js
```

To test the 8 analytical NoSQL queries:
```bash
mongosh < database/mongodb/queries.js
```

---

### Step 3: Run the Web Application

1. Navigate to the `web` directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your local environment configuration:
   ```bash
   cp .env.example .env.local
   ```
   *Edit `.env.local` to match your local database credentials if different:*
   ```ini
   ORACLE_USER=SMARTMOVE_DATABASE_APP
   ORACLE_PASSWORD=App123pw
   ORACLE_CONNECT_STRING=localhost:1521/XEPDB1
   ORACLE_SCHEMA=SMARTMOVE_DATABASE
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=smartmove
   ALLOW_DEMO_PAYMENTS=true
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🔑 Demo & Testing Credentials

The system comes pre-seeded with role-checked accounts for evaluation:

| Role | Email Address | Password Hash / Secret | Access Portal |
| :--- | :--- | :--- | :--- |
| **Passenger** | `kasun@gmail.com` | `HASH_PASS_101` | `/login` &rarr; `/dashboard` |
| **Passenger** | `nadeesha@gmail.com` | `HASH_PASS_102` | `/login` &rarr; `/dashboard` |
| **Administrator** | `admin@smartmove.lk` | `HASH_ADMIN_999` | `/login` &rarr; `/admin` |

*(Quick 1-click demo login buttons are also provided directly on the `/login` page for convenience).*

---

## 📊 Summary of PL/SQL Reports

The Admin Workspace includes a dedicated **PL/SQL Reports console** that executes all 5 reports:

1. **Popular Routes (`popular_routes`)**: Cursor FOR loop analyzing issued tickets grouped by transit corridor.
2. **Net Revenue (`revenue`)**: Computes total ticket collections minus refunds using `NVL(SUM(amount), 0)`.
3. **Passenger History (`passenger_history`)**: Parameterized cursor displaying itemized travel history for a customer.
4. **Maintenance Due (`maintenance_due`)**: Classic explicit cursor lifecycle (`OPEN`, `FETCH`, `EXIT WHEN %NOTFOUND`, `CLOSE`) identifying vehicles due for workshop servicing.
5. **Trip Occupancy (`trip_occupancy`)**: Iterates through dispatched trips to calculate live percentage seat utilization.

---

## 👥 Project Team & Contribution Matrix

| Team Member | Email Address | Core Engineering Responsibilities |
| :--- | :--- | :--- |
| **Ramesha Ranasinghe** | `ramesharana2001@gmail.com` | **Relational Database Design & Schema Architecture**<br>• 3NF relational normalization & ER mapping<br>• Core table DDL & primary/foreign key constraints<br>• Fleet, driver & route operational CRUD procedures<br>• Security views & least privilege grant policies |
| **Melisha Devaraj** | `shenalimelissa@gmail.com` | **NoSQL Document Architecture & PL/SQL Business Reports**<br>• MongoDB collection design & BSON document schemas<br>• 8 NoSQL analytical queries & aggregation pipelines<br>• 5 PL/SQL business reports with explicit cursors & loops<br>• Periodic revenue report procedures & analytics |
| **Anjana Dulan** | `dulannimsara453@gmail.com` | **Full-Stack Application & Concurrency Control**<br>• Next.js 16 full-stack web application & UI/UX design<br>• Pessimistic row-locking (`FOR UPDATE`) & transaction safety<br>• Automated 30-min hold expiry & session management<br>• Dual-mode authentication & end-to-end integration |

---

## 📄 License & Attribution
SmartMove Transport Solutions. Engineered for reliable, high-integrity intercity coach transit reservation, fleet monitoring, and polyglot data persistence.
