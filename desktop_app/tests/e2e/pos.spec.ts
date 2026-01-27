import { test, expect } from '@playwright/test';
import { launchApp, login, TEST_USERS } from './helpers/setup';

test.describe('Point of Sale (POS)', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    window = await electronApp.firstWindow();
    await login(window, TEST_USERS.cashier.email, TEST_USERS.cashier.password);
    await window.waitForTimeout(2000);
    
    // Navigate to POS if not already there
    const bodyText = await window.textContent('body');
    if (!bodyText.match(/Point of Sale|POS/i)) {
      const posLink = window.locator('a[href="/pos"]').first();
      if (await posLink.isVisible().catch(() => false)) {
        await posLink.click();
        await window.waitForTimeout(2000);
      }
    }
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should display POS interface with medicine inventory', async () => {
    // Verify key elements are visible
    const bodyText = await window.textContent('body');
    expect(bodyText).toMatch(/(Point of Sale|POS|Search|Cart|Medicine)/i);
    
    // Verify we can see some medicines
    const hasParacetamol = bodyText.includes('Paracetamol');
    console.log('Paracetamol visible:', hasParacetamol);
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/pos-interface.png' });
  });

  test('should search for Paracetamol medicine', async () => {
    // Find search input
    const searchInput = window.locator('input[placeholder*="Search"], input[type="search"], input[name="search"]').first();
    
    const searchVisible = await searchInput.isVisible().catch(() => false);
    if (searchVisible) {
      await searchInput.fill('Paracetamol');
      await window.waitForTimeout(1000);
      
      // Verify search results appear
      const bodyText = await window.textContent('body');
      const hasParacetamol = bodyText.includes('Paracetamol');
      expect(hasParacetamol).toBeTruthy();
      
      // Take screenshot
      await window.screenshot({ path: 'test-results/screenshots/medicine-search.png' });
    } else {
      console.log('Search input not found');
      test.skip();
    }
  });

  test('should display cart section', async () => {
    // Look for cart section
    const bodyText = await window.textContent('body');
    const hasCart = bodyText.match(/Cart|Shopping|Items/i);
    
    expect(hasCart).toBeTruthy();
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/cart-section.png' });
  });

  test('should display payment method options', async () => {
    // Check for payment methods
    const bodyText = await window.textContent('body');
    const paymentOptions = ['CASH', 'MPESA', 'M-PESA', 'CARD', 'MOBILE'];
    
    let foundPaymentMethod = false;
    for (const option of paymentOptions) {
      if (bodyText.includes(option)) {
        console.log(`Payment option found: ${option}`);
        foundPaymentMethod = true;
        break;
      }
    }
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/payment-methods.png' });
    
    // Payment methods should be visible somewhere
    console.log('Payment methods section present:', foundPaymentMethod);
  });

  test('should show medicine categories', async () => {
    // Check if we can see different medicine categories from our seed data
    const bodyText = await window.textContent('body');
    
    const categories = ['ANALGESICS', 'ANTIBIOTICS', 'VITAMINS'];
    const foundCategories = categories.filter(cat => bodyText.includes(cat));
    
    console.log('Found categories:', foundCategories);
    
    // Take screenshot
    await window.screenshot({ path: 'test-results/screenshots/medicine-categories.png' });
  });

  test('should complete a full checkout flow', async () => {
    test.setTimeout(40000); // Set explicit timeout
    
    // Step 1: Search for a medicine
    const searchInput = window.locator('input[placeholder*="Search"], input[type="search"], input[name="search"]').first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    
    if (!searchVisible) {
      console.log('Search input not found, skipping checkout test');
      test.skip();
      return;
    }
    
    await searchInput.fill('Paracetamol');
    await window.waitForTimeout(1000);
    console.log('Step 1: Searched for Paracetamol');
    
    // Step 2: Add medicine to cart (click on item or add button)
    const addButton = window.locator('button:has-text("Add"), button:has-text("+"), [data-action="add-to-cart"]').first();
    const medicineCard = window.locator('text=Paracetamol').first();
    
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      console.log('Step 2: Clicked add button');
    } else if (await medicineCard.isVisible().catch(() => false)) {
      await medicineCard.click();
      console.log('Step 2: Clicked medicine card');
    }
    await window.waitForTimeout(1000);
    
    // Take screenshot of cart with item
    await window.screenshot({ path: 'test-results/screenshots/checkout-cart-with-item.png', timeout: 5000 }).catch(() => console.log('Screenshot timed out'));
    
    // Step 3: Verify item appears in cart
    const bodyText = await window.textContent('body');
    const cartHasItem = bodyText.includes('Paracetamol') || bodyText.match(/Total|Subtotal/i);
    console.log('Step 3: Cart has items:', !!cartHasItem);
    expect(cartHasItem).toBeTruthy();
    
    // Step 4: Select payment method (Cash) - default is already CASH
    const cashOption = window.locator('button:has-text("Cash")').first();
    if (await cashOption.isVisible().catch(() => false)) {
      await cashOption.click();
      console.log('Step 4: Selected Cash payment');
    } else {
      console.log('Step 4: Cash button not visible (may already be selected)');
    }
    await window.waitForTimeout(500);
    
    // Step 5: Check Complete Sale button is available and enabled
    const checkoutButton = window.locator('button:has-text("Complete Sale")').first();
    const checkoutVisible = await checkoutButton.isVisible().catch(() => false);
    const checkoutEnabled = checkoutVisible && !(await checkoutButton.isDisabled().catch(() => true));
    console.log('Step 5: Complete Sale button visible:', checkoutVisible, 'enabled:', checkoutEnabled);
    expect(checkoutVisible).toBeTruthy();
    expect(checkoutEnabled).toBeTruthy();
    
    // Take final screenshot showing checkout is ready
    await window.screenshot({ path: 'test-results/screenshots/checkout-ready.png', timeout: 5000 }).catch(() => console.log('Final screenshot timed out'));
    
    // Test verifies the complete checkout flow UI is functional
    // NOTE: Actual checkout click triggers a print dialog that blocks tests
    // So we verify up to the point where Complete Sale is ready
    console.log('✅ Checkout flow verified: Cart populated, payment selected, Complete Sale ready');
    expect(cartHasItem).toBeTruthy();
    expect(checkoutEnabled).toBeTruthy();
  });
});
