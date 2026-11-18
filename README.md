# 🏢 Attendance Management System

A full-stack, production-ready web application for managing employee attendance, built with React + TypeScript + Tailwind CSS (frontend) and Node.js + Express + Prisma + PostgreSQL (backend).

---

## ✨ Features

### Admin
- 📊 Dashboard with charts, stats, and live attendance
- 👥 Employee CRUD (Add / Edit / Delete / Activate)
- 📋 Full attendance table with filters and export (Excel/CSV)
- 🔴 Live attendance monitoring (real-time status)
- 🏖️ Leave management (approve/reject with comments)
- ✏️ Correction request review
- 📈 Reports (daily, weekly, monthly, employee-wise)
- 🎉 Holiday management
- 🏗️ Department management
- 🔔 Notifications
- 📝 Audit logs
- ⚙️ Company settings

### Employee
- ⏰ Mark Entry → Start Break → End Break → Mark Exit
- 📅 Monthly attendance calendar
- 📊 Working hours, break time, overtime calculation
- 🏖️ Apply/cancel leave requests
- 🔔 Notifications (leave status, late arrival)
- 📋 Attendance history

### Auth
- 🔐 JWT authentication with refresh tokens
- 🔑 Employee self-registration (Employee ID + Email verification)
- 🛡️ Role-based access control (Admin / Employee)
- 🔒 Password hashing with bcrypt

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State | Zustand |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) |

---

## 🚀 Quick Setup

### Prerequisites
- Node.js v18+
- Docker Desktop (for PostgreSQL) — OR — PostgreSQL installed locally

### 1. Clone / Navigate to project
```bash
cd attendance-system
```

### 2. Start PostgreSQL (via Docker)
```bash
docker-compose up -d
```
This starts PostgreSQL on port 5432.

> **Without Docker**: Create a PostgreSQL database named `attendance_db` and update `backend/.env` with your connection string.
> 
> **☁️ Using an Online Database (Neon / Supabase)**: Instead of local Docker, you can use a free cloud PostgreSQL database by setting `DATABASE_URL` in `backend/.env` and running `npx prisma db push`.
> 
> **🌐 Online Hosting (Vercel + Render + Neon)**: See [ONLINE_HOSTING_GUIDE.md](./ONLINE_HOSTING_GUIDE.md) for complete step-by-step instructions to deploy everything online for free.

### 3. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed sample data
npm run prisma:seed

# Start backend server
npm run dev
```

Backend runs on **http://localhost:5000**

### 4. Setup Frontend

```bash
# Open a new terminal
cd frontend

# Install dependencies
npm install

# Start frontend dev server
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## 🔑 Default Credentials

| Role | Email | Password |
|------|-------|---------|
| Admin | admin@techcorp.com | Admin@123 |
| Employee (Arun) | arun.kumar@techcorp.com | Employee@123 |
| Employee (Priya) | priya.sharma@techcorp.com | Employee@123 |
| *(All 10 employees)* | *see list below* | Employee@123 |

### All Demo Employees
| ID | Name | Email |
|----|------|-------|
| E001 | Arun Kumar | arun.kumar@techcorp.com |
| E002 | Priya Sharma | priya.sharma@techcorp.com |
| E003 | Ravi Patel | ravi.patel@techcorp.com |
| E004 | Sneha Reddy | sneha.reddy@techcorp.com |
| E005 | Rahul Mehta | rahul.mehta@techcorp.com |
| E006 | Kavya Nair | kavya.nair@techcorp.com |
| E007 | Arjun Singh | arjun.singh@techcorp.com |
| E008 | Meera Krishnan | meera.krishnan@techcorp.com |
| E009 | Vikram Joshi | vikram.joshi@techcorp.com |
| E010 | Deepa Thomas | deepa.thomas@techcorp.com |

---

## 🔑 New Employee Registration Flow

When admin adds a new employee:
1. Admin logs in → Employees → Add Employee (fills name, email, Employee ID)
2. Employee visits `/register`
3. Employee enters their **Employee ID** + **work email**
4. Employee sets their own **password** (min 8 characters)
5. Employee can now log in at `/login`

---

## 📁 Project Structure

```
attendance-system/
├── docker-compose.yml          # PostgreSQL via Docker
├── backend/
│   ├── .env                    # Environment variables
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (11 tables)
│   │   └── seed.ts             # Sample data
│   └── src/
│       ├── index.ts            # Express server
│       ├── middleware/         # Auth, error handler
│       ├── controllers/        # Business logic
│       ├── routes/             # API routes
│       └── utils/              # Calculations, Prisma client
└── frontend/
    └── src/
        ├── App.tsx             # Router with protected routes
        ├── pages/
        │   ├── Login.tsx
        │   ├── Register.tsx
        │   ├── admin/          # 13 admin pages
        │   └── employee/       # 4 employee pages
        ├── components/
        │   └── layout/         # Sidebar, TopBar layouts
        ├── services/api.ts     # Axios with JWT
        ├── store/authStore.ts  # Zustand auth store
        ├── types/index.ts      # TypeScript interfaces
        └── utils/index.ts      # Helpers
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Employee self-registration |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/employees` | List employees (admin) |
| POST | `/api/employees` | Add employee (admin) |
| GET | `/api/attendance/today` | Today's attendance |
| POST | `/api/attendance/entry` | Mark entry |
| POST | `/api/attendance/exit` | Mark exit |
| POST | `/api/attendance/break/start` | Start break |
| POST | `/api/attendance/break/end` | End break |
| GET | `/api/attendance/live` | Live status (admin) |
| POST | `/api/leave` | Apply leave |
| PATCH | `/api/leave/:id/status` | Approve/reject leave (admin) |
| GET | `/api/reports/export` | Export Excel/CSV |

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendance_db"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
```

---

## 📊 Business Rules

- ❌ Cannot mark Entry twice on the same day
- ❌ Cannot Start Break before Entry
- ❌ Cannot start a break while already on break
- ❌ Cannot Mark Exit before Entry
- ❌ Must End Break before marking Exit
- ✅ Late = Entry after `officeStartTime + lateThresholdMinutes`
- ✅ Overtime = Working hours > required hours (default 8h)
- ✅ Half Day = Working hours < required/2 (default 4h)
- ✅ Missing Checkout = Entry marked but no Exit by end of day

---

## 🔒 Security

- Password hashing with bcrypt (12 rounds)
- JWT access tokens (15 min expiry)
- JWT refresh tokens (7 days, rotated on use)
- Role-based access control (Admin/Employee guards)
- Rate limiting (200 req/15min)
- CORS restricted to frontend origin
- Helmet.js security headers
- Input validation with Zod

---

## 📞 Support

For issues, check:
1. PostgreSQL is running: `docker ps` or check port 5432
2. Backend `.env` has correct `DATABASE_URL`
3. Prisma migrations ran: `npx prisma migrate dev`
4. Seed data loaded: `npm run prisma:seed`
