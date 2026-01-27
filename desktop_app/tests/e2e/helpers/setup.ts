import { _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export async function launchApp(): Promise<ElectronApplication> {
  // Ensure test database exists
  const testDbPath = path.join(__dirname, '../../../test.db');
  
  if (!fs.existsSync(testDbPath)) {
    throw new Error(
      `Test database not found at ${testDbPath}. ` +
      'Please run "npm run seed:test" before running tests.'
    );
  }
  
  // Set test-specific user data directory
  const testUserDataDir = path.join(__dirname, '../../../test-user-data');
  
  // Clean and recreate test user data directory
  if (fs.existsSync(testUserDataDir)) {
    fs.rmSync(testUserDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testUserDataDir, { recursive: true });
  
  // Copy test database to user data directory
  const targetDbPath = path.join(testUserDataDir, 'dawacare.db');
  fs.copyFileSync(testDbPath, targetDbPath);
  
  // Create electron-store config file (config.json) with database configuration
  // This is what the app actually reads via electron-store
  const electronStoreConfigPath = path.join(testUserDataDir, 'config.json');
  const electronStoreConfig = {
    database_config: {
      type: 'sqlite',
      databasePath: targetDbPath
    }
  };
  fs.writeFileSync(electronStoreConfigPath, JSON.stringify(electronStoreConfig, null, 2));
  
  console.log(`✓ Test database copied to: ${targetDbPath}`);
  console.log(`✓ Electron-store config created at: ${electronStoreConfigPath}`);
  
  const electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../../../dist/main/src/main/main.js'),
      `--user-data-dir=${testUserDataDir}`
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      AUTO_UPDATE_DISABLED: 'true'
    }
  });
  
  return electronApp;
}

export async function completeDatabaseSetup(window: Page): Promise<void> {
  // Wait for page to load
  await window.waitForLoadState('domcontentloaded');
  
  // Check if we're on the setup page
  const setupHeading = await window.locator('h1:has-text("Welcome to DawaCare POS")').isVisible().catch(() => false);
  
  if (setupHeading) {
    console.log('Database setup wizard detected, completing setup...');
    
    // Step 1: Choose Database (SQLite is already selected by default)
    await window.click('button:has-text("Next")');
    await window.waitForTimeout(1000);
    
    // Step 2: Configure Database (SQLite requires no configuration)
    const nextButton = await window.locator('button:has-text("Next")').isVisible().catch(() => false);
    if (nextButton) {
      await window.click('button:has-text("Next")');
      await window.waitForTimeout(1000);
    }
    
    // Step 3: Create Admin Account
    const createAdminHeading = await window.locator('h2:has-text("Create Admin")').isVisible().catch(() => false);
    if (createAdminHeading) {
      // Fill admin details
      await window.fill('input[name="name"]', 'Test Admin');
      await window.fill('input[name="email"]', 'admin@dawacare.local');
      await window.fill('input[name="password"]', 'admin123');
      await window.fill('input[name="confirmPassword"]', 'admin123');
      
      // Complete setup
      await window.click('button:has-text("Complete Setup")');
      await window.waitForTimeout(2000);
    }
    
    console.log('Database setup completed');
  }
}

export async function login(window: Page, email: string, password: string): Promise<void> {
  // Wait for page to load
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(1000);
  
  // Check if we're already logged in by looking for navigation menu or specific logged-in elements
  // Don't check for "POS" alone as the login screen contains "DawaCare POS" title
  const logoutButton = await window.locator('button:has-text("Logout"), button:has-text("Sign Out")').count();
  const hasNavMenu = await window.locator('nav a[href="/pos"], a[href="/inventory"]').count();
  
  if (logoutButton > 0 || hasNavMenu > 0) {
    console.log('Already logged in, skipping login');
    return;
  }
  
  // Check if login form is present
  const hasLoginForm = await window.locator('input[type="email"]').isVisible().catch(() => false);
  
  if (!hasLoginForm) {
    console.log('Login form not found - might be on a different page');
    return;
  }
  
  console.log(`Attempting login as: ${email}`);
  
  // Fill credentials
  await window.fill('input[type="email"]', email);
  await window.fill('input[type="password"]', password);
  
  // Submit
  await window.click('button[type="submit"]');
  
  // Wait for navigation to complete and verify login success
  await window.waitForTimeout(3000);
  
  // Verify we're actually logged in
  const postLoginMenu = await window.locator('nav a[href="/pos"]').count();
  if (postLoginMenu > 0) {
    console.log(`✓ Successfully logged in as: ${email}`);
  } else {
    console.log(`⚠ Login may have failed for: ${email}`);
  }
}

export async function createTestMedicine(window: Page) {
  await window.click('a[href="/inventory"]');
  await window.waitForLoadState('networkidle');
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

export async function takeScreenshot(window: Page, name: string): Promise<void> {
  await window.screenshot({ path: `test-results/screenshots/${name}.png` });
}

export const TEST_USERS = {
  admin: { email: 'admin@dawacare.local', password: 'admin123' },
  cashier: { email: 'cashier@dawacare.local', password: 'cashier123' },
  pharmacist: { email: 'pharmacist@dawacare.local', password: 'pharmacist123' }
};
