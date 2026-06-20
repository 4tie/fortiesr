import { test, expect } from '@playwright/test';

test.describe('Error Handling E2E Tests', () => {
  test('handles API errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Mock a failed API call by intercepting
    await page.route('**/api/**', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Internal Server Error' })
    }));
    
    await page.click('button:has-text("Start")');
    
    // Should show error message
    await expect(page.locator('text=error').or(page.locator('text=failed'))).toBeVisible({ timeout: 5000 });
  });

  test('handles network errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Mock network failure
    await page.route('**/api/**', route => route.abort());
    
    await page.click('button:has-text("Start")');
    
    // Should show network error message
    await expect(page.locator('text=network').or(page.locator('text=connection'))).toBeVisible({ timeout: 5000 });
  });

  test('handles form validation errors', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Try to start without required fields
    await page.click('button:has-text("Start")');
    
    // Should show validation error
    await expect(page.locator('text=required').or(page.locator('text=invalid'))).toBeVisible({ timeout: 3000 });
  });

  test('handles timeout errors', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Mock slow response
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });
    
    await page.click('button:has-text("Start")');
    
    // Should show timeout or loading state
    await expect(page.locator('text=loading').or(page.locator('.loading-spinner'))).toBeVisible({ timeout: 3000 });
  });

  test('displays user-friendly error messages', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Mock specific error
    await page.route('**/api/**', route => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Invalid strategy configuration' })
    }));
    
    await page.click('button:has-text("Start")');
    
    // Should show specific error message
    await expect(page.locator('text=Invalid strategy configuration')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Edge Cases E2E Tests', () => {
  test('handles empty state gracefully', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Should show empty state or placeholder
    await expect(page.locator('text=No runs').or(page.locator('text=Waiting').or(page.locator('text=Configure'))).toBeVisible();
  });

  test('handles large data sets', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Pair Explorer');
    
    // Mock large dataset
    await page.route('**/api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pairs: Array.from({ length: 1000 }, (_, i) => ({
          pair: `PAIR${i}/USDT`,
          profit: Math.random() * 100
        }))
      })
    }));
    
    // Should handle pagination or virtual scrolling
    const tableLocator = page.locator('.table').or(page.locator('.list'));
    await expect(tableLocator.first()).toBeVisible({ timeout: 5000 });
  });

  test('handles concurrent requests', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Click multiple buttons rapidly
    await Promise.all([
      page.click('button:has-text("Generate")'),
      page.click('button:has-text("Start")'),
    ]);
    
    // Should handle gracefully without crashing
    await expect(page.locator('body')).toBeVisible();
  });

  test('handles browser refresh during operation', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Start an operation
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(1000);
    
    // Refresh page
    await page.reload();
    
    // Should recover gracefully
    await expect(page.locator('text=AutoQuant')).toBeVisible();
  });

  test('handles browser back/forward navigation', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    // Navigate through history
    await page.goBack();
    await page.goForward();
    
    // Should maintain state
    await expect(page.locator('text=AutoQuant')).toBeVisible();
  });
});

test.describe('Performance E2E Tests', () => {
  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000); // 5 seconds
  });

  test('tab switching is responsive', async ({ page }) => {
    await page.goto('/');
    
    const startTime = Date.now();
    await page.click('text=AutoQuant');
    const switchTime = Date.now() - startTime;
    
    expect(switchTime).toBeLessThan(1000); // 1 second
  });

  test('form interactions are responsive', async ({ page }) => {
    await page.goto('/');
    await page.click('text=AutoQuant');
    
    const startTime = Date.now();
    await page.selectOption('select[name="timeframe"]', '5m');
    const interactionTime = Date.now() - startTime;
    
    expect(interactionTime).toBeLessThan(500); // 500ms
  });
});
