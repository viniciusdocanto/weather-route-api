# Backlog de Funcionalidades (Plano de Implementação Futuro)

Este documento guarda ideias, feedbacks e melhorias mapeadas para enriquecer a experiência do *WeatherTrip*.

## 1. Múltiplas Rotas e Melhoria de Caminho
**Problema:** Atualmente, a API de rotas sempre pega o caminho principal (mais rápido/curto), sem dar opções. Às vezes o caminho retornado não é o preferido do usuário (ex: pegar a estrada mais movimentada, ignorando um atalho que ele conhece).
**Solução Planejada:**
- Extrair pelo menos 2 a 3 possibilidades de trajeto da API de mobilidade.
- Apresentar na interface cartões ou opções ("Via BR-101", "Via Rod. do Sol") antes de submeter o clima.
- Deixar o usuário selecionar visualmente a rota desejada.

## 2. Mostrar o Tempo Total de Viagem
**Contexto:** Aplicativos clássicos (Waze, Google Maps) sempre mostram o tempo total de viagem em horas e minutos, algo crucial para viagens.
**Solução Planejada:**
- O backend (`weatherRouteService.js`) já retorna a duração (`durationTotal` em segundos).
- Criar a formatação visual (ex: "4h 32m de viagem") no Frontend (`script.js`).
- Mostrar no topo do resumo de resultados ou diretamente no mapa, acompanhado também da quilometragem total.

## 3. Botão "Enviar para o Waze / Google Maps"
**Problema:** Depois de usar o site para ver como está o clima em todo trajeto, o usuário precisa fechar a tela, abrir seu GPS de preferência e redigitar tudo de novo para navegar.
**Solução Planejada:**
- Gerar links dinâmicos na interface (Deep Links).
- **Para Google Maps:** Construir um URL tipo `https://www.google.com/maps/dir/?api=1&origin=[Origem]&destination=[Destino]&waypoints=[Paradas]`.
- **Para Waze:** Construir um URL tipo `https://waze.com/ul?q=[Destino]&navigate=yes` (pesquisar limites de rotas complexas do Waze).
- Botão super prático e visível na parte inferior da rota calculada.
