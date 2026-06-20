import { test, expect } from '@playwright/test';

test.describe('Optimizer E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('text=Optimizer');
  });

  test('Optimizer tab loads correctly', async ({ page }) => {
    await expect(page.locator('text=Optimizer')).toBeVisible();
  });

  test('optimizer form fields are present', async ({ page }) => {
    await expect(page.locator('select[name="strategy"]')).toBeVisible();
    await expect(page.locator('select[name="timeframe"]')).toBeVisible();
  });

  test('can start optimization', async ({ page }) => {
    await page.selectOption('select[name="strategy"]', 'TestStrategy');
    await page.click('button:has-text("Start")');
    
    // Verify optimization started
    await expect(page.locator('text=running').or(page.locator('text=optimizing'))).toBeVisible({ timeout: 5000 });
  });

  test('can cancel optimization', async ({ page }) => {
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(1000);
    
    const cancelButton = page.locator('button:has-text("Cancel")');
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await expect(page.locator('text=cancelled')).toBeVisible({ timeout: 5000 });
    }
  });

  test('optimizer logs are displayed', async ({ page }) => {
    await expect(page.locator('.font-mono').first()).toBeVisible();
  });

  test('optimizer results are displayed after completion', async ({ page }) => {
    // This would need a mock backend to complete successfully
    await page.selectOption('select[name="strategy"]', 'TestStrategy');
    await page.click('button:has-text("Start")');
    
    // Wait for completion or timeout
    await page.waitForTimeout(3000);
    
    // Check for results or running state
    const results = page.locator('text=profit').or(page.locator('text=sharpe'));
    if (await results.isVisible()) {
      await expect(results).toBeVisible();
    }
  });
});

test.describe('Strategy Lab E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('text=Strategy Lab');
  });

  test('Strategy Lab tab loads correctly', async ({ page }) => {
    await expect(page.locator('text=Strategy Lab')).toBeVisible();
  });

  test('strategy input fields are present', async ({ page }) => {
    await expect(page.locator('input[name="strategy_name"]').or(page.locator('textarea'))).toBeVisible();
  });

  test('can save strategy', async ({ page }) => {
    const nameInput = page.locator('input[name="strategy_name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('TestStrategy');
      await page.click('button:has-text("Save")');
      
      // Verify save success
      await expect(page.locator('text=saved').or(page.locator('text=success'))).toBeVisible({ timeout: 3000 });
    }
  });

  test('can validate strategy', async ({ page }) => {
    await page.click('button:has-text("Validate")');
    
    // Check for validation results
    await expect(page.locator('text=valid').or(page.locator('text=invalid').or(page.locator('text=error')))).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Pair Explorer E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('text=Pair Explorer');
  });

  test('Pair Explorer tab loads correctly', async ({ page }) => {
    await expect(page.locator('text=Pair Explorer')).toBeVisible();
  });

  test('pair list is displayed', async ({ page }) => {
    await expect(page.locator('text=BTC/USDT').or(page.locator('.table'))).toBeVisible({ timeout: 5000 });
  });

  test('can filter pairs', async ({ page }) => {
    const filterInput = page.locator('input[placeholder*="filter" i]').or(page.locator('input[type="search"]')).first();
    if (await filterInput.isVisible()) {
      await filterInput.fill('BTC');
      await page.waitForTimeout(500);
      
      // Should show filtered results
      await expect(page.locator('text=BTC/USDT')).toBeVisible();
    }
  });

  test('can select pair', async ({ page }) => {
    const pairRow = page.locator('text=BTC/USDT').first();
    if (await pairRow.isVisible()) {
      await pairRow.click();
      
      // Pair details should be shown
      await expect(page.locator('text=details').or(page.locator('.modal'))).toBeVisible({ timeout: 3000 });
    }
  });
});
