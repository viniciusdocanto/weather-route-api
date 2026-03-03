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
- **Segurança:** Prevenção contra abusos usando Rate Limit nas rotas da API, validação rigorosa de input no servidor para evitar ataques de DoS e mitigação de vulnerabilidades XSS (Cross-Site Scripting) via DOM.
- **Resiliência do Frontend:** Tratamento robusto de erros HTTP em todas as chamadas `fetch`, garantindo feedback claro ao usuário mesmo em falhas de servidor ou limites de rede.
- **Favicon Dinâmico:** Emoji inline via SVG (🌦️) para evitar erros 404 e melhorar a identificação visual.
- **Acessibilidade:** Suporte a leitores de tela com `aria-label` e associação semântica de labels e inputs, além de cores contrastantes garantindo legibilidade e conformidade com os padrões WCAG AA.
- **Segurança Avançada:** Implementação de Subresource Integrity (SRI) em CDNs de terceiros (Leaflet) para garantir a integridade dos scripts carregados.
- **SEO & Social Media:** Meta tags otimizadas para Open Graph e Twitter Cards, incluindo correção de caminhos de imagem para melhor compatibilidade de preview.
- **Performance:** Configuração de cache de longo prazo (TTL eficiente de 1 ano) para ativos estáticos (CSS/JS), melhorando drasticamente a pontuação de velocidade no carregamento de navegadores recorrentes.
- **Flexibilidade de Hospedagem:** Correção de chamadas de API relativas, permitindo a implantação em subdiretórios perfeitamente integrada.


## 🛠️ Tecnologias Utilizadas

**Backend:**
- Node.js & Express
- SQLite3 (Banco de dados local para Cache)
- Axios (Requisições HTTP)

**Frontend:**
- HTML5, CSS3 & JavaScript Puro (Vanilla)

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

4. **Inicie o servidor:**
   ```bash
   npm start
   ```
   O app estará disponível em `http://localhost:3000`.

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
