const { test, expect } = require('@playwright/test');

test.describe('Fluxo Completo de Consulta de Viagem e Clima (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('deve executar o fluxo de busca de rotas alternativas, seleção e exibição da previsão do tempo', async ({ page }) => {
    // 1. Mock do endpoint de opções de rota
    await page.route('**/api/route-options', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          points: [
            { lat: -23.5505, lng: -46.6333, originalName: 'São Paulo' },
            { lat: -22.9068, lng: -43.1729, originalName: 'Rio de Janeiro' }
          ],
          routes: [
            {
              id: 'route-0',
              name: 'Via BR-116 (Presidente Dutra)',
              distance: 435000,
              duration: 21600,
              path: [[-46.6333, -23.5505], [-43.1729, -22.9068]],
              provider: 'OSRM'
            },
            {
              id: 'route-1',
              name: 'Via SP-070 / Ayrton Senna',
              distance: 450000,
              duration: 23400,
              path: [[-46.6333, -23.5505], [-43.1729, -22.9068]],
              provider: 'OSRM'
            }
          ]
        })
      });
    });

    // 2. Mock do endpoint de previsão do tempo
    await page.route('**/api/forecast', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          routeGeo: [[-46.6333, -23.5505], [-43.1729, -22.9068]],
          routeName: 'Via BR-116 (Presidente Dutra)',
          durationTotal: 21600,
          distanceTotal: 435000,
          provider: 'OSRM',
          checkpoints: [
            {
              formattedTime: '21/10 20:00',
              lat: -23.5505,
              lng: -46.6333,
              locationName: 'São Paulo',
              distanceFromStart: 0,
              weather: { temp: 23, condition: 'Céu Limpo ☀️', rainProb: 0 },
              isStopNode: true
            },
            {
              formattedTime: '22/10 02:00',
              lat: -22.9068,
              lng: -43.1729,
              locationName: 'Rio de Janeiro',
              distanceFromStart: 435,
              weather: { temp: 25, condition: 'Parcialmente Nublado ⛅', rainProb: 5 },
              isStopNode: true
            }
          ]
        })
      });
    });

    // Preenche o formulário
    await page.fill('#origin', 'São Paulo');
    await page.fill('#destination', 'Rio de Janeiro');

    // Submete a busca de rotas
    const submitBtn = page.locator('button:has-text("Calcular e Buscar Clima")');
    await submitBtn.click();

    // Valida que o container de opções de rotas apareceu
    const routeSelector = page.locator('#route-selector-container');
    await expect(routeSelector).toBeVisible();
    await expect(routeSelector).toContainText('Escolha seu trajeto:');

    // Valida que as opções de rotas foram renderizadas
    const routeOptions = page.locator('#route-options-list button');
    await expect(routeOptions).toHaveCount(2);
    await expect(routeOptions.first()).toContainText('Via BR-116 (Presidente Dutra)');

    // Clica na primeira rota para carregar o clima
    await routeOptions.first().click();

    // Valida que o container de resultados foi populado e o placeholder sumiu
    await expect(page.locator('#results-placeholder')).not.toBeVisible();
    await expect(page.locator('#results-content')).toBeVisible();

    // Valida resumo de tempo e distância
    await expect(page.locator('#total-duration')).not.toHaveText('--');
    await expect(page.locator('#total-distance')).not.toHaveText('--');

    // Valida timeline com os pontos da viagem
    const timeline = page.locator('#timeline');
    await expect(timeline).toContainText('São Paulo');
    await expect(timeline).toContainText('Rio de Janeiro');
    await expect(timeline).toContainText('Céu Limpo ☀️');
    await expect(timeline).toContainText('23°C');

    // Valida links externos para navegação GPS (Google Maps e Waze)
    const gmapsBtn = page.locator('#btn-google-maps');
    const wazeBtn = page.locator('#btn-waze');
    await expect(gmapsBtn).toBeVisible();
    await expect(wazeBtn).toBeVisible();

    const gmapsHref = await gmapsBtn.getAttribute('href');
    const wazeHref = await wazeBtn.getAttribute('href');
    expect(gmapsHref).toContain('google.com/maps');
    expect(wazeHref).toContain('waze.com/ul');

    // Valida que o histórico de viagens foi persistido no navegador
    const historyBtn = page.locator('#history-btn');
    await expect(historyBtn).toBeVisible();
  });
});
