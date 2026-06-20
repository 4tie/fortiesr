import { test, expect } from '@playwright/test';

test.describe('AutoQuant E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('AutoQuant tab is accessible', async ({ page }) => {
    await page.click('text=AutoQuant');
    await expect(page.locator('text=AutoQuant')).toBeVisible();
  });

  test('form fields are present and interactive', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    // Check for key form fields
    await expect(page.locator('select[name="timeframe"]')).toBeVisible();
    await expect(page.locator('select[name="trading_style"]')).toBeVisible();
    await expect(page.locator('select[name="risk_profile"]')).toBeVisible();
  });

  test('can change timeframe selection', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    const timeframeSelect = page.locator('select[name="timeframe"]');
    await timeframeSelect.selectOption('5m');
    await expect(timeframeSelect).toHaveValue('5m');
  });

  test('can toggle advanced settings', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    const advancedButton = page.locator('text=Advanced').first();
    await advancedButton.click();
    
    // Advanced settings should be visible
    await expect(page.locator('text=Hyperopt')).toBeVisible();
  });

  test('strategy generation button is present', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    await expect(page.locator('button:has-text("Generate")')).toBeVisible();
  });

  test('start pipeline button is present', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    await expect(page.locator('button:has-text("Start")')).toBeVisible();
  });

  test('log terminal is visible', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    await expect(page.locator('.font-mono').first()).toBeVisible();
  });

  test('metric cards are displayed', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    await expect(page.locator('.bg-base-200').first()).toBeVisible();
  });

  test('can navigate between tabs', async ({ page }) => {
    // Start on AutoQuant
    await page.click('text=AutoQuant');
    await expect(page.locator('text=AutoQuant')).toBeVisible();
    
    // Navigate to another tab
    await page.click('text=Optimizer');
    await expect(page.locator('text=Optimizer')).toBeVisible();
    
    // Return to AutoQuant
    await page.click('text=AutoQuant');
    await expect(page.locator('text=AutoQuant')).toBeVisible();
  });

  test('form persists settings', async ({ page }) => {
    await page.click('text=AutoQuant');
    
    const timeframeSelect = page.locator('select[name="timeframe"]');
    await timeframeSelect.selectOption('15m');
    
    // Reload page
    await page.reload();
    
    // Settings should persist
    await page.click('text=AutoQuant');
    await expect(timeframeSelect).toHaveValue('15m');
  });
});

test.describe('AutoQuant Pipeline Flow', () => {
  test('complete pipeline workflow', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Configure form
    await page.selectOption('select[name="timeframe"]', '1h');
    await page.selectOption('select[name="trading_style"]', 'swing');
    await page.selectOption('select[name="risk_profile"]', 'balanced');
    
    // Generate strategy
    await page.click('button:has-text("Generate")');
    
    // Wait for strategy generation (mocked in development)
    await page.waitForTimeout(1000);
    
    // Start pipeline
    await page.click('button:has-text("Start")');
    
    // Verify pipeline started
    await expect(page.locator('text=running').or(page.locator('text=pending'))).toBeVisible({ timeout: 5000 });
  });

  test('pipeline cancellation', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Start pipeline
    await page.click('button:has-text("Start")');
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Cancel pipeline
    const cancelButton = page.locator('button:has-text("Cancel")');
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await expect(page.locator('text=cancelled').or(page.locator('text=stopped'))).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('AutoQuant Responsive Design', () => {
  test('displays correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    await expect(page.locator('text=AutoQuant')).toBeVisible();
    await expect(page.locator('.grid')).toBeVisible();
  });

  test('displays correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    await expect(page.locator('text=AutoQuant')).toBeVisible();
  });

  test('displays correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    await expect(page.locator('text=AutoQuant')).toBeVisible();
    // Mobile layout should be different
    await expect(page.locator('.grid')).not.toBeVisible();
  });
});
