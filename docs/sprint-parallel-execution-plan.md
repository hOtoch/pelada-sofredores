# Sprint Paralela - Peladinhas Sofredores

## Objetivo do ciclo

Fechar a proxima camada do produto em quatro trilhas paralelas:

1. portal do usuario comum;
2. analytics de temporada e indicadores de gestao;
3. operacao da pelada com historico e resultados;
4. preparacao para execucao e entrega com Docker e CI.

## Estado atual

Ja entregue:

- autenticacao com RBAC inicial;
- CRUD de mensalistas;
- caixa, lancamentos e mensalidades;
- presenca da pelada e convidados;
- gerador de times;
- gestao de peladas com historico e status;
- registro textual de resultado da rodada.

## Trilhas paralelas

### Agente Backend

Escopo:

- endpoints de perfil do usuario comum;
- analytics basicos de presenca, adimplencia e temporada;
- consolidacao do vinculo `User <-> Player`;
- testes de API.

Arquivos principais:

- `backend/core/models.py`
- `backend/core/serializers.py`
- `backend/core/views.py`
- `backend/core/api_urls.py`
- `backend/core/migrations/*`
- `backend/tests/test_api.py`

Saidas esperadas:

- contratos REST para perfil pessoal e indicadores;
- cobertura automatizada backend;
- nenhuma quebra no fluxo atual.

### Agente Frontend Profile

Escopo:

- base do portal do usuario comum;
- tela de perfil e status pessoal;
- visualizacao de presenca recente, peladas futuras e resumo financeiro pessoal.

Arquivos principais:

- novos arquivos em `frontend/src/pages/`
- novos arquivos em `frontend/src/features/`
- componentes auxiliares desacoplados

Saidas esperadas:

- pagina pronta para integracao no roteamento principal;
- contratos de props claros;
- compatibilidade com mobile.

### Agente Frontend Analytics

Escopo:

- evolucao do dashboard analitico;
- cards e blocos de indicadores por periodo;
- preparo da tela para consumir metricas de temporada.

Arquivos principais:

- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/features/dashboard/contracts.ts`
- helpers novos especificos do dashboard

Saidas esperadas:

- dashboard mais executivo;
- compatibilidade com os dados atuais e com metricas futuras;
- zero dependencia de alteracoes globais de estilo.

### Agente DevOps

Escopo:

- Docker local para backend, frontend e banco;
- pipeline CI inicial;
- documentacao de uso e validacao.

Arquivos principais:

- `Dockerfile*`
- `docker-compose*`
- `.github/workflows/*`
- `README.md`

Saidas esperadas:

- subida local consistente;
- checks automatizados para backend e frontend;
- documentacao enxuta de operacao.

## Dependencias e integracao

Pode rodar em paralelo:

- backend API;
- frontend profile;
- frontend analytics;
- Docker e CI.

Precisa de integracao coordenada ao final:

- roteamento do portal do usuario comum no `App`;
- consumo dos novos endpoints do backend;
- ajustes finais de tipos compartilhados;
- validacao conjunta de testes e build.

## Ordem de merge recomendada

1. backend API;
2. frontend analytics;
3. frontend profile;
4. devops;
5. integracao final no app shell;
6. validacao completa.

## Checklist de saida

- `backend/manage.py migrate`
- `backend/manage.py check`
- `pytest -q`
- `npm run build`
- smoke test dos fluxos:
  - login admin;
  - login common user;
  - dashboard;
  - pelada atual;
  - perfil do usuario;
  - criacao e fechamento de pelada.
