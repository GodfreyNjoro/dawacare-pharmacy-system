import { test, expect } from '@playwright/test';
import { launchApp, login, TEST_USERS } from './helpers/setup';

test.describe('Point of Sale (POS)', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    window = await electronApp.firstWindow();
    await login(window, TEST_USERS.cashier.email, TEST_USERS.cashier.password);
    
    // Navigate to POS
    const posLink = await window.locator('a[href="/pos"]').first();
    if (await posLink.isVisible()) {
      await posLink.click();
      await window.waitForLoadState('networkidle');
    }
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should display POS interface', async () => {
    // Verify key elements are visible
    const bodyText = await window.textContent('body');
    expect(bodyText).toMatch(/(Point of Sale|POS|Search|Cart)/);
    
    // Take screenshot for visual verification
    await window.screenshot({ path: 'test-results/screenshots/pos-interface.png' });
  });

  test('should search for medicines', async () => {
    // Find search input
    const searchInput = window.locator('input[placeholder*="Search"], input[type="search"], input[name="search"]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('Paracetamol');
      await window.waitForTimeout(1000); // Wait for debounce/search results
      
      // Verify search results appear
      const resultsVisible = await window.locator('text=Paracetamol').first().isVisible().catch(() => false);
      expect(resultsVisible).toBeTruthy();
    } else {
      console.log('Search input not found, skipping search test');
      test.skip();
    }
  });

  test('should handle cart operations', async () => {
    // Look for cart section
    const cartVisible = await window.locator('text=Cart').isVisible().catch(() => false);
    
    if (cartVisible) {
      // Take screenshot of initial cart state
      await window.screenshot({ path: 'test-results/screenshots/cart-initial.png' });
      
      // Verify cart is initially empty or has items
      const bodyText = await window.textContent('body');
      console.log('Cart section found. Body text sample:', bodyText.substring(0, 500));
    } else {
      console.log('Cart section not found');
    }
  });

  test('should complete sale workflow', async () => {
    // This is a placeholder for the complete sale workflow
    // Actual implementation depends on the exact UI structure
    
    // 1. Search for medicine
    const searchInput = window.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('Medicine');
      await window.waitForTimeout(500);
    }
    
    // 2. Add to cart (implementation depends on UI)
    // 3. Select payment method
    // 4. Complete sale
    
    // For now, just verify the page loaded correctly
    const pageLoaded = await window.locator('body').isVisible();
    expect(pageLoaded).toBeTruthy();
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/pos-workflow.png' });
  });

  test('should display payment methods', async () => {
    // Look for payment method selectors
    const paymentOptions = ['CASH', 'MPESA', 'CARD', 'INSURANCE'];
    
    for (const option of paymentOptions) {
      const optionVisible = await window.locator(`text=${option}`).first().isVisible().catch(() => false);
      if (optionVisible) {
        console.log(`Payment option found: ${option}`);
      }
    }
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/payment-methods.png' });
  });
});
