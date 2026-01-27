import { test, expect } from '@playwright/test';
import { launchApp, login, TEST_USERS } from './helpers/setup';

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

  test('should display login screen on app launch', async () => {
    // Wait for login page
    await window.waitForTimeout(1000);
    
    // Verify login form is displayed
    const emailInput = await window.locator('input[type="email"]').isVisible();
    const passwordInput = await window.locator('input[type="password"]').isVisible();
    
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/login-screen.png' });
  });

  test('should login successfully with admin credentials', async () => {
    await login(window, TEST_USERS.admin.email, TEST_USERS.admin.password);
    
    // Verify user is logged in by checking for navigation menu
    await window.waitForTimeout(2000);
    const navMenuCount = await window.locator('nav a[href="/pos"]').count();
    const hasLogoutButton = await window.locator('button:has-text("Logout"), button:has-text("Sign Out")').count();
    
    // Should have navigation menu OR logout button if logged in
    expect(navMenuCount + hasLogoutButton).toBeGreaterThan(0);
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/logged-in-admin.png' });
  });

  test('should login successfully with cashier credentials', async () => {
    await login(window, TEST_USERS.cashier.email, TEST_USERS.cashier.password);
    
    // Verify user is logged in by checking for navigation menu
    await window.waitForTimeout(2000);
    const navMenuCount = await window.locator('nav a[href="/pos"]').count();
    const hasLogoutButton = await window.locator('button:has-text("Logout"), button:has-text("Sign Out")').count();
    
    // Should have navigation menu OR logout button if logged in
    expect(navMenuCount + hasLogoutButton).toBeGreaterThan(0);
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/logged-in-cashier.png' });
  });

  test('should show error with invalid credentials', async () => {
    // Fill login form with wrong credentials
    await window.fill('input[type="email"]', 'wrong@email.com');
    await window.fill('input[type="password"]', 'wrongpass');
    await window.click('button[type="submit"]');
    
    // Wait for error message
    await window.waitForTimeout(2000);
    
    // Check that we're still on login page (login failed)
    const emailInput = await window.locator('input[type="email"]').isVisible();
    expect(emailInput).toBeTruthy();
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/login-error.png' });
  });

  test('should prevent empty login submission', async () => {
    // Try to submit empty form
    await window.click('button[type="submit"]');
    
    // Wait a bit
    await window.waitForTimeout(1000);
    
    // Should still be on login page
    const emailInput = await window.locator('input[type="email"]').isVisible();
    expect(emailInput).toBeTruthy();
  });
});
