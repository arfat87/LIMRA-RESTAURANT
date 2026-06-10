# 📷 DSLR WORLD — Backend API

> **Pan-India E-Commerce Backend** for DSLR WORLD Camera Store, Ranchi, Jharkhand
> Built with Node.js · TypeScript · PostgreSQL · Prisma · Razorpay · Shiprocket

---

## 🏪 About

DSLR WORLD is Ranchi's leading camera store, located at RR Plaza, Church Rd, near Karbala Chowk.  
This backend powers their pan-India e-commerce platform for new and second-hand cameras, lenses, accessories and more.

- ⭐ Rating: 4.8 (72 reviews)
- 📞 Phone: 062023 81019
- 📍 Address: RR Plaza, Church Rd, Ranchi, Jharkhand 834001

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm 9+

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Set Up Database
```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed admin user + sample data
```

### 4. Start Development Server
```bash
npm run dev
```

Server starts at **http://localhost:5000**

---

## 🔑 Default Admin Credentials

After seeding:
- **Email:** `admin@dslrworld.in`
- **Password:** `Admin@123`

> ⚠️ **Change the password immediately in production!**

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # DB, Cloudinary, Razorpay, Shiprocket
│   ├── middlewares/     # Auth, Admin, Error, Upload, RateLimit
│   ├── modules/
│   │   ├── auth/        # Register, Login, OTP, Password Reset
│   │   ├── user/        # Profile, Addresses
│   │   ├── product/     # Catalog, Search, Filter
│   │   ├── category/    # Category management
│   │   ├── cart/        # Shopping cart
│   │   ├── order/       # Order placement & tracking
│   │   ├── payment/     # Razorpay integration
│   │   ├── shipping/    # Shiprocket integration
│   │   ├── review/      # Product reviews
│   │   ├── wishlist/    # User wishlist
│   │   └── admin/       # Admin dashboard & management
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── utils/           # ApiError, ApiResponse, JWT, Email, SMS, Logger
│   ├── app.ts           # Express app
│   └── server.ts        # Entry point
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🔌 API Reference

**Base URL:** `http://localhost:5000/api/v1`

### 🔐 Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new customer |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout (protected) |
| POST | `/auth/refresh-token` | Refresh access token |
| POST | `/auth/send-otp` | Send OTP to phone |
| POST | `/auth/verify-otp` | Verify OTP |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password/:token` | Reset password |

### 👤 User (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user/me` | Get profile |
| PUT | `/user/me` | Update profile |
| PUT | `/user/me/avatar` | Upload avatar |
| GET | `/user/me/addresses` | List addresses |
| POST | `/user/me/addresses` | Add address |
| PUT | `/user/me/addresses/:id` | Update address |
| DELETE | `/user/me/addresses/:id` | Delete address |
| PUT | `/user/me/addresses/:id/default` | Set default address |

### 📦 Products (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List with filter/sort/paginate |
| GET | `/products/featured` | Featured products |
| GET | `/products/search?q=` | Full-text search |
| GET | `/products/:slug` | Single product |

**Query Params:** `page`, `limit`, `category`, `condition`, `minPrice`, `maxPrice`, `sort`, `brand`

### 🗂️ Categories (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories` | All categories |
| GET | `/categories/:slug/products` | Products in category |

### 🛒 Cart (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cart` | Get cart |
| POST | `/cart/add` | Add item |
| PUT | `/cart/update` | Update quantity |
| DELETE | `/cart/remove/:productId` | Remove item |
| DELETE | `/cart/clear` | Clear cart |

### 📋 Orders (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Place order |
| GET | `/orders` | My orders |
| GET | `/orders/:id` | Order details |
| POST | `/orders/:id/cancel` | Cancel order |
| GET | `/orders/:id/track` | Track shipment |

### 💳 Payment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payment/create-order` | Create Razorpay order (protected) |
| POST | `/payment/verify` | Verify payment (protected) |
| POST | `/payment/webhook` | Razorpay webhook (public, signed) |

### 🚚 Shipping (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/shipping/check-serviceability` | Check delivery to pincode |
| GET | `/shipping/track/:trackingId` | Track by AWB |

### ⭐ Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reviews/product/:productId` | Product reviews (public) |
| POST | `/reviews/product/:productId` | Add review (protected) |
| DELETE | `/reviews/:id` | Delete review (protected) |

### ❤️ Wishlist (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wishlist` | My wishlist |
| POST | `/wishlist/add/:productId` | Add to wishlist |
| DELETE | `/wishlist/remove/:productId` | Remove from wishlist |

### 🛠️ Admin (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Stats overview |
| GET | `/admin/users` | All users |
| DELETE | `/admin/users/:id` | Delete user |
| POST | `/admin/products` | Create product |
| PUT | `/admin/products/:id` | Update product |
| DELETE | `/admin/products/:id` | Delete product |
| POST | `/admin/products/:id/images` | Upload images |
| POST | `/admin/categories` | Create category |
| PUT | `/admin/categories/:id` | Update category |
| DELETE | `/admin/categories/:id` | Delete category |
| GET | `/admin/orders` | All orders |
| PUT | `/admin/orders/:id/status` | Update order status |
| GET | `/admin/reviews` | All reviews |
| DELETE | `/admin/reviews/:id` | Delete review |

---

## 🔒 Security

- **JWT:** Access tokens (15m) + Refresh tokens (7d) with rotation
- **Passwords:** bcrypt with 12 salt rounds
- **Rate Limiting:** 100 req/15min (general), 5 req/15min (auth), 3/10min (OTP)
- **Helmet:** Secure HTTP headers
- **CORS:** Restricted to `CLIENT_URL`
- **Zod:** Input validation on all endpoints
- **Razorpay Webhook:** HMAC signature verification
- **Prisma:** Parameterized queries (SQL injection protection)

---

## 🛠️ Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema without migration |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

---

## 💰 Pricing Notes

- All money values are stored in **paise** (smallest INR unit) in the database
- Example: ₹32,999 is stored as `3299900`
- Free shipping on orders above ₹500 (50000 paise)
- Frontend should display `value / 100` with `toLocaleString('en-IN')`

---

## 📧 Services Required

| Service | Purpose | Signup |
|---------|---------|--------|
| PostgreSQL | Database | Local or [Railway](https://railway.app) |
| Cloudinary | Image storage | [cloudinary.com](https://cloudinary.com) |
| Razorpay | Payments | [razorpay.com](https://razorpay.com) |
| Shiprocket | Shipping | [shiprocket.in](https://shiprocket.in) |
| Gmail | Email (SMTP) | Enable 2FA + App Password |
| MSG91 | SMS OTP | [msg91.com](https://msg91.com) |

---

## 📦 Seeded Data

After running `npm run db:seed`:
- ✅ Admin user: `admin@dslrworld.in` / `Admin@123`
- ✅ 6 categories: DSLR Cameras, Mirrorless, Lenses, Accessories, Action Cameras, Second-Hand
- ✅ 4 sample products (Canon, Nikon)

---

*Built with ❤️ for DSLR WORLD — Ranchi's #1 Camera Store*
