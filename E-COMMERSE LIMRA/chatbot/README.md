# LIMRA Restaurant WhatsApp Chatbot & Marketing Engine

A fully self-contained, real-time automated WhatsApp Chatbot service for **LIMRA Restaurant**.

---

## 🌟 Core Features

1. **Real-time Order Alerts**: Instantly listens to PostgreSQL inserts and status updates via InsForge WebSockets and sends alerts for:
   * **Order Received**: When order is placed.
   * **Order Confirmed**: When approved by the chef.
   * **Order Prepared**: When ready to pick up or deliver.
   * **Order Delivered**: When delivery is successfully completed.
2. **Review Auto-Solicitor**: Triggers a friendly review request follow-up message 1 hour after successful deliveries.
3. **Weekly Marketing Cron Blast**: Queries past customer records and sends a mouth-watering Biryani blast every Saturday at 11 AM to drive Sunday restaurant traffic.
4. **Interactive 2-Way Chatbot**: Provides an interactive reply menu (Order Status Lookup, Specials Menu, Reservation URL, Team Contact) when users text the chatbot!
5. **No-Cost Sandbox Simulation**: Operates beautifully on a `mock` fallback provider, appending all compiled WhatsApp alerts to `logs/whatsapp-sent-mock.log` for zero-cost developer testing.

---

## 🛠️ Setup & Local Testing

### Step 1: Install Dependencies
Inside this directory:
```bash
npm install
```

### Step 2: Configure Environment
Configurations are loaded from the workspace `.env` file automatically. You can customize keys inside that file:
```env
WHATSAPP_PROVIDER=mock  # 'mock' | 'twilio' | 'meta'
```

### Step 3: Launch Chatbot Server
Start the Express server:
```bash
npm start
```

### Step 4: Verify Automation
* Trigger an order status change in the Limra Admin Panel (e.g. pending ➔ confirmed).
* Open `chatbot/logs/whatsapp-sent-mock.log` to watch the formatted WhatsApp notification arrive instantly!
