# Quick Start: Automated Testing for DawaCare POS

## 1. Install Testing Dependencies

```bash
cd desktop_app
npm install --save-dev @playwright/test
npx playwright install chromium
```

## 2. Build the App

```bash
npm run build
```

## 3. Run Your First Test

```bash
# Run all tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run with browser visible
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

## 4. View Test Results

```bash
npm run test:report
```

## Test Structure

```
tests/
├── e2e/
│   ├── auth.spec.ts          ✅ Login/logout (ready)
│   ├── pos.spec.ts           📝 To be created
│   ├── inventory.spec.ts     📝 To be created
│   ├── procurement.spec.ts   📝 To be created
│   └── helpers/
│       └── setup.ts          ✅ Test utilities (ready)
```

## Example: Running Login Tests

```bash
# Run only auth tests
npx playwright test auth.spec.ts

# Run in debug mode
npx playwright test auth.spec.ts --debug

# Run with visible browser
npx playwright test auth.spec.ts --headed
```

## What Gets Tested?

### ✅ Current Tests (auth.spec.ts)
- Login screen displays correctly
- Valid credentials allow login
- Invalid credentials show error

### 📝 Planned Tests
- **POS**: Search medicines, add to cart, complete sale, print receipt
- **Inventory**: Add/edit/delete medicines, search, low stock alerts
- **Procurement**: Suppliers, Purchase Orders, Goods Received Notes
- **Sales**: View history, filter, export
- **Settings**: Database switching, user preferences

## Tips

1. **Always build before testing**:
   ```bash
   npm run build && npm run test:e2e
   ```

2. **Use headed mode for debugging**:
   ```bash
   npm run test:e2e:headed
   ```

3. **Generate screenshots on failure** (automatic)

4. **Check test results**:
   ```bash
   npm run test:report
   ```

## Next Steps

1. ✅ Install dependencies
2. ✅ Run first test
3. 📝 Add more test scenarios (see TESTING_GUIDE.md)
4. 📝 Set up CI/CD pipeline
5. 📝 Achieve 80%+ test coverage

## Need Help?

- See full guide: `TESTING_GUIDE.md`
- Playwright docs: https://playwright.dev
- Electron testing: https://playwright.dev/docs/api/class-electron

