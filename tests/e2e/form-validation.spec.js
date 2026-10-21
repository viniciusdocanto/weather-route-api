const { test, expect } = require('@playwright/test');

test.describe('Formulário de Viagem - Validações e Interações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve exibir notificação toast quando submeter sem origem ou destino', async ({ page }) => {
    const submitBtn = page.locator('button:has-text("Calcular e Buscar Clima")');
    await submitBtn.click();

    const toastContainer = page.locator('#toast-container');
    await expect(toastContainer).toContainText('Quase lá!');
    await expect(toastContainer).toContainText('Por favor, preencha a cidade de origem e de destino.');
  });

  test('deve permitir adicionar e remover múltiplas paradas intermediárias', async ({ page }) => {
    const addStopBtn = page.locator('button:has-text("Adicionar Parada")');

    // Adiciona primeira parada
    await addStopBtn.click();
    const firstStopInput = page.locator('#stop-1');
    await expect(firstStopInput).toBeVisible();

    // Adiciona segunda parada
    await addStopBtn.click();
    const secondStopInput = page.locator('#stop-2');
    await expect(secondStopInput).toBeVisible();

    // Remove a primeira parada
    const removeFirstBtn = page.locator('#group-stop-1 button[aria-label="Remover parada"]');
    await removeFirstBtn.click();

    await expect(firstStopInput).not.toBeVisible();
    await expect(secondStopInput).toBeVisible();
  });

  test('deve aplicar restrições de data mínima e máxima no campo de partida', async ({ page }) => {
    const dateInput = page.locator('#trip-date');
    await expect(dateInput).toHaveAttribute('min');
    await expect(dateInput).toHaveAttribute('max');

    const minAttr = await dateInput.getAttribute('min');
    const maxAttr = await dateInput.getAttribute('max');

    expect(minAttr).toBeTruthy();
    expect(maxAttr).toBeTruthy();
    expect(new Date(maxAttr).getTime()).toBeGreaterThan(new Date(minAttr).getTime());
  });
});
