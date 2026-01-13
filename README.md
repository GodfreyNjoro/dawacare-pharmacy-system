# 🏥 DawaCare Pharmacy Management System

<div align="center">

![DawaCare Logo](https://img.shields.io/badge/DawaCare-Pharmacy%20Management-0891b2?style=for-the-badge&logo=medical&logoColor=white)

**Complete end-to-end pharmacy management solution with cloud web platform and offline-first desktop POS**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-Latest-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.7-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Web App Demo](https://dawacare.abacusai.app) • [Download Desktop App](#-desktop-app-downloads) • [Documentation](#-documentation)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Web Application Setup](#web-application-setup)
  - [Desktop Application Setup](#desktop-application-setup)
- [Desktop App Downloads](#-desktop-app-downloads)
- [Deployment](#-deployment)
- [Technology Stack](#-technology-stack)
- [Development Roadmap](#-development-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

DawaCare is a comprehensive pharmacy management system designed for pharmacies of all sizes. It provides:

- **☁️ Cloud Web Platform**: Full-featured web application for centralized management, reporting, and multi-branch operations
- **💻 Desktop POS App**: Native offline-first point-of-sale application with hardware integration (thermal printers, barcode scanners)
- **🔄 Bi-directional Sync**: Seamless synchronization between desktop and cloud platforms
- **📊 Real-time Analytics**: Comprehensive reports, inventory tracking, and business insights

### Key Differentiators

✅ **Offline-First Architecture**: Desktop app works without internet, syncs when connected  
✅ **Multi-Database Support**: Choose between SQLite (zero-config) or PostgreSQL (high-performance)  
✅ **Hardware Integration**: Native support for thermal printers and barcode scanners  
✅ **Multi-Branch Ready**: Centralized cloud management with branch-level control  
✅ **Role-Based Access**: Admin, Pharmacist, and Cashier roles with granular permissions  
✅ **Modern Tech Stack**: Built with Next.js 14, Electron, Prisma, and TypeScript  

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLOUD WEB PLATFORM                      │
│                  (dawacare.abacusai.app)                    │
│                                                             │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐         │
│  │   POS     │  │ Inventory  │  │   Reports    │         │
│  │  System   │  │ Management │  │  & Analytics │         │
│  └───────────┘  └────────────┘  └──────────────┘         │
│                                                             │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐         │
│  │Procurement│  │  Multi-    │  │  Accounting  │         │
│  │  & GRN    │  │  Branch    │  │   Exports    │         │
│  └───────────┘  └────────────┘  └──────────────┘         │
│                                                             │
│              PostgreSQL Cloud Database                     │
└─────────────────────────────────────────────────────────────┘
                          ↕️  REST API + WebSockets
┌─────────────────────────────────────────────────────────────┐
│                  DESKTOP POS APPLICATION                    │
│               (Windows / macOS / Linux)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Offline-First POS System                 │ │
│  │  • Local Sales Processing  • Receipt Printing         │ │
│  │  • Barcode Scanning        • Cash Management          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────┐          ┌─────────────────┐        │
│  │  Local Database │          │   Hardware API  │        │
│  │ SQLite/Postgres │          │ Printers/Scanner│        │
│  └─────────────────┘          └─────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **Desktop → Cloud**: Sales, inventory updates, and customer data sync via REST API
2. **Cloud → Desktop**: Price updates, new products, and system announcements via WebSockets (planned)
3. **Offline Operation**: Desktop app fully functional without internet; queues sync operations

---

## 🚀 Features

### Cloud Web Platform (✅ Live)

#### Phase 1-2: Core Operations (100% Complete)
- ✅ User authentication with role-based access control
- ✅ Medicine inventory management (CRUD, search, batch tracking)
- ✅ Point of Sale (POS) system with multiple payment methods
- ✅ Sales history and invoice generation
- ✅ Customer management with loyalty tracking
- ✅ Real-time dashboard with key metrics

#### Phase 3: Multi-Branch Management (80% Complete)
- ✅ Branch creation and management
- ✅ Branch-level inventory tracking
- ⏳ Real-time stock transfers (pending)
- ⏳ Branch performance analytics (pending)

#### Phase 4: Accounting Integration (80% Complete)
- ✅ Account mapping configuration
- ✅ Export to Excel/CSV formats
- ⏳ Scheduled auto-exports (pending)
- ⏳ QuickBooks integration (pending)

#### Procurement Management (100% Complete)
- ✅ Supplier management
- ✅ Purchase order creation and tracking
- ✅ Goods Received Note (GRN) system
- ✅ Automatic inventory updates from GRNs

### Desktop POS Application (🚧 In Development)

#### Phase 1: Foundation (✅ Complete)
- ✅ Cross-platform support (Windows, macOS, Linux)
- ✅ Dual database system (SQLite + PostgreSQL)
- ✅ Database setup wizard
- ✅ Local authentication
- ✅ Role-based access control
- ✅ Modern React UI with Tailwind CSS

#### Phase 2: Core POS Features (📅 Next)
- 📅 Offline POS system with barcode support
- 📅 Shopping cart management
- 📅 Receipt printing
- 📅 Local inventory management
- 📅 Stock alerts

#### Phase 3-7: Advanced Features (📅 Planned)
- 📅 Cloud sync engine
- 📅 Real-time push updates (WebSockets)
- 📅 Thermal printer integration
- 📅 Barcode scanner support
- 📅 Advanced reporting
- 📅 Multi-platform installers

---

## 📂 Project Structure

```
pharmacy_management_system/
│
├── nextjs_space/              # ☁️ Cloud Web Application
│   ├── app/                   # Next.js 14 App Router
│   │   ├── api/              # API routes (REST endpoints)
│   │   ├── dashboard/        # Main dashboard
│   │   ├── pos/              # Point of Sale interface
│   │   ├── inventory/        # Medicine management
│   │   ├── sales/            # Sales history & invoices
│   │   ├── procurement/      # Suppliers, POs, GRNs
│   │   ├── branches/         # Multi-branch management
│   │   ├── accounting/       # Exports & mappings
│   │   ├── reports/          # Analytics & reports
│   │   ├── customers/        # Customer management
│   │   └── users/            # User management
│   │
│   ├── components/           # Reusable React components
│   │   ├── ui/              # UI primitives (shadcn/ui)
│   │   ├── app-shell.tsx    # Main layout wrapper
│   │   └── providers.tsx    # Context providers
│   │
│   ├── lib/                  # Utilities & configs
│   │   ├── auth-options.ts  # NextAuth configuration
│   │   ├── db.ts            # Prisma client
│   │   ├── permissions.ts   # RBAC logic
│   │   └── utils.ts         # Helper functions
│   │
│   ├── prisma/
│   │   └── schema.prisma    # Database schema (PostgreSQL)
│   │
│   ├── public/              # Static assets
│   └── package.json         # Dependencies
│
├── desktop_app/              # 💻 Desktop POS Application
│   ├── src/
│   │   ├── main/            # Electron main process
│   │   │   ├── main.ts      # App entry point
│   │   │   ├── preload.ts   # Context bridge
│   │   │   ├── database/    # Database adapters
│   │   │   └── ipc/         # IPC handlers
│   │   │
│   │   ├── renderer/        # React UI (renderer process)
│   │   │   ├── App.tsx      # Main React app
│   │   │   ├── pages/       # Application pages
│   │   │   └── components/  # React components
│   │   │
│   │   └── shared/          # Shared types & constants
│   │
│   ├── prisma/
│   │   └── schema.prisma    # Local database schema
│   │
│   ├── build/               # Electron-builder configs
│   ├── package.json
│   └── README.md            # Desktop app documentation
│
├── .github/
│   └── workflows/           # GitHub Actions CI/CD
│       └── build-desktop.yml # Auto-build installers
│
├── .gitignore
├── README.md                 # This file
└── LICENSE
```

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **Package Manager**: npm or yarn
- **Database** (for web app): PostgreSQL 14+
- **Git**: For version control

### Web Application Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/GodfreyNjoro/dawacare-pharmacy-system.git
   cd dawacare-pharmacy-system/nextjs_space
   ```

2. **Install dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/dawacare"
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Initialize database**
   ```bash
   yarn prisma db push
   yarn prisma db seed
   ```

5. **Start development server**
   ```bash
   yarn dev
   ```

6. **Access the application**
   - Open http://localhost:3000
   - Default login: `admin@dawacare.local` / `admin123`

### Desktop Application Setup

1. **Navigate to desktop app directory**
   ```bash
   cd desktop_app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development mode**
   ```bash
   npm run dev
   ```

4. **Build for distribution**
   ```bash
   # Build for current platform
   npm run package
   
   # Build for specific platforms
   npm run package:win    # Windows
   npm run package:mac    # macOS
   npm run package:linux  # Linux
   
   # Build for all platforms
   npm run package:all
   ```

5. **First-time setup**
   - On first launch, the setup wizard will guide you through database configuration
   - Choose SQLite (recommended) or PostgreSQL
   - Default admin login: `admin@dawacare.local` / `admin123`

📖 **For detailed desktop app documentation, see [desktop_app/README.md](desktop_app/README.md)**

---

## 📦 Desktop App Downloads

### Automated Builds (via GitHub Actions)

Desktop installers are automatically built and released via GitHub Actions whenever a new version is tagged.

#### Latest Release

| Platform | Download | File Size | Notes |
|----------|----------|-----------|-------|
| 🪟 **Windows** | [Download .exe](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/DawaCare-POS-Setup.exe) | ~150 MB | Windows 10/11 (64-bit) |
| 🍎 **macOS** | [Download .dmg](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/DawaCare-POS.dmg) | ~180 MB | macOS 10.13+ (Intel & Apple Silicon) |
| 🐧 **Linux** | [Download .AppImage](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/DawaCare-POS.AppImage) | ~160 MB | Universal Linux package |
| 🐧 **Linux (Debian/Ubuntu)** | [Download .deb](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/dawacare-pos.deb) | ~160 MB | Debian-based distros |

#### Installation Instructions

**Windows:**
1. Download the `.exe` file
2. Run the installer
3. Windows SmartScreen may show a warning (click "More info" → "Run anyway")
4. Follow the setup wizard

**macOS:**
1. Download the `.dmg` file
2. Open the DMG and drag DawaCare POS to Applications
3. First launch: Right-click → Open (to bypass Gatekeeper for unsigned apps)

**Linux (AppImage):**
```bash
chmod +x DawaCare-POS.AppImage
./DawaCare-POS.AppImage
```

**Linux (Debian/Ubuntu):**
```bash
sudo dpkg -i dawacare-pos.deb
sudo apt-get install -f  # Install dependencies
```

### Creating a New Release

To trigger an automated build:

```bash
# Tag a new version
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically:
# 1. Build installers for Windows, macOS, and Linux
# 2. Create a GitHub Release
# 3. Upload all installers as release assets
```

---

## 🌐 Deployment

### Web Application Deployment

The web application is currently deployed at:
- **Production**: https://dawacare.abacusai.app

The deployment uses Abacus.AI's hosting platform with:
- Automatic SSL certificates
- PostgreSQL database
- Environment variable management
- Zero-downtime deployments

### Desktop Application Distribution

Desktop installers are distributed via:
1. **GitHub Releases**: Automated builds attached to releases
2. **Direct Download**: Users download installers from GitHub
3. **Auto-updates** (planned): Future versions will support automatic updates

---

## 🔧 Technology Stack

### Web Application

| Category | Technology | Purpose |
|----------|------------|----------|
| **Framework** | Next.js 14 | React framework with App Router |
| **Language** | TypeScript | Type-safe development |
| **Database** | PostgreSQL | Relational database |
| **ORM** | Prisma 6.7 | Type-safe database access |
| **Authentication** | NextAuth.js | Session management |
| **UI Framework** | Tailwind CSS | Utility-first styling |
| **UI Components** | shadcn/ui + Radix UI | Accessible component library |
| **Animations** | Framer Motion | Smooth transitions |
| **Forms** | React Hook Form + Zod | Form validation |
| **Charts** | Recharts + Chart.js | Data visualization |
| **Notifications** | Sonner | Toast notifications |

### Desktop Application

| Category | Technology | Purpose |
|----------|------------|----------|
| **Framework** | Electron | Cross-platform desktop apps |
| **UI Library** | React 18 | Component-based UI |
| **Language** | TypeScript | Type-safe development |
| **Build Tool** | Vite | Fast development builds |
| **Database** | SQLite / PostgreSQL | Local data storage |
| **ORM** | Prisma 6.7 | Database abstraction |
| **UI Framework** | Tailwind CSS | Consistent styling |
| **Packaging** | electron-builder | Multi-platform builds |
| **State Management** | React Hooks + Context | Local state management |
| **Storage** | electron-store | Settings persistence |

---

## 🗺️ Development Roadmap

### ✅ Completed Phases

- **Phase 1-2**: Core inventory, sales, and POS system (Web)
- **Phase 3**: Multi-branch management (Web) - 80%
- **Phase 4**: Accounting exports (Web) - 80%
- **Desktop Phase 1**: Foundation and database setup (Desktop)

### 🚧 Current Sprint

- **Desktop Phase 2**: Core offline POS features
  - Offline sales processing
  - Receipt printing
  - Local inventory management
  - Stock alerts

### 📅 Upcoming Features

#### Q1 2026
- **Desktop Phase 3**: Cloud synchronization engine
- **Desktop Phase 4**: Real-time push updates (WebSockets)
- **Web**: Complete multi-branch stock transfers

#### Q2 2026
- **Desktop Phase 5**: Hardware integration (printers, scanners)
- **Desktop Phase 6**: Advanced features (reports, backup)
- **Desktop Phase 7**: Installer and auto-update system

#### Q3 2026
- **Phase 5**: M-Pesa payment integration (Web + Desktop)
- **Phase 6**: Advanced compliance and audit features
- **Phase 7**: Mobile app (React Native)

### 💡 Future Considerations

- AI-powered inventory forecasting
- Prescription verification system
- Insurance claim management
- E-commerce integration
- WhatsApp/SMS notifications
- Multi-currency support

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style (ESLint + Prettier)
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/discussions)
- **Email**: support@dawacare.com

---

## 🙏 Acknowledgments

- Built with [Abacus.AI](https://abacus.ai) DeepAgent
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Inspired by modern pharmacy management practices

---

<div align="center">

**Made with ❤️ for pharmacies worldwide**

[⭐ Star this repo](https://github.com/GodfreyNjoro/dawacare-pharmacy-system) • [🐛 Report Bug](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/issues) • [💡 Request Feature](https://github.com/GodfreyNjoro/dawacare-pharmacy-system/issues)

</div>
