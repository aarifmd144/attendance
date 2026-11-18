# 🌐 Online Hosting & Deployment Guide

This guide explains how to host the **Attendance Management System** online using 100% free cloud services.

---

## 📑 Table of Contents
1. [Step 1: Set Up Free Online PostgreSQL Database (Neon or Supabase)](#step-1-free-online-database)
2. [Step 2: Deploy Backend Online (Render)](#step-2-deploy-backend-render)
3. [Step 3: Deploy Frontend Online (Vercel)](#step-3-deploy-frontend-vercel)
4. [Alternative A: Single-Host Full-Stack Deployment (Render / Railway)](#alternative-a-single-host)
5. [Alternative B: Instant Public Online Access via Cloudflare Tunnel (No Deploy Required)](#alternative-b-cloudflare-tunnel)

---

<a id="step-1-free-online-database"></a>
## Step 1: Set Up Free Online Database (Neon.tech or Supabase)

You can get a fast, free PostgreSQL database online in under 2 minutes without needing a credit card.

### Option 1.1: Neon (Recommended)
1. Go to [https://neon.tech](https://neon.tech) and sign up with GitHub or Google.
2. Click **Create Project**, name it `attendance-db`, and click **Create**.
3. In your dashboard, copy the **Connection string** (Direct or Pooled, either works). It looks like:
   ```env
   postgresql://neondb_owner:xyz123@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Option 1.2: Supabase
1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Go to **Project Settings** → **Database** → **Connection String** → **URI**.
3. Copy the URI and replace `[YOUR-PASSWORD]` with your database password.

### Initialize Your Online Database Schema:
From your local terminal, navigate to `attendance-system/backend`:
```bash
cd backend

# Set your remote database URL in .env or run directly:
npx prisma db push

# Populate with initial demo users and departments
npm run prisma:seed
```
Your online database is now fully populated with all tables and demo accounts!

---

<a id="step-2-deploy-backend-render"></a>
## Step 2: Deploy Backend Online (Render.com)

Render provides free hosting for Node.js web services.

1. Push your repository to GitHub or GitLab.
2. Sign in to [https://render.com](https://render.com).
3. Click **New +** → **Web Service**.
4. Connect your GitHub repository.
5. Configure the service:
   - **Name**: `attendance-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
6. Under **Environment Variables**, add:
   - `DATABASE_URL`: Your online database connection string (from Step 1)
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `JWT_SECRET`: Any random 32+ character string
   - `JWT_REFRESH_SECRET`: Any random 32+ character string
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://attendance-system.vercel.app` or `*` temporarily)
7. Click **Create Web Service**.
8. Note down your backend URL (e.g. `https://attendance-backend.onrender.com`).

---

<a id="step-3-deploy-frontend-vercel"></a>
## Step 3: Deploy Frontend Online (Vercel)

Vercel provides instant, global, free hosting for Vite React applications.

1. Sign in to [https://vercel.com](https://vercel.com).
2. Click **Add New** → **Project**.
3. Import your GitHub repository.
4. Set the project settings:
   - **Root Directory**: Select `frontend`
   - **Framework Preset**: `Vite`
5. Under **Environment Variables**, add:
   - `VITE_API_URL`: Your Render backend URL from Step 2 (e.g., `https://attendance-backend.onrender.com`)
6. Click **Deploy**.
7. Once deployed, copy your production frontend URL (e.g., `https://attendance-system.vercel.app`).
8. *(Important)*: Go back to Render → Environment Variables and update `FRONTEND_URL` to match this Vercel URL.

Your app is now completely live online! 🎉

---

<a id="alternative-a-single-host"></a>
## Alternative A: Single-Host Full-Stack Deployment (Render / Railway / VPS)

The backend Express server has been configured to optionally serve the compiled frontend (`frontend/dist`) directly. This allows you to run both frontend and backend on a single free online service.

### On Render / Railway:
1. Use the root directory of the repository.
2. Build command:
   ```bash
   npm --prefix frontend install && npm --prefix frontend run build && npm --prefix backend install && npm --prefix backend run build
   ```
3. Start command:
   ```bash
   cd backend && node dist/index.js
   ```
4. Set `DATABASE_URL` in environment variables.

---

<a id="alternative-b-cloudflare-tunnel"></a>
## Alternative B: Instant Public Online Access via Cloudflare Tunnel

If you want your local server to be instantly accessible over the public internet from anywhere (mobile, remote testing) **without deploying to the cloud**:

1. Install `cloudflared` (or run via npx / download):
   ```bash
   winget install --id Cloudflare.cloudflared
   ```
2. Start your local backend (`cd backend && npm run dev`) and frontend (`cd frontend && npm run dev`).
3. Open a new terminal and run:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
4. Cloudflare will print a free public URL:
   ```text
   https://random-words.trycloudflare.com
   ```
5. Anyone can open this link on their phone or computer to test the system live!
