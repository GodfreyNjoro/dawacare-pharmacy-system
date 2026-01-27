# DawaCare POS - Automated Testing Guide

## Overview

This guide covers automated testing for the DawaCare desktop application using **Playwright for Electron**. Tests simulate real user interactions across all components.

---

## Testing Stack

- **Playwright**: E2E testing framework for Electron
- **Vitest**: Unit testing for utility functions
- **Testing Library**: React component testing
- **Mock Service Worker (MSW)**: API mocking

---

## Installation

```bash
cd desktop_app
npm install --save-dev @playwright/test
npm install --save-dev electron-playwright-helpers
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev vitest @vitest/ui
npm install --save-dev msw
```

---

## Project Structure

```
desktop_app/
├── tests/
│   ├── e2e/
│   │   ├── auth.spec.ts          # Login/logout tests
│   │   ├── pos.spec.ts           # POS workflow tests
│   │   ├── inventory.spec.ts     # Inventory management
│   │   ├── procurement.spec.ts   # Supplier/PO/GRN tests
│   │   ├── sales.spec.ts         # Sales history tests
│   │   ├── settings.spec.ts      # Settings tests
│   │   └── helpers/
│   │       ├── setup.ts          # Test setup utilities
│   │       └── fixtures.ts       # Test data fixtures
│   ├── integration/
│   │   ├── database.spec.ts      # Database operations
│   │   └── ipc.spec.ts           # IPC communication
│   ├── unit/
│   │   ├── utils.spec.ts         # Utility functions
│   │   └── adapters.spec.ts      # PostgreSQL adapter
│   └── fixtures/
│       └── test-data.json        # Sample test data
├── playwright.config.ts          # Playwright configuration
└── vitest.config.ts             # Vitest configuration
```

---

## Configuration Files

### playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 2,
  workers: 1, // Electron apps should run serially
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      testMatch: /.*\.spec\.ts/,
    }
  ]
});
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## Test Examples

### 1. Authentication Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Authentication', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/src/main/main.js')],
      env: {
        NODE_ENV: 'test',
        TEST_DATABASE: 'sqlite::memory:'
      }
    });
    
    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should display login screen on app launch', async () => {
    await expect(window.locator('h1')).toContainText('DawaCare POS');
    await expect(window.locator('input[type="email"]')).toBeVisible();
    await expect(window.locator('input[type="password"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async () => {
    // Fill login form
    await window.fill('input[type="email"]', 'admin@dawacare.local');
    await window.fill('input[type="password"]', 'admin123');
    
    // Click login button
    await window.click('button[type="submit"]');
    
    // Wait for navigation to dashboard/POS
    await window.waitForURL(/\/(dashboard|pos)/);
    
    // Verify user is logged in
    await expect(window.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error with invalid credentials', async () => {
    await window.fill('input[type="email"]', 'wrong@email.com');
    await window.fill('input[type="password"]', 'wrongpass');
    await window.click('button[type="submit"]');
    
    await expect(window.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should logout successfully', async () => {
    // Login first
    await window.fill('input[type="email"]', 'admin@dawacare.local');
    await window.fill('input[type="password"]', 'admin123');
    await window.click('button[type="submit"]');
    await window.waitForURL(/\/(dashboard|pos)/);
    
    // Logout
    await window.click('button:has-text("Logout")');
    
    // Verify redirected to login
    await expect(window.locator('h1')).toContainText('DawaCare POS');
  });
});
```

### 2. POS Tests

```typescript
// tests/e2e/pos.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import { login, launchApp } from './helpers/setup';

