# Changelog

All notable changes to the **Limra Restaurant ERP & E-Commerce Web App** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.5.0] - 2026-08-13

### 🚀 Major Feature — Petpooja-Inspired Dashboard Redesign

#### Added
- **Petpooja Theme & Color Palette**:
  - Warm Off-White background (`#FAFAF8`) for reduced eye strain during long shifts.
  - Deep Charcoal header & sidebar (`#1C1917`) for high-contrast visibility.
  - Saffron-Orange accent (`#E8590C`) for primary interactive buttons and active states.
  - Standardized Status Colors: Green (Confirmed/Paid), Amber (Pending/Hold), Blue (Ready), Red (Cancelled/Unpaid).
  - Modern Typography: *Manrope* (Headings), *Inter* (Body), *JetBrains Mono* (Prices & Numbers).
  - Rounded `12px` cards with subtle borders (`#E7E5E4`) and soft shadows.

- **Collapsible Section Component Architecture (`.adm-collapsible-section`)**:
  - Interactive headers with smooth max-height animation and chevron indicator.
  - **State Persistence**: Expand/collapse choices are automatically saved per-user in `localStorage`.
  - **Section 1 (Live Orders Stream & Date Filter)** — *Default Open*: Quick presets (`Today`, `Yesterday`, `Last 7 Days`, `This Month`, `All Time`), summary metrics bar, and live date preview table.
  - **Section 2 (KPI Performance & Tax Breakdown)** — *Default Open*: Key metric cards + dedicated **CGST (2.5%) & SGST (2.5%) Tax Split Overview** card.
  - **Section 3 (Sales Reports & Revenue Visualizations)** — *Default Collapsed*: Order status donut charts, weekly order trends, monthly revenue growth, and bookings charts.

- **Petpooja Top Bar & Quick Action Dock**:
  - **Store Status Toggle Switch**: `🟢 ACCEPTING ORDERS` vs `🔴 STORE CLOSED` toggle with instant state persistence in `localStorage`.
  - **Quick Dock Bar**:
    - `💳 + New POS Bill`: Direct shortcut to POS Billing interface.
    - `⏸️ Hold Orders`: Quick jump to active held table orders.
    - `🧾 Reprint Last Bill`: One-click re-printing of the latest order receipt.
    - `🖨️ Printer Status`: Real-time QZ Tray thermal printer connection status monitor.
  - **Sidebar Section Sub-Headers**: Categorized navigation (*DAILY OPERATIONS*, *MENU & STOCK*, *MARKETING & CRM*, *ANALYTICS & SYSTEM*).
  - **Compact Sidebar Mode (`.compact`)**: Toggle icon-only sidebar mode for maximized dashboard workspace.

#### Fixed
- **Hold Orders Chips Rendering**: Fixed bug where table hold chips failed to refresh by adding `renderPosHoldOrdersChips()` into the global `renderAll()` dashboard loop.
- **CGST/SGST Tax Split**: Updated POS checkout calculations, dashboard displays, and receipt formatting to split 5% GST into separate **2.5% CGST** and **2.5% SGST** lines.

---

## [2.4.0] - 2026-08-04

### Added
- Advanced Stock & Inventory Management Module (`/stock-manager/`).
- Stock In / Stock Out entry logs with PDF upload supporting invoice attach.
- Real-time low stock threshold alerts.

---

## [2.3.0] - 2026-07-15

### Added
- Table QR Code Self-Ordering system (`/table/`).
- Real-time order placement via WebSockets pub/sub.
- Table bill request and waiter call notifications.

---

## [2.2.0] - 2026-07-10

### Added
- QZ Tray direct thermal receipt and KOT printing integration.
- Automated delivery area radius calculator and fee assignment.
