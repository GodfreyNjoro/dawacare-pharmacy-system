# DawaCare POS - Desktop Application

## Overview

DawaCare POS is an offline-first pharmacy management desktop application built with Electron, React, and TypeScript. It provides full POS functionality with cloud synchronization capabilities.

## 🎉 Phase 1 Complete - Foundation Ready!

### ✅ Completed Features

- **Cross-platform Support**: Windows, macOS, and Linux ready
- **Dual Database System**: 
  - SQLite (zero-config, perfect for small pharmacies)
  - PostgreSQL (high-performance for multi-user setups)
- **Database Setup Wizard**: Guided installation with connection testing
- **Authentication System**: Local user management with role-based access
- **Modern UI Framework**: React 18 with TypeScript and Tailwind CSS
- **IPC Communication**: Secure main-renderer process communication
- **Auto-update Ready**: Electron auto-updater configured

### 📦 What's Included

```
✓ Electron + React + TypeScript project structure
✓ Database adapters (SQLite & PostgreSQL)
✓ Prisma ORM with full schema (mirrored from cloud)
✓ Authentication system (login/logout)
✓ Database configuration wizard
✓ Dashboard UI with navigation
✓ Build system for all platforms
✓ Hot-reload development environment
```

### 🚀 Default Credentials

After setup, log in with:
- **Email**: `admin@dawacare.local`
- **Password**: `admin123`

⚠️ **Important**: Change this password after first login!

## Development

### Prerequisites

- **Node.js**: 18+ (npm comes bundled)
- **For PostgreSQL users**: PostgreSQL 14+ installed locally (optional)

### Installation

```bash
cd desktop_app
npm install
```

This will:
1. Install all dependencies
2. Generate Prisma client
3. Set up electron-builder

### Development Mode

```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:3001` (React UI)
- Electron main process with hot-reload
- Dev tools open automatically

### Build for Production

```bash
# Build for current platform only
npm run package

# Build for specific platforms
npm run package:win   # Windows (.exe installer)
npm run package:mac   # macOS (.dmg)
npm run package:linux # Linux (.AppImage + .deb)

# Build for ALL platforms (requires specific OS or Docker)
npm run package:all
```

**Note**: Cross-platform builds work best when built on the target OS. For example, build macOS apps on macOS.

### Distribution

Built installers will be in the `release/` directory:
- Windows: `DawaCare POS Setup X.X.X.exe`
- macOS: `DawaCare POS-X.X.X.dmg`
- Linux: `DawaCare POS-X.X.X.AppImage` and `.deb`

## Project Structure

```
desktop_app/
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── database/
│   │   │   ├── sqlite-adapter.ts      # SQLite implementation
│   │   │   ├── postgresql-adapter.ts  # PostgreSQL implementation
│   │   │   └── database-manager.ts    # Database orchestrator
│   │   ├── ipc/                       # IPC handlers
│   │   │   ├── auth-handlers.ts       # Authentication
│   │   │   ├── database-handlers.ts   # Database operations
│   │   │   ├── settings-handlers.ts   # App settings
│   │   │   └── window-handlers.ts     # Window controls
│   │   ├── windows/
│   │   │   └── main-window.ts         # Main window manager
│   │   ├── main.ts                    # Electron entry point
│   │   └── preload.ts                 # Preload script (context bridge)
│   │
│   ├── renderer/                # React frontend (Browser)
│   │   ├── pages/
│   │   │   ├── SetupWizard.tsx        # Database setup
│   │   │   ├── Login.tsx              # Login page
│   │   │   └── Dashboard.tsx          # Main dashboard
│   │   ├── lib/
│   │   │   └── auth-context.tsx       # Auth state management
│   │   ├── styles/
│   │   │   └── index.css              # Tailwind styles
│   │   ├── App.tsx                    # React app root
│   │   ├── index.tsx                  # React entry point
│   │   └── index.html                 # HTML template
│   │
│   └── shared/                  # Shared code (both processes)
│       ├── types/               # TypeScript types
│       ├── constants/           # App constants
│       └── utils/               # Utility functions
│
├── prisma/
│   └── schema.prisma            # Database schema (Prisma ORM)
│
├── build/                       # Build resources
│   └── README_ICONS.txt         # Icon requirements
│
├── dist/                        # Compiled output (gitignored)
├── release/                     # Built installers (gitignored)
├── node_modules/                # Dependencies (gitignored)
│
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript config (renderer)
├── tsconfig.main.json           # TypeScript config (main)
├── vite.config.ts               # Vite bundler config
├── tailwind.config.js           # Tailwind CSS config
└── postcss.config.js            # PostCSS config
```

