import { _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';

export async function launchApp(): Promise<ElectronApplication> {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../../dist/main/src/main/main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_DATABASE: 'test.db',
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
  // First, check if we need to complete database setup
  await completeDatabaseSetup(window);
  
  // Wait for login page
  await window.waitForLoadState('domcontentloaded');
  
  // Check if we're already logged in
  const alreadyLoggedIn = await window.locator('text=Dashboard, text=Point of Sale').first().isVisible().catch(() => false);
  if (alreadyLoggedIn) {
    console.log('Already logged in, skipping login');
    return;
  }
  
  // Fill credentials
  const emailInput = await window.locator('input[type="email"]').isVisible().catch(() => false);
  if (emailInput) {
    await window.fill('input[type="email"]', email);
    await window.fill('input[type="password"]', password);
    
    // Submit
    await window.click('button[type="submit"]');
    
    // Wait for navigation
    await window.waitForTimeout(3000);
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
