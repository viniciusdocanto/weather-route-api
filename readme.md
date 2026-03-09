# 🚗 WeatherTrip API

Uma aplicação Fullstack que calcula a rota entre duas cidades e fornece a previsão do tempo exata para cada ponto do trajeto, considerando o deslocamento temporal (onde o carro estará daqui a X horas).

## 🚀 Funcionalidades

- **Cálculo de Rota:** Estima tempo e distância real de direção.
- **Tráfego com Múltiplas Paradas:** Suporte a adicionar múltiplas paradas intermediárias na viagem.
- **Previsão Espaço-Temporal:** Cruza a posição do carro com a hora estimada de chegada para pegar a previsão do tempo correta (não a atual).
- **Geocodificação Reversa:** Identifica o nome das cidades ao longo da rodovia.
- **Cache Inteligente:** Utiliza SQLite para salvar rotas consultadas (TTL de 1 hora), economizando requisições externas e acelerando a resposta. A chave de cache é baseada em coordenadas, evitando duplicatas por variações de texto (ex.: "São Paulo" vs "Sao Paulo").
- **Limpeza Automática de Cache:** Rotina periódica a cada 24h remove registros expirados do banco, evitando crescimento indefinido do arquivo `weather_trip.db`.
- **Autocomplete:** Frontend com busca de cidades integrada ao Mapbox/Nominatim.
- **Modo Escuro (Dark Mode):** Suporte nativo a temas claro e escuro, com persistência via `localStorage` e detecção automática da preferência do sistema operacional.
- **Interface Dinâmica & Badges:** Timeline rica em detalhes com badges de status (**📍 Partida**, **🏁 Chegada**, **📌 Parada**) e ícones SVG responsivos.
- **Segurança:** Prevenção contra abusos usando Rate Limit nas rotas da API, validação rigorosa de input no servidor para evitar ataques de DoS e mitigação de vulnerabilidades XSS (Cross-Site Scripting) via DOM.
- **Resiliência do Frontend:** Tratamento robusto de erros HTTP em todas as chamadas `fetch`, garantindo feedback claro ao usuário mesmo em falhas de servidor ou limites de rede.
- **Favicon Dinâmico:** Emoji inline via SVG (🌦️) para evitar erros 404 e melhorar a identificação visual.
- **Acessibilidade:** Suporte a leitores de tela com `aria-label` e associação semântica de labels e inputs, além de cores contrastantes garantindo legibilidade e conformidade com os padrões WCAG AA.
- **Segurança Avançada:** Implementação de Subresource Integrity (SRI) em CDNs de terceiros (Leaflet) para garantir a integridade dos scripts carregados.
- **SEO & Social Media:** Meta tags otimizadas para Open Graph e Twitter Cards, incluindo correção de caminhos de imagem para melhor compatibilidade de preview.
- **Performance:** Configuração de cache de longo prazo (TTL eficiente de 1 ano) para ativos estáticos (CSS/JS), melhorando drasticamente a pontuação de velocidade no carregamento de navegadores recorrentes.
- **Flexibilidade de Hospedagem:** Correção de chamadas de API relativas, permitindo a implantação em subdiretórios perfeitamente integrada.
- **Node Build Automático (ESBuild):** Pipeline nativa acoplada para empacotar todo código Javascript do projeto (substituindo process.env do server no frontend), permitindo hospedagens JAMStack sem dores de cabeça.
## 🛠️ Tecnologias Utilizadas

**Backend:**
- Node.js & Express
- SQLite3 (Banco de dados local para Cache)
- Axios (Requisições HTTP)
- Helmet & CORS (Segurança de API e Cabeçalhos HTTP)
- **Winston** (Logging profissional estruturado)
- **Arquitetura Modular (Dependency Injection)**:
    - `CacheRepository`: Isolamento de persistência SQLite.
    - `GeocodingService`: Integração Mapbox/Nominatim.
    - `WeatherService`: Previsão via Open-Meteo.
    - `RoutingProviderService`: Orquestração de OSRM/GraphHopper/Mapbox.
    - `WeatherRouteOrchestrator`: Orquestrador desacoplado e testável.

**Frontend & Build Pipeline:**
- HTML5, SCSS & JavaScript Puro (ES6 Modules: api.js, map.js, ui.js)
- ESBuild (Bundler e Minificador JS rápido com suporte a Watch Mode)
- Concurrently (Execução paralela de servidor e build em desenvolvimento)
- Sass (Pré-processador de CSS nativo)
- Sharp (Conversor e Esmagador de imagens node de altíssima velocidade)
**APIs Externas (Gratuitas/Open Source):**
- 🗺️ **Mapbox Geocoding:** Geocodificação (Texto ↔ Coordenadas) (Principal).
- 🗺️ **Nominatim (OSM):** Geocodificação (Texto ↔ Coordenadas) (Fallback caso Mapbox falhe).
- 🛣️ **OSRM / GraphHopper / Mapbox:** Cálculo de rotas e geometria.
- 🌦️ **Open-Meteo:** Previsão do tempo meteorológica histórica e futura.

## 📦 Como rodar o projeto

### Pré-requisitos
- Node.js instalado (v18 ou superior recomendado).

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/viniciusdocanto/weather-route-api.git
   cd weather-route-api
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Crie um arquivo `.env` na raiz do projeto (ou copie o `.env-sample`):
   ```bash
   cp .env-sample .env
   ```
   Edite o arquivo `.env` e adicione suas chaves:
   - `GRAPHHOPPER_KEY`: Sua chave de API do GraphHopper.
   - `MAPBOX_TOKEN`: Seu token de acesso do Mapbox.
   - `API_BASE_URL`: (Opcional) URL base da API se for diferente do padrão `/api`.

6. **Árvore de Desenvolvimento:**
   - Faça suas edições em `src/js/script.js` e `src/scss/style.scss`.
   - Coloque as imagens novas em `src/img/`.

7. **Inicie o servidor localmente:**
   ```bash
   npm start
   ```
   *O comando iniciará automaticamente o processo do `esbuild`, `sass` e `sharp`, copiando todos os arquivos da pasta origem (`/src`) empacotados e minimizados para a pasta final (`/assets`), a qual o `index.html` irá carregar. O app estará disponível em `http://localhost:3000`.*

---

## 🧪 Testes

O projeto utiliza o **Node.js Native Test Runner** para garantir a integridade dos serviços modulares.

### Como rodar os testes:
```bash
node tests/test-core.js
node tests/orchestrator-di.test.js
```
Os testes cobrem:
- Validação de tradução de códigos WMO (Meteorologia).
- Integridade da estrutura de resposta da API de clima.
- Fluxo de negócio do Orquestrador usando **Mocks (DI)**.

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

---

> [!WARNING]
> **Persistência de Dados (SQLite):** Este projeto utiliza SQLite (`weather_trip.db`). Em plataformas como Render.com, o sistema de arquivos é efêmero. Se você precisar de persistência real entre deploys, considere utilizar um **Persistent Disk** ou migrar para um banco de dados gerenciado (Postgres/MySQL).
