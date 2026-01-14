# 🚗 WeatherTrip API

Uma aplicação Fullstack que calcula a rota entre duas cidades e fornece a previsão do tempo exata para cada ponto do trajeto, considerando o deslocamento temporal (onde o carro estará daqui a X horas).

## 🚀 Funcionalidades

- **Cálculo de Rota:** Estima tempo e distância real de direção.
- **Previsão Espaço-Temporal:** Cruza a posição do carro com a hora estimada de chegada para pegar a previsão do tempo correta (não a atual).
- **Geocodificação Reversa:** Identifica o nome das cidades ao longo da rodovia.
- **Cache Inteligente:** Utiliza SQLite para salvar rotas consultadas (TTL de 1 hora), economizando requisições externas e acelerando a resposta.
- **Autocomplete:** Frontend com busca de cidades integrada ao OpenStreetMap.

## 🛠️ Tecnologias Utilizadas

**Backend:**
- Node.js & Express
- SQLite3 (Banco de dados local para Cache)
- Axios (Requisições HTTP)

**Frontend:**
- HTML5, CSS3 & JavaScript Puro (Vanilla)
- Integrável em WordPress/Elementor via Shortcode ou Widget HTML.

**APIs Externas (Gratuitas/Open Source):**
- 🗺️ **Nominatim (OSM):** Geocodificação (Texto ↔ Coordenadas).
- 🛣️ **OSRM (Project-OSRM):** Cálculo de rotas e geometria.
- 🌦️ **Open-Meteo:** Previsão do tempo meteorológica histórica e futura.

## 📦 Como rodar o projeto

### Pré-requisitos
- Node.js instalado (v18 ou superior recomendado).

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/viniciusdocanto/weather-route-api.git](https://github.com/viniciusdocanto/weather-route-api.git)
   cd weather-route-api