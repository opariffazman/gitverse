import { test, expect } from '@playwright/test';

// Clear persisted state so each test starts from the welcome screen
// (same rationale as tests/e2e/a11y.spec.ts).
test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    try {
      indexedDB.deleteDatabase('keyval-store');
    } catch {
      // ignore – storage may be unavailable in some environments
    }
  });
  await page.goto('./');
});

test('explorer drives the full beginner flow: seed → stage → commit → modify', async ({ page }) => {
  const input = page.locator('#terminal-input');
  const explorer = page.getByRole('complementary', { name: 'File explorer' });

  // Empty state + disabled simulate button.
  await expect(explorer.getByText(/No files yet/)).toBeVisible();
  await expect(explorer.getByRole('button', { name: /Simulate changes/ })).toBeDisabled();

  // Seed example files; the real commands echo in the terminal.
  await explorer.getByRole('button', { name: /Example files/ }).click();
  await expect(explorer.getByRole('button', { name: 'README.md U' })).toBeVisible();
  await expect(explorer.getByText('src/')).toBeVisible();
  await expect(explorer.locator('[data-status="untracked"]')).toHaveCount(3);
  await expect(page.getByText('mkdir src')).toBeVisible();

  // init + stage all → badges flip to staged.
  await input.click();
  await input.fill('git init');
  await input.press('Enter');
  await input.fill('git add .');
  await input.press('Enter');
  await expect(explorer.locator('[data-status="staged"]')).toHaveCount(3);
  await expect(explorer.locator('[data-status="untracked"]')).toHaveCount(0);

  // Commit → everything clean; simulate becomes enabled.
  await input.fill('git commit -m "first"');
  await input.press('Enter');
  await expect(explorer.locator('[data-status="clean"]')).toHaveCount(3);
  const simulate = explorer.getByRole('button', { name: /Simulate changes/ });
  await expect(simulate).toBeEnabled();

  // Simulate changes → first two files alphabetically become modified.
  await simulate.click();
  await expect(explorer.locator('[data-status="modified"]')).toHaveCount(2);

  // Clicking a file prefills cat without executing.
  await explorer.getByRole('button', { name: /^README\.md/ }).click();
  await expect(input).toHaveValue('cat README.md');
  await expect(input).toBeFocused();
});

test('explorer collapses to a rail and expands again', async ({ page }) => {
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse file explorer' }).click();
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand file explorer' }).click();
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toBeVisible();
});