## Database

### SQLite (Recommended for Most Users)

**Pros:**
- Zero configuration
- File-based (portable)
- Perfect for 1-5 concurrent users
- Automatic backups (just copy the file)

**Location:**
- Windows: `C:\Users\<username>\AppData\Roaming\dawacare-pos\dawacare.db`
- macOS: `~/Library/Application Support/dawacare-pos/dawacare.db`
- Linux: `~/.config/dawacare-pos/dawacare.db`

### PostgreSQL (For Advanced Users)

**Pros:**
- High performance
- Support for 10+ concurrent users
- Advanced features (full-text search, etc.)
- Better for large datasets

**Setup:**
1. Install PostgreSQL: https://www.postgresql.org/download/
2. Create database: `createdb dawacare_pos`
3. During app setup, choose PostgreSQL
4. Enter connection details:
   - Host: `localhost`
   - Port: `5432`
   - Database: `dawacare_pos`
   - Username: `postgres` (or your username)
   - Password: Your PostgreSQL password

## Database Schema

The desktop app uses the **same schema** as the cloud platform for seamless synchronization (Phase 3). Key models include:

- **User**: User accounts with roles (Admin, Pharmacist, Cashier)
- **Branch**: Branch/location management
- **Medicine**: Inventory items
- **Customer**: Customer records with loyalty points
- **Sale**: Sales transactions
- **SaleItem**: Individual items in a sale
- **Supplier**: Supplier information
- **PurchaseOrder**: Purchase orders
- **GoodsReceivedNote**: GRN records
- **SyncQueue**: Tracks items to sync to cloud (Phase 3)
- **AppSettings**: App configuration

## Troubleshooting

### "Database not initialized" Error

**Solution**: Delete the app data folder and restart the app to trigger the setup wizard.

### SQLite "Database Locked" Error

**Cause**: Multiple instances of the app running
**Solution**: Close all instances and reopen

### PostgreSQL Connection Failed

**Checklist**:
- [ ] PostgreSQL is running: `pg_isready`
- [ ] Database exists: `psql -l | grep dawacare_pos`
- [ ] Credentials are correct
- [ ] Port 5432 is open: `netstat -an | grep 5432`

### Build Fails

**Common causes**:
- Node version mismatch (use Node 18+)
- Missing dependencies: Run `npm install` again
- Prisma client not generated: Run `npx prisma generate`

## Architecture Decisions

### Why Electron?

- True native desktop app (not a web wrapper)
- Access to native APIs (printers, scanners)
- Works completely offline
- Installable and distributable
- Cross-platform with single codebase

### Why Prisma ORM?

- Type-safe database queries
- Database-agnostic (easy to switch SQLite ↔ PostgreSQL)
- Automatic migrations
- Great TypeScript support

### Why Vite?

- Ultra-fast hot reload
- Optimized production builds
- Modern ESM support
- Better than Webpack for React apps

## Next Steps - Phase 2

The next phase will add:

1. **Offline POS System**
   - Medicine search with barcode support
   - Cart management
   - Multiple payment methods (Cash, Card, M-Pesa, Credit)
   - Receipt printing

2. **Inventory Management**
   - Medicine CRUD operations
   - Stock level tracking
   - Low stock alerts
   - Expiry date monitoring
   - Batch number management

3. **Local Data Storage**
   - Complete offline CRUD for all entities
   - Data validation
   - Data integrity checks

**Estimated Credits**: 1,800-2,500  
**Timeline**: ~2 weeks

## Contributing

This is a proprietary application for DawaCare. For internal development only.

## License

MIT © 2025 DawaCare

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the phase documentation
3. Contact the development team

---

**Built with ❤️ using Electron, React, and TypeScript**
