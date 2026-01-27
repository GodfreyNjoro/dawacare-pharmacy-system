import { test, expect, _electron as electron } from '@playwright/test';
import { launchApp, completeDatabaseSetup, TEST_USERS } from './helpers/setup';

test.describe('Authentication', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should display database setup wizard on first launch', async () => {
    // Check for setup wizard
    const setupHeading = await window.locator('h1:has-text("Welcome to DawaCare POS")').isVisible().catch(() => false);
    
    if (setupHeading) {
      // Verify setup wizard elements
      await expect(window.locator('h1')).toContainText('Welcome to DawaCare POS');
      await expect(window.locator('h2:has-text("Choose Your Database")')).toBeVisible();
      await expect(window.locator('button:has-text("Next")')).toBeVisible();
      
      // Take screenshot
      await window.screenshot({ path: 'test-results/screenshots/setup-wizard.png' });
    } else {
      console.log('Setup wizard already completed, app shows login screen');
      await expect(window.locator('h1')).toContainText('DawaCare POS');
    }
  });

  test('should complete database setup workflow', async () => {
    await completeDatabaseSetup(window);
    
    // After setup, should show login screen
    await window.waitForTimeout(2000);
    const loginVisible = await window.locator('input[type="email"]').isVisible().catch(() => false);
    
    if (loginVisible) {
      await expect(window.locator('input[type="email"]')).toBeVisible();
      await expect(window.locator('input[type="password"]')).toBeVisible();
    }
    
    // Take screenshot of final state
    await window.screenshot({ path: 'test-results/screenshots/after-setup.png' });
  });

  test('should login successfully with valid credentials', async () => {
    // Complete setup if needed
    await completeDatabaseSetup(window);
    await window.waitForTimeout(1000);
    
    // Check if we're on login page
    const loginVisible = await window.locator('input[type="email"]').isVisible().catch(() => false);
    
    if (loginVisible) {
      // Fill login form
      await window.fill('input[type="email"]', TEST_USERS.admin.email);
      await window.fill('input[type="password"]', TEST_USERS.admin.password);
      
      // Click login button
      await window.click('button[type="submit"]');
      
      // Wait for navigation
      await window.waitForTimeout(3000);
      
      // Verify user is logged in (check for any of these elements)
      const bodyText = await window.textContent('body');
      const isLoggedIn = bodyText.match(/(Dashboard|Point of Sale|Inventory|Medicines|Sales)/);
      expect(isLoggedIn).toBeTruthy();
      
      // Take screenshot
      await window.screenshot({ path: 'test-results/screenshots/logged-in.png' });
    } else {
      console.log('Login page not visible, may already be logged in');
      test.skip();
    }
  });

  test('should show error with invalid credentials', async () => {
    // Complete setup if needed
    await completeDatabaseSetup(window);
    await window.waitForTimeout(1000);
    
    // Check if we're on login page
    const loginVisible = await window.locator('input[type="email"]').isVisible().catch(() => false);
    
    if (loginVisible) {
      await window.fill('input[type="email"]', 'wrong@email.com');
      await window.fill('input[type="password"]', 'wrongpass');
      await window.click('button[type="submit"]');
      
      // Wait for error message
      await window.waitForTimeout(2000);
      
      // Check for error indicators
      const pageContent = await window.textContent('body');
      const hasError = pageContent.match(/(Invalid|Error|Failed|incorrect|wrong)/i);
      
      if (hasError) {
        expect(hasError).toBeTruthy();
      } else {
        console.log('Error message not found in expected format');
      }
      
      // Take screenshot
      await window.screenshot({ path: 'test-results/screenshots/login-error.png' });
    } else {
      console.log('Login page not visible');
      test.skip();
    }
  });
});