test.describe('Point of Sale', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    window = await electronApp.firstWindow();
    await login(window, 'cashier@dawacare.local', 'cashier123');
    
    // Navigate to POS
    await window.click('a[href="/pos"]');
    await window.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should display POS interface', async () => {
    await expect(window.locator('text=Point of Sale')).toBeVisible();
    await expect(window.locator('input[placeholder*="Search"]')).toBeVisible();
    await expect(window.locator('text=Cart')).toBeVisible();
  });

  test('should search and add medicine to cart', async () => {
    // Search for medicine
    await window.fill('input[placeholder*="Search"]', 'Paracetamol');
    await window.waitForTimeout(500); // Wait for debounce
    
    // Verify search results appear
    await expect(window.locator('text=Paracetamol 500mg')).toBeVisible();
    
    // Click on medicine to add to cart
    await window.click('text=Paracetamol 500mg');
    
    // Verify item added to cart
    await expect(window.locator('.cart-item:has-text("Paracetamol")')).toBeVisible();
  });

  test('should update cart item quantity', async () => {
    // Add item to cart
    await window.fill('input[placeholder*="Search"]', 'Paracetamol');
    await window.waitForTimeout(500);
    await window.click('text=Paracetamol 500mg');
    
    // Increase quantity
    await window.click('.cart-item button:has-text("+")');
    
    // Verify quantity updated
    await expect(window.locator('.cart-item input[type="number"]')).toHaveValue('2');
  });

  test('should complete a sale with cash payment', async () => {
    // Add items to cart
    await window.fill('input[placeholder*="Search"]', 'Paracetamol');
    await window.waitForTimeout(500);
    await window.click('text=Paracetamol 500mg');
    
    // Select payment method
    await window.click('select[name="paymentMethod"]');
    await window.click('option:has-text("CASH")');
    
    // Complete sale
    await window.click('button:has-text("Complete Sale")');
    
    // Verify success message
    await expect(window.locator('text=Sale completed successfully')).toBeVisible();
    
    // Verify receipt printed (modal or new window)
    await expect(window.locator('text=Receipt sent to printer')).toBeVisible();
  });

  test('should apply discount to sale', async () => {
    // Add item
    await window.fill('input[placeholder*="Search"]', 'Paracetamol');
    await window.waitForTimeout(500);
    await window.click('text=Paracetamol 500mg');
    
    // Apply discount
    await window.fill('input[name="discount"]', '10');
    
    // Verify total updated
    const subtotal = await window.locator('.subtotal').textContent();
    const total = await window.locator('.total').textContent();
    
    expect(parseFloat(total)).toBeLessThan(parseFloat(subtotal));
  });

  test('should clear cart', async () => {
    // Add items
    await window.fill('input[placeholder*="Search"]', 'Paracetamol');
    await window.waitForTimeout(500);
    await window.click('text=Paracetamol 500mg');
    
    // Clear cart
    await window.click('button:has-text("Clear Cart")');
    
    // Confirm clear
    await window.click('button:has-text("Confirm")');
    
    // Verify cart is empty
    await expect(window.locator('text=Your cart is empty')).toBeVisible();
  });
});
```

### 3. Inventory Tests

```typescript
// tests/e2e/inventory.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import { login, launchApp } from './helpers/setup';

test.describe('Inventory Management', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    window = await electronApp.firstWindow();
    await login(window, 'admin@dawacare.local', 'admin123');
    
    // Navigate to Inventory
    await window.click('a[href="/inventory"]');
    await window.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should display inventory list', async () => {
    await expect(window.locator('text=Inventory')).toBeVisible();
    await expect(window.locator('table')).toBeVisible();
  });

  test('should add new medicine', async () => {
    // Click Add Medicine
    await window.click('button:has-text("Add Medicine")');
    
    // Fill form
    await window.fill('input[name="name"]', 'Test Medicine');
    await window.fill('input[name="genericName"]', 'Test Generic');
    await window.fill('input[name="batchNumber"]', 'BATCH001');
    await window.fill('input[name="quantity"]', '100');
    await window.fill('input[name="unitCost"]', '50');
    await window.fill('input[name="sellingPrice"]', '75');
    await window.fill('input[type="date"]', '2025-12-31');
    
    // Submit
    await window.click('button[type="submit"]:has-text("Add")');
    
    // Verify success
    await expect(window.locator('text=Medicine added successfully')).toBeVisible();
    await expect(window.locator('text=Test Medicine')).toBeVisible();
  });

  test('should search medicines', async () => {
    await window.fill('input[placeholder*="Search"]', 'Paracetamol');
    await window.waitForTimeout(500);
    
    // Verify filtered results
    await expect(window.locator('table tr:has-text("Paracetamol")')).toBeVisible();
  });

  test('should edit medicine details', async () => {
    // Click edit button on first row
    await window.click('table tr:first-child button:has-text("Edit")');
    
    // Update quantity
    await window.fill('input[name="quantity"]', '150');
    
    // Save
    await window.click('button:has-text("Save")');
    
    // Verify update
    await expect(window.locator('text=Medicine updated')).toBeVisible();
  });

  test('should delete medicine', async () => {
    // Click delete button
    await window.click('table tr:first-child button:has-text("Delete")');
    
    // Confirm deletion
    await window.click('button:has-text("Confirm")');
    
    // Verify deletion
    await expect(window.locator('text=Medicine deleted')).toBeVisible();
  });

  test('should show low stock warning', async () => {
    // Filter by low stock
    await window.click('button:has-text("Low Stock")');
    
    // Verify warning indicators
    await expect(window.locator('.low-stock-indicator')).toBeVisible();
  });
});
```

### 4. Test Helpers

```typescript
// tests/e2e/helpers/setup.ts
import { _electron as electron, Page } from '@playwright/test';
import path from 'path';

