import { test, expect, _electron as electron } from '@playwright/test';
import { launchApp, TEST_USERS } from './helpers/setup';

test.describe('Authentication', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await launchApp();
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
    await window.fill('input[type="email"]', TEST_USERS.admin.email);
    await window.fill('input[type="password"]', TEST_USERS.admin.password);
    
    // Click login button
    await window.click('button[type="submit"]');
    
    // Wait for navigation to dashboard/POS
    await window.waitForURL(/\/(dashboard|pos)/, { timeout: 10000 });
    
    // Verify user is logged in
    const pageContent = await window.textContent('body');
    expect(pageContent).toMatch(/(Dashboard|Point of Sale|Inventory)/);
  });

  test('should show error with invalid credentials', async () => {
    await window.fill('input[type="email"]', 'wrong@email.com');
    await window.fill('input[type="password"]', 'wrongpass');
    await window.click('button[type="submit"]');
    
    // Wait for error message
    await window.waitForTimeout(2000);
    const pageContent = await window.textContent('body');
    expect(pageContent).toMatch(/(Invalid|Error|Failed)/);
  });
});
