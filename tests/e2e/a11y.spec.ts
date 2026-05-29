import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Navigate with a relative URL so it resolves against the `/gitverse/` base
// path baked into `baseURL` (see playwright.config.ts), not the origin root.
//
// The app calls hydrate() on load, which reads IndexedDB via idb-keyval. With
// no custom store configured (see src/persistence/storage.ts), idb-keyval uses
// its default database `keyval-store`. A prior test's auto-saved session would
// otherwise leak in and break the clean-initial-state assumptions (axe scan,
// reduced motion). addInitScript runs before page scripts on every navigation
// in the context, so the delete happens before main.ts's hydrate() runs.
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

/**
 * A commit node only renders once the engine has an initialized repo with a
 * staged change committed. `git commit -m` alone is a no-op on a clean tree
 * (see src/engine/commands/commit.ts — it requires the index to differ from
 * HEAD), so each commit needs: touch a file, `git add`, then `git commit`.
 * This helper drives that sequence through the real terminal input.
 */
async function makeCommit(page: Page, file: string, message: string, init = false) {
  const input = page.locator('#terminal-input');
  await input.click();
  if (init) {
    await input.fill('git init');
    await input.press('Enter');
  }
  await input.fill(`touch ${file}`);
  await input.press('Enter');
  await input.fill(`git add ${file}`);
  await input.press('Enter');
  await input.fill(`git commit -m "${message}"`);
  await input.press('Enter');
  // Wait for Svelte to render the new commit node before returning so callers
  // don't race the next assertion against the (async) re-render.
  await expect(page.locator('circle[role="button"]')).not.toHaveCount(0);
}

test('no WCAG 2.1 AA violations on initial view', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('clicking a commit node prefills checkout without executing', async ({ page }) => {
  const input = page.locator('#terminal-input');
  await makeCommit(page, 'a.txt', 'first', true);

  // A real commit circle should now exist.
  const node = page.locator('circle[role="button"]');
  await expect(node).toHaveCount(1);
  await node.first().click();

  // Prefilled, not executed: the input still carries the checkout text and
  // keeps focus (rather than being cleared into a fresh empty prompt).
  await expect(input).toHaveValue(/git checkout/);
  await expect(input).toBeFocused();
});

test('graph is keyboard navigable and fit works', async ({ page }) => {
  const input = page.locator('#terminal-input');
  await makeCommit(page, 'a.txt', 'a', true);
  await makeCommit(page, 'b.txt', 'b');

  await expect(page.locator('circle[role="button"]')).toHaveCount(2);

  // Focus the viewport and exercise pan/zoom keys + the fit affordance.
  await page.locator('[role="application"]').focus();
  await page.keyboard.press('Equal'); // zoom in (+)
  await page.keyboard.press('0'); // fit
  await page.getByRole('button', { name: 'Fit graph to view' }).click();

  // Focus a commit node and activate it via keyboard.
  await page.locator('circle[role="button"]').first().focus();
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue(/git checkout/);
});

test('recenter button reflects follow-HEAD mode through drag/recenter/fit', async ({ page }) => {
  await makeCommit(page, 'a.txt', 'a', true);
  await makeCommit(page, 'b.txt', 'b');

  const btn = page.getByRole('button', { name: 'Recenter on HEAD and follow' });

  // Following by default after committing.
  await expect(btn).toHaveAttribute('aria-pressed', 'true');

  // Drag an empty area of the viewport — panning disengages follow. Aim well
  // away from any commit node (top-left quadrant) so the drag starts on canvas,
  // not on a circle[role=button].
  const vp = page.locator('[role="application"]');
  const box = await vp.boundingBox();
  if (!box) throw new Error('viewport has no bounding box');
  const startX = box.x + box.width * 0.2;
  const startY = box.y + box.height * 0.2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY + 80, { steps: 10 });
  await page.mouse.up();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');

  // Recenter re-engages follow.
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');

  // Fit-all pauses follow.
  await page.getByRole('button', { name: 'Fit graph to view' }).click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
});

test('reduced motion disables the HEAD pulse animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await makeCommit(page, 'a.txt', 'a', true);

  // The HEAD glow <animate> element must not be rendered under reduced motion.
  await expect(page.locator('circle[role="button"]')).toHaveCount(1);
  await expect(page.locator('circle animate')).toHaveCount(0);
});
