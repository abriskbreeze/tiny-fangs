import { expect, test } from '@playwright/test';

test('records classic mode-selection smoke evidence', async ({
  page,
}, testInfo) => {
  await page.goto('/?presentation=classic');
  await expect(page.getByRole('heading', { name: 'TINY FANGS' })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('classic-mode-select.png'),
    animations: 'disabled',
  });
});
