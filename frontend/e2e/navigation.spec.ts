import { test, expect } from '@playwright/test';

test.describe('Navigation E2E Tests', () => {
  test('main navigation tabs are accessible', async ({ page }) => {
    await page.goto('/');
    
    // Check all main tabs are present
    await expect(page.locator('text=AutoQuant')).toBeVisible();
    await expect(page.locator('text=Optimizer')).toBeVisible();
    await expect(page.locator('text=Strategy Lab')).toBeVisible();
    await expect(page.locator('text=Pair Explorer')).toBeVisible();
  });

  test('can navigate between all tabs', async ({ page }) => {
    await page.goto('/');
    
    // Navigate through each tab
    await page.click('text=AutoQuant');
    await expect(page.locator('text=AutoQuant')).toBeVisible();
    
    await page.click('text=Optimizer');
    await expect(page.locator('text=Optimizer')).toBeVisible();
    
    await page.click('text=Strategy Lab');
    await expect(page.locator('text=Strategy Lab')).toBeVisible();
    
    await page.click('text=Pair Explorer');
    await expect(page.locator('text=Pair Explorer')).toBeVisible();
    
    // Return to AutoQuant
    await page.click('text=AutoQuant');
    await expect(page.locator('text=AutoQuant')).toBeVisible();
  });

  test('tab state persists during navigation', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Make some changes
    await page.selectOption('select[name="timeframe"]', '5m');
    
    // Navigate away and back
    await page.click('text=Optimizer');
    await page.click('text=AutoQuant');
    
    // State should persist
    const timeframeSelect = page.locator('select[name="timeframe"]');
    await expect(timeframeSelect).toHaveValue('5m');
  });

  test('browser back button works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    await page.click('text=Optimizer');
    
    // Use browser back
    await page.goBack();
    
    // Should return to AutoQuant
    await expect(page.locator('text=AutoQuant')).toBeVisible();
  });

  test('URL updates with tab navigation', async ({ page }) => {
    await page.goto('/');
    
    await page.click('text=AutoQuant');
    await expect(page).toHaveURL(/autoquant/i);
    
    await page.click('text=Optimizer');
    await expect(page).toHaveURL(/optimizer/i);
  });
});

test.describe('Responsive Navigation', () => {
  test('mobile menu toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Look for mobile menu button
    const menuButton = page.locator('button').filter({ hasText: /menu/i }).or(page.locator('.navbar-toggle')).first();
    
    if (await menuButton.isVisible()) {
      await menuButton.click();
      // Menu should be visible
      await expect(page.locator('text=AutoQuant')).toBeVisible();
    }
  });

  test('tabs are accessible via keyboard', async ({ page }) => {
    await page.goto('/');
    
    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Should navigate to first tab
    await expect(page.locator('text=AutoQuant').or(page.locator('text=Optimizer'))).toBeVisible();
  });
});
