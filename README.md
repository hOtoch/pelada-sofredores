# Peladinhas Sofredores

Aplicacao web para gestao financeira e esportiva de uma pelada semanal entre amigos.

## Estrutura

- `backend/`: projeto Django + DRF, modelos, admin, API e testes Python.
- `frontend/`: scaffold React + Vite + TypeScript para as telas mobile-first.
- `docs/`: blueprint arquitetural e referencias da Fase 1.
- `docker-compose.yml`: orquestracao local de backend, frontend e PostgreSQL.
- `.github/workflows/ci.yml`: pipeline basico de CI para backend e frontend.

## Backend

1. Crie e ative uma venv.
2. Instale as dependencias com `pip install -r backend/requirements-dev.txt`.
3. Copie `backend/.env.example` para um `.env` local se quiser customizar.
4. Para desenvolvimento local sem PostgreSQL, configure `USE_SQLITE=true`.
5. Rode as migrations com `python backend/manage.py migrate`.
6. Suba a API com `python backend/manage.py runserver`.

## Frontend

1. Entre em `frontend/`.
2. Instale dependencias com `npm install`.
3. Rode `npm run dev`.

## Rodando com Docker

1. Na raiz do projeto, execute `docker compose up --build`.
2. A API Django ficara em `http://localhost:8000`.
3. O frontend ficara em `http://localhost:5173`.
4. O banco PostgreSQL ficara em `localhost:5432`.

Observacoes:
- O backend roda migrations automaticamente ao subir o container.
- O frontend e servido por Nginx e faz proxy para `/api` e `/admin`.

## CI

O workflow em `.github/workflows/ci.yml` executa:
- Backend: install, migrate com SQLite, `manage.py check` e `pytest`.
- Frontend: install com `npm ci` e `npm run build`.

## E2E com Playwright

Infra inicial de E2E foi adicionada em `frontend/` com dois fluxos:
- Admin: login e lancamento no dashboard.
- Common user: login, acesso ao portal e navegacao para pre-jogo.

Como rodar localmente:
1. Garanta a venv Python do projeto em `./.venv_clean` com dependencias do backend instaladas.
2. Entre em `frontend/` e rode `npm install`.
3. Instale o browser do Playwright com `npm run test:e2e:install`.
4. Execute os testes com `npm run test:e2e`.

O runner sobe backend e frontend automaticamente, aplica `migrate` e executa `seed_e2e --reset`.
Credenciais da massa E2E:
- Admin: `admin` / `admin123`
- Comum: `jogador` / `jogador123`

## Operacao do dia a dia

- O dashboard financeiro agora permite exportar o extrato filtrado em `CSV` e `JSON`.
- O dashboard tambem exporta um relatorio consolidado da temporada em `CSV` e `JSON`.
- A tela de pre-jogo exporta a rodada selecionada com presenca, times e resultado em `CSV` e `JSON`.
- A aplicacao mostra feedback operacional por toasts para criacoes, edicoes, estornos, presenca, contas e troca de senha.

## Staging e deploy

- Checklist operacional: `docs/deploy-staging-checklist.md`
- Fluxo recomendado: `check` -> `makemigrations --check` -> `pytest` -> `npm run build` -> `migrate` -> smoke test

## Proximas frentes

- Exportacoes esportivas por rodada e relatorio consolidado da temporada.
- Execucao completa da suite Playwright assim que houver espaco para instalar o browser.
- Endurecimento de seguranca para producao, incluindo hosts finais, cookies/sessoes e observabilidade.
