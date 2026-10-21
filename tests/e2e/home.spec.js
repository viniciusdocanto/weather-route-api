const { test, expect } = require('@playwright/test');

test.describe('Página Inicial - Estrutura e Elementos Principais', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve carregar a página com título correto e branding', async ({ page }) => {
    await expect(page).toHaveTitle(/WeatherTrip/i);
    const brand = page.locator('nav span.font-bold');
    await expect(brand).toHaveText('WeatherTrip');
  });

  test('deve exibir os campos essenciais do formulário de viagem', async ({ page }) => {
    await expect(page.locator('#origin')).toBeVisible();
    await expect(page.locator('#destination')).toBeVisible();
    await expect(page.locator('#trip-date')).toBeVisible();
    await expect(page.locator('button:has-text("Adicionar Parada")')).toBeVisible();
    await expect(page.locator('button:has-text("Calcular e Buscar Clima")')).toBeVisible();
  });

  test('deve exibir o placeholder inicial de resultados', async ({ page }) => {
    const placeholder = page.locator('#results-placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('Onde a viagem vai levar você hoje?');
  });

  test('deve exibir o rodapé com informações do projeto', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('WeatherTrip');
  });
});
