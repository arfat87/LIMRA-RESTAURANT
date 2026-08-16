# 🍽️ LIMRA Restaurant — Full-Stack Restaurant E-Commerce Platform

> **Live Website:** [limraresturent.in](https://limraresturent.in)  
> **Owner:** SK Arif | LIMRA Restaurant, Egra, Purba Medinipur, West Bengal

---

## 📖 Project Overview

LIMRA Restaurant is a **complete, production-grade restaurant e-commerce web application** built from the ground up. It covers the full customer-to-kitchen lifecycle — from browsing a 202-item menu, placing delivery or dine-in orders, tracking orders in real time, and making payments online, all the way to an admin dashboard that manages every order, booking, coupon, combo, and notification.

The app is **multi-page** (not an SPA), using Vite as the build tool and InsForge as the backend-as-a-service (PostgreSQL + Auth + Realtime WebSockets).

---

## 🗺️ Pages & Entry Points

| Page | File | Purpose |
|------|------|---------|
| **Customer Website** | `index.html` | Main public-facing page |
| **Admin Dashboard** | `admin.html` | Full restaurant management panel |
| **Admin Login** | `admin-login.html` | Authenticated admin access |
| **Dine-In / Table Ordering** | `table/index.html` | QR-code scanned table-side ordering |
| **QR Code Generator** | `table/qr-admin.html` | Generate & print QR codes per table |
| **Stock Manager** | `stock-manager/index.html` | Raw materials & inventory tracker |
| **Privacy Policy** | `privacy.html` | Legal compliance page |

---

## 🧩 Key Features

### 🛒 Customer-Facing Website (`index.html`)
- **Hero Section** — Restaurant branding, call-to-action buttons, seasonal offers
- **Interactive Menu** — 202 dishes across 22 categories (Biryani, Tandoor, Chinese, Desserts, Mocktails, etc.)
- **Real-Time Food Search** — Instant filter with clear button
- **Cart System** — Persistent cart via localStorage, reactive AntigravityStore, quantity management, spring-bounce micro-animations
- **Coupon Codes** — Apply discount codes with expiry, usage limits, minimum bill validation
- **Delivery / Self-Pickup Toggle** — Delivery only available 1:00 PM – 10:30 PM
- **Area-Based Delivery Charges** — Pre-set charges for local villages (Jerthan Rs20, Egra Rs100, etc.)
- **Interactive Delivery Map** — Leaflet.js + OpenStreetMap, GPS detection, address autocomplete, haversine distance calculation, satellite/street toggle
- **Online Payment** — Razorpay integration plus COD, UPI/WhatsApp Pay, and Card on Delivery
- **Real-Time Order Tracking** — WebSocket subscription via InsForge Realtime; HTTP polling fallback every 10 seconds
- **WhatsApp Order Fallback** — Formatted WhatsApp message via wa.me
- **Booking System** — Table, Party, and Wedding bookings with visual seat map selection
- **Booking Lookup** — Customers check bookings by phone number
- **Photo Gallery** — Filterable grid with full-screen lightbox (keyboard navigable)
- **Customer Notifications** — Real-time bell icon with unread badge, in-app tray
- **Saved Address** — Remembers customer details in localStorage
- **Product Detail Modal** — Full dish info popup on card click
- **Sticky Header** — Active nav highlight on scroll, mobile hamburger menu, back-to-top button
- **SEO Optimised** — sitemap.xml, robots.txt, semantic HTML, meta tags, lazy-loaded images

---

### 🏢 Admin Dashboard (`admin.html`)
- **Secure Login** — Email/password auth via InsForge; session-protected routes
- **Live Notifications** — Real-time WebSocket notifications for new orders and bookings; audio chime
- **Orders Panel** — Full orders table with status management (Pending → Preparing → Out for Delivery → Delivered / Cancelled); email confirmation/cancellation; payment status toggle; payment audit log
- **Bookings Panel** — All table/party/wedding bookings with status management
- **Menu Management** — Override any menu item price, MRP, availability, featured flag, and description in real time
- **Coupon Manager** — Create, edit, delete discount coupons with discount %, expiry date, usage limit, minimum bill
- **Combo Builder** — Create meal combos with names, prices, item lists, and images
- **Delivery Areas Manager** — Add/edit/remove delivery zones with per-area flat charges
- **Analytics Dashboard** — Chart.js charts for daily revenue, order volume, popular items, booking trends
- **Admin Toast Notifications** — Slide-in success/error toasts for all admin actions

---

### 🍽️ Dine-In Table Ordering (`table/index.html`)
- Customers scan a QR code at their table (e.g., `?t=5`); validates table 1–19
- Full menu browsable on mobile with category tabs and search
- Cart management, coupon validation, combo support
- Order placed directly from table saved with `order_type = 'table'`
- After ordering, customers prompted to leave a Google Review
- **Owner View** — No table parameter shows the QR Admin panel
- **QR Admin** (`table/qr-admin.html`) — Generate and print QR codes for all 19 tables

---

### 📦 Stock Manager (`stock-manager/index.html`)

**7 Stock Categories:**
1. Bhusimal & Spices (rice, oils, flour, sauces, spices — 20+ items)
2. Dairy Items (milk, curd, paneer, butter, cream, cheese)
3. Cold Drinks (Campa, Thums Up, Sprite, Bisleri, Kinley)
4. Fresh Vegetables (potato, onion, ginger, garlic, capsicum, tomato)
5. Ice Cream (Amul/Kwality Wall's varieties)
6. Packaging & Carry Bags (food containers, carry bags)
7. Cleaning & Washings (Vim, Harpic)

**Features:** Low-stock alerts, add/reduce stock transactions, history log, category filter, CSV export, localStorage persistence.

---

## 🗄️ Database Schema (InsForge / PostgreSQL)

| Table / RPC | Purpose |
|---|---|
| `orders` | All customer orders (delivery, pickup, dine-in) |
| `order_items` | Line items per order |
| `bookings` | Table, party, wedding reservations |
| `menu_overrides` | Admin price/availability overrides for menu items |
| `coupons` | Discount coupon codes |
| `coupon_usage` | Per-customer coupon redemption tracking |
| `combos` | Meal combo deals |
| `delivery_areas` | Configurable delivery zones with charges |
| `notifications` | Admin-side in-app notifications |
| `customer_notifications` | Customer-side order/payment notifications |
| `payment_history` | Audit log for payment status changes |
| `place_order` (RPC) | Atomic order placement stored procedure |
| `place_booking` (RPC) | Atomic booking creation stored procedure |
| `get_customer_orders` (RPC) | Phone-number-based order lookup |
| `get_customer_bookings` (RPC) | Phone-number-based booking lookup |
| `update_order_payment_status` (RPC) | Secure payment status change |
| `create_notification` (RPC) | Create admin notification |

18 SQL migration files are in `migrations/` tracking schema history.

---

## 💳 Payment System

| Method | Implementation |
|---|---|
| **Razorpay (Online)** | `api/create-order.js` creates Razorpay order; `api/verify-payment.js` verifies HMAC signature |
| **Cash on Delivery** | Order saved immediately; payment status = unpaid |
| **UPI / WhatsApp Pay** | Customer shown UPI QR; UTR number collected and verified by admin |
| **Card on Delivery** | Order saved; payment collected in-person |

---

## 📧 Notification System

| Channel | Status |
|---|---|
| In-App (WebSocket) | Live — InsForge Realtime pub/sub |
| Email (Resend API) | Plug-and-play — configure VITE_RESEND_API_KEY |
| Email (EmailJS fallback) | Plug-and-play — configure VITE_EMAILJS_* keys |
| SMS | Stub ready — plug in Twilio/Plivo/MSG91 |
| WhatsApp Business | Stub ready — plug in WhatsApp Business API |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML, JavaScript (ES Modules), CSS |
| **CSS Framework** | Tailwind CSS v4 (via @tailwindcss/vite) |
| **Build Tool** | Vite v8 |
| **Backend-as-a-Service** | InsForge (PostgreSQL, Auth, Realtime, Storage) |
| **Maps** | Leaflet.js + OpenStreetMap + Nominatim geocoding |
| **Charts** | Chart.js v4 |
| **Payment Gateway** | Razorpay |
| **QR Code Generation** | qrcode npm package |
| **Email** | Resend API / EmailJS |
| **Hosting** | Vercel (frontend) + InsForge (backend) |

---

## 📂 Project Structure

```
E-COMMERSE LIMRA website/
├── index.html                  # Main customer website (~124 KB)
├── admin.html                  # Admin dashboard
├── admin-login.html            # Admin login page
├── privacy.html                # Privacy policy
│
├── table/
│   ├── index.html              # Dine-in ordering (QR code)
│   └── qr-admin.html           # QR code generator
│
├── stock-manager/
│   └── index.html              # Stock/inventory manager
│
├── src/
│   ├── main.js                 # Customer website logic (~4,637 lines)
│   ├── admin.js                # Admin dashboard logic (~4,330 lines)
│   ├── admin-login.js          # Login flow logic
│   ├── style.css               # Global CSS design system
│   ├── admin.css               # Admin-specific styles
│   │
│   ├── data/
│   │   └── menu.js             # 202-item menu, categories, emojis, images
│   │
│   ├── lib/
│   │   ├── insforge.js         # InsForge SDK client + all DB operations
│   │   ├── payments.js         # PaymentService (mark paid/unpaid, audit log)
│   │   ├── notifications.js    # NotificationService (DB, email, SMS, WhatsApp)
│   │   ├── email-service.js    # Email via Resend / EmailJS / console fallback
│   │   └── admin-routes.js     # Admin login redirect helper
│   │
│   ├── table/
│   │   └── table.js            # Dine-in table ordering logic (~1,120 lines)
│   │
│   └── stock-manager/
│       ├── stock-manager.js    # Inventory management logic (~1,130 lines)
│       └── stock-manager.css   # Stock manager styles
│
├── api/
│   ├── create-order.js         # Vercel serverless: Razorpay order creation
│   └── verify-payment.js       # Vercel serverless: Razorpay payment verification
│
├── migrations/                 # 18 SQL migration files (schema history)
├── public/                     # Static assets (favicon, images, robots.txt, sitemap.xml)
│
├── package.json                # npm dependencies & scripts
├── vite.config.js              # Multi-page Vite build config
├── vercel.json                 # Vercel routing & rewrite rules
├── insforge.toml               # InsForge auth config
└── .env.example                # Environment variable template
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- An [InsForge](https://insforge.app) project with the database schema applied
- (Optional) Razorpay account, Resend account / EmailJS account

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd "E-COMMERSE LIMRA website"
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
VITE_INSFORGE_URL=https://your-appkey.us-east.insforge.app
VITE_INSFORGE_ANON_KEY=your_anon_key_here

# Optional — Email notifications
VITE_RESEND_API_KEY=re_xxxxxxxxxxxx
VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxx

# Optional — Razorpay online payment
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_here
```

### 3. Apply Database Migrations

Run all SQL files in `migrations/` against your InsForge project in chronological order using the InsForge dashboard SQL editor or MCP tool.

### 4. Run Development Server

```bash
npm run dev
```

| URL | Description |
|---|---|
| `http://localhost:5173/` | Customer website |
| `http://localhost:5173/admin.html` | Admin dashboard |
| `http://localhost:5173/admin-login.html` | Admin login |
| `http://localhost:5173/table/?t=1` | Table ordering (table 1–19) |
| `http://localhost:5173/stock-manager/` | Stock manager |

### 5. Sync Menu Images (Optional)

```bash
npm run sync-images
```

### 6. Build for Production

```bash
npm run build
```

The `dist/` folder is the production output, ready for Vercel.

---

## 🚀 Deployment

### Vercel (Frontend)
`vercel.json` includes all URL rewrite rules for clean routes (`/admin`, `/table`, `/table/qr-admin`, etc.). Connect the repository to Vercel and deploy.

### InsForge (Backend)
Configure `insforge.toml` with your live domain in `allowed_redirect_urls` before deploying.

---

## 🔐 Security

- All database operations use **Row-Level Security (RLS)** policies in PostgreSQL
- Order placement and booking creation use **secure RPC stored procedures**, not direct table writes
- Payment verification uses **HMAC signature checks** on the server side
- Admin routes protected by **InsForge authentication**
- Input validation enforced both **client-side** and via **SQL CHECK constraints**

---

## 📞 Contact & Support

| Channel | Detail |
|---|---|
| Phone / WhatsApp | +91 97390 83418 |
| Email | limrarestaurant99@gmail.com |
| Address | LIMRA Restaurant (SK Arif), Egra, Purba Medinipur, West Bengal |

---

## 📝 License

This project is **proprietary** and owned by SK Arif (LIMRA Restaurant). All rights reserved. Not for redistribution.
