# Deploy e Staging

Checklist operacional para subir o `Peladinhas Sofredores` com previsibilidade.

## Pre-requisitos

- Backend com dependencias instaladas a partir de `backend/requirements-dev.txt`.
- Frontend com dependencias instaladas via `npm install` em `frontend/`.
- Banco PostgreSQL acessivel para staging/producao.
- Variaveis de ambiente baseadas em `backend/.env.example`.

## Variaveis minimas

- `SECRET_KEY`
- `DEBUG=false`
- `ALLOWED_HOSTS`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `USE_SQLITE=false`

## Checklist de release

1. Confirmar que `python backend/manage.py check` passa.
2. Confirmar que `python backend/manage.py makemigrations --check --dry-run` nao acusa mudancas pendentes.
3. Rodar `cd backend && pytest -q`.
4. Rodar `cd frontend && npm run build`.
5. Se houver espaco em disco disponivel, instalar browser do Playwright e rodar `cd frontend && npm run test:e2e`.
6. Revisar `.env` do ambiente alvo e segredos.
7. Aplicar migrations com `python backend/manage.py migrate`.
8. Validar login admin, dashboard financeiro, gestao de elenco, pre-jogo e portal do usuario comum.

## Smoke test de staging

1. Login como admin.
2. Criar ou editar um mensalista.
3. Criar ou editar uma conta de acesso vinculada a um jogador.
4. Lancar uma mensalidade e conferir saldo/analytics.
5. Abrir a tela de pre-jogo, confirmar presencas e gerar times.
6. Registrar um resultado da pelada.
7. Login como usuario comum e validar portal, historico e troca de senha.

## Docker

Para um ambiente local muito proximo de staging:

1. Executar `docker compose up --build`.
2. Validar backend em `http://localhost:8000`.
3. Validar frontend em `http://localhost:5173`.
4. Conferir se migrations subiram automaticamente.

## Observacoes

- A suite E2E ja esta preparada, mas a execucao completa depende da instalacao do browser do Playwright.
- Se o ambiente acusar `ENOSPC`, libere espaco antes de instalar o Chromium.
