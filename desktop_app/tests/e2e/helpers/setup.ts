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

export async function login(window: Page, email: string, password: string): Promise<void> {
  // Wait for login page
  await window.waitForLoadState('domcontentloaded');
  
  // Fill credentials
  await window.fill('input[type="email"]', email);
  await window.fill('input[type="password"]', password);
  
  // Submit
  await window.click('button[type="submit"]');
  
  // Wait for navigation
  await window.waitForURL(/\/(dashboard|pos)/, { timeout: 10000 });
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