export async function launchApp() {
  return await electron.launch({
    args: [path.join(__dirname, '../../../dist/main/src/main/main.js')],
    env: {
      NODE_ENV: 'test',
      TEST_DATABASE: 'test.db',
      AUTO_UPDATE_DISABLED: 'true'
    }
  });
}

export async function login(window: Page, email: string, password: string) {
  // Wait for login page
  await window.waitForLoadState('domcontentloaded');
  
  // Fill credentials
  await window.fill('input[type="email"]', email);
  await window.fill('input[type="password"]', password);
  
  // Submit
  await window.click('button[type="submit"]');
  
  // Wait for navigation
  await window.waitForURL(/\/(dashboard|pos)/, { timeout: 5000 });
}

export async function createTestMedicine(window: Page) {
  await window.click('a[href="/inventory"]');
  await window.click('button:has-text("Add Medicine")');
  
  const testData = {
    name: `Test Medicine ${Date.now()}`,
    genericName: 'Test Generic',
    batchNumber: `BATCH${Date.now()}`,
    quantity: '100',
    unitCost: '50',
    sellingPrice: '75',
    expiryDate: '2025-12-31'
  };
  
  await window.fill('input[name="name"]', testData.name);
  await window.fill('input[name="genericName"]', testData.genericName);
  await window.fill('input[name="batchNumber"]', testData.batchNumber);
  await window.fill('input[name="quantity"]', testData.quantity);
  await window.fill('input[name="unitCost"]', testData.unitCost);
  await window.fill('input[name="sellingPrice"]', testData.sellingPrice);
  await window.fill('input[type="date"]', testData.expiryDate);
  
  await window.click('button[type="submit"]:has-text("Add")');
  await window.waitForLoadState('networkidle');
  
  return testData;
}

export async function takeScreenshot(window: Page, name: string) {
  await window.screenshot({ path: `test-results/screenshots/${name}.png` });
}
```

---

## Running Tests

### Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/pos.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run with debugging
npx playwright test --debug

# Generate test report
npx playwright show-report

# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage
```

### package.json Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:e2e",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:report": "playwright show-report"
  }
}
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Desktop App Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd desktop_app
          npm install
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Build app
        run: |
          cd desktop_app
          npm run build
      
      - name: Run unit tests
        run: |
          cd desktop_app
          npm run test:unit
      
      - name: Run E2E tests
        run: |
          cd desktop_app
          npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.os }}
          path: desktop_app/test-results/
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: desktop_app/coverage/
```

---

## Best Practices

### 1. Test Data Management
```typescript
// Use fixtures for consistent test data
export const TEST_USERS = {
  admin: { email: 'admin@dawacare.local', password: 'admin123' },
  cashier: { email: 'cashier@dawacare.local', password: 'cashier123' },
  pharmacist: { email: 'pharmacist@dawacare.local', password: 'pharmacist123' }
};

export const TEST_MEDICINES = [
  {
    name: 'Paracetamol 500mg',
    batchNumber: 'BATCH001',
    quantity: 100,
    unitCost: 5,
    sellingPrice: 10
  }
];
```

### 2. Cleanup After Tests
```typescript
test.afterEach(async ({ window }) => {
  // Clean up test data
  await window.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});
```

### 3. Parallel Test Execution
```typescript
// In playwright.config.ts
export default defineConfig({
  workers: 1, // Electron apps should run serially
  fullyParallel: false,
});
```

### 4. Visual Regression Testing
```typescript
test('should match POS screenshot', async ({ window }) => {
  await expect(window).toHaveScreenshot('pos-page.png', {
    maxDiffPixels: 100
  });
});
```

---

## Debugging Tips

1. **Use Playwright Inspector**:
   ```bash
   PWDEBUG=1 npx playwright test
   ```

2. **Take screenshots on failure**:
   ```typescript
   test.afterEach(async ({ window }, testInfo) => {
     if (testInfo.status !== 'passed') {
       await window.screenshot({ path: `failure-${testInfo.title}.png` });
     }
   });
   ```

3. **Console logs**:
   ```typescript
   window.on('console', msg => console.log('PAGE LOG:', msg.text()));
   ```

4. **Network monitoring**:
   ```typescript
   window.on('request', request => console.log('>>', request.method(), request.url()));
   window.on('response', response => console.log('<<', response.status(), response.url()));
   ```

---

## Next Steps

1. Install dependencies
2. Create test files
3. Run initial tests
4. Set up CI/CD pipeline
5. Add more test scenarios
6. Monitor test coverage

