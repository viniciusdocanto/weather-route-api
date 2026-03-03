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
- **Segurança:** Prevenção contra abusos usando Rate Limit nas rotas da API e mitigação de vulnerabilidades XSS (Cross-Site Scripting) via DOM.

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
