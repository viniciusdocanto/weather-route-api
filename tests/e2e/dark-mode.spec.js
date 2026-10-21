const { test, expect } = require('@playwright/test');

test.describe('Modo Escuro / Claro (Dark Mode)', () => {
  test.beforeEach(async ({ page }) => {
    // Limpa localStorage antes de cada teste
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('deve alternar para modo escuro e persistir após recarregar a página', async ({ page }) => {
    const toggleBtn = page.locator('#theme-toggle');
    const html = page.locator('html');

    // Estado inicial claro
    await expect(html).not.toHaveClass(/dark/);

    // Clica para ativar modo escuro
    await toggleBtn.click();
    await expect(html).toHaveClass(/dark/);
    await expect(page.locator('#toggle-label')).toHaveText('Modo Claro');

    // Valida persistência no localStorage
    const savedTheme = await page.evaluate(() => localStorage.getItem('wt-theme'));
    expect(savedTheme).toBe('dark');

    // Recarrega a página e valida se o tema continua escuro
    await page.reload();
    await expect(html).toHaveClass(/dark/);
    await expect(page.locator('#toggle-label')).toHaveText('Modo Claro');

    // Alterna de volta para modo claro
    await toggleBtn.click();
    await expect(html).not.toHaveClass(/dark/);
    await expect(page.locator('#toggle-label')).toHaveText('Modo Escuro');
  });
});
