# CLAUDE.md — Guia do projeto Peladinhas Sofredores

Regras de trabalho e boas práticas para este repositório. Vale para humanos e para agentes.
Quando uma regra aqui conflitar com o código existente, o código existente ganha até que a
mudança seja feita de propósito — e aí atualize este arquivo junto.

---

## 1. O que é este projeto

App web de gestão financeira e esportiva de uma pelada semanal entre amigos. Monolito simples,
e é para continuar assim.

- **Backend**: Django 4.2 + Django REST Framework (`backend/`). App principal em `backend/core/`
  (models, serializers, views, permissions, admin). Config em `backend/peladinha/settings.py`.
- **Frontend**: React 18 + Vite + TypeScript (`frontend/`), mobile-first, tema escuro.
- **Banco**: PostgreSQL em Docker/produção; SQLite local com `USE_SQLITE=true`.
- **Testes**: `pytest` no backend, Playwright E2E no frontend (`frontend/e2e/`).
- **CI**: `.github/workflows/ci.yml` (GitHub Actions).
- **Deploy**: `render.yaml`; checklist em `docs/deploy-staging-checklist.md`.
- **Local com Docker**: `docker-compose.yml` (backend 8000, frontend 5173, Postgres 5432).

Público real: dezenas de usuários, não milhares. Toda decisão técnica deve caber nessa escala.

---

## 2. Comandos do dia a dia

```bash
# backend
pip install -r backend/requirements-dev.txt
USE_SQLITE=true python backend/manage.py migrate
USE_SQLITE=true python backend/manage.py runserver
cd backend && USE_SQLITE=true pytest -q
```

```bash
# frontend
npm install --prefix frontend
npm run dev --prefix frontend
npm run build --prefix frontend
```

```bash
# e2e (sobe backend + frontend sozinho, roda migrate e seed_e2e --reset)
npm run test:e2e:install --prefix frontend
npm run test:e2e --prefix frontend
```

```bash
# lint e format
cd backend && ruff check . --fix && ruff format .
npm run lint --prefix frontend
npm run format --prefix frontend
npm run typecheck --prefix frontend
```

```bash
# hooks de pre-commit (uma vez por clone)
pip install -r backend/requirements-dev.txt
pre-commit install
```

Antes de abrir PR, o mínimo é: `ruff check` → `manage.py check` → `makemigrations --check` →
`pytest` → `npm run lint` → `npm run typecheck` → `npm run build`. O `pre-commit` roda a parte
de lint e formatação sozinho a cada commit, e o CI repete tudo no PR.

---

## 3. Git e commits

- Branch por mudança, a partir de `main`. Nada de commit direto em `main`.
- Commits pequenos e descritivos, no formato **Conventional Commits** em português:
  `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.
  Ex.: `feat: adiciona notas rapidas de 1 a 5 na votacao`.
- Um commit = uma ideia. Se o resumo precisa de "e", provavelmente são dois commits.
- Migration entra no mesmo commit da mudança de model que a gerou.
- **Nunca versione**: `.env`, dumps de banco, `db.sqlite3`, `node_modules/`, `dist/`,
  `playwright-report/`, `test-results/`, credenciais de qualquer tipo.
  Dumps `.sql`/`.dump` estão no `.gitignore`; se precisar compartilhar um, use armazenamento
  externo, nunca o repositório.

---

## 4. Configuração e segredos

- Toda configuração sensível vem de variável de ambiente lida em `settings.py`.
  Nada de valor real hardcoded no código.
- Ao adicionar uma variável nova, **atualize `backend/.env.example`** no mesmo commit,
  com um placeholder — nunca o valor real.
- Os defaults do `settings.py` (`replace-me-in-env`, `changeme`) servem para desenvolvimento.
  Em produção, se a variável faltar, o certo é falhar alto — não seguir com o default.

---

## 5. Práticas de código

Ordem de prioridade: **YAGNI e KISS acima de tudo**. A maior fonte de dívida técnica aqui é
over-engineering, não código simples demais.

- Não construa o que "talvez vá precisar". Resolva o caso de hoje.
- **Regra dos três**: só abstraia na terceira repetição. Duplicar duas vezes é mais barato que
  criar a abstração errada.
- **Separação de responsabilidades de verdade** — o único princípio do SOLID que vale desde já:
  - Regra de negócio não mora dentro de componente de UI.
  - Chamada HTTP não mora espalhada em página: tudo passa por `frontend/src/lib/api.ts`.
  - No backend: model guarda o dado e a regra do dado; serializer valida e traduz; view
    orquestra. Lógica de cálculo (balanceamento, ranking, overall) fica em módulo próprio,
    não dentro da view.
- **Nomes descritivos > comentários.** Comente o *porquê* (uma regra da pelada, um caso de borda
  real), nunca o *o quê*.
- **Estrutura por feature, não por tipo de arquivo.** O frontend já segue isso:
  `frontend/src/features/<feature>/` com seus `contracts.ts` e lógica; `domain/types.ts` para
  tipos compartilhados; `theme/` e `styles/` para o visual; `pages/` só monta a tela.
  Componente que só serve a uma feature mora dentro dela, não em `components/`.
- **TypeScript sem `any`.** Prefira tipos derivados dos contratos existentes
  (`TransactionRecord["direction"]`) em vez de recriar unions à mão.
- Arquivos grandes são um sinal, não uma meta: `App.tsx`, `PreMatchPage.tsx`, `lib/api.ts` e
  `core/views.py` já passaram de mil linhas. Ao mexer neles, extraia o pedaço que você tocou em
  vez de acrescentar mais uma camada — melhora incremental, sem refactor gigante de uma vez.

---

## 6. Frontend (web)

- **Mobile-first**, sempre. Não é só CSS: comece decidindo o que é essencial na tela pequena.
  O app é usado no celular, em pé, na beira do campo.
- **Design system mínimo, em um lugar só.** Cor, espaçamento, tipografia e raio vêm dos tokens:
  `frontend/src/theme/tokens.ts` e as variáveis CSS de `frontend/src/styles/global.css`.
  Nada de hex solto em componente. Se as duas fontes divergirem, alinhe-as no mesmo commit —
  o objetivo é uma fonte de verdade só.
- **Acessibilidade desde o começo**, é quase de graça e caro de retrofitar: HTML semântico
  (`button` é `button`, não `div` clicável), contraste adequado no tema escuro, navegação por
  teclado com foco visível, `alt` em imagem informativa, `label` em todo input.
- **Performance é requisito, não otimização futura.** Orçamento: LCP < 2,5s em 4G.
  Imagens otimizadas e `loading="lazy"`; nada de biblioteca pesada para resolver coisa pequena.
  Antes de adicionar dependência, pergunte se 30 linhas resolvem.
- SEO não é prioridade: o app fica atrás de login. Não invista em renderização no servidor por
  causa de busca orgânica.
- Estado: `useState`/`useContext` bastam. Não introduza state manager global sem um problema
  concreto que ele resolva.

---

## 7. Backend

- **Validação no servidor sempre**, mesmo quando o cliente já valida. O front valida por UX;
  o back valida por correção.
- Permissão explícita em toda view (`core/permissions.py`). Admin e usuário comum têm alcances
  bem diferentes — o padrão é negar.
- Nunca confie em campo vindo do cliente para autorização (id de jogador, papel, valores).
- Migrations sempre revisadas antes do commit; `makemigrations --check` faz parte do fluxo.
- Dinheiro é `Decimal`, nunca `float`.

---

## 8. Qualidade e segurança

- **Teste onde dói**: regra de negócio e fluxo crítico — login, lançamento financeiro, presença,
  geração de times, ranking. Perseguir 100% de cobertura aqui é desperdício. Um punhado de E2E
  nos caminhos principais rende mais que centenas de testes de componente.
- Todo bug corrigido ganha um teste que falha antes do fix.
- Segurança web básica: HTTPS em produção, `DEBUG=false`, `ALLOWED_HOSTS` e
  `CSRF_TRUSTED_ORIGINS` fechados nos domínios reais, cookies de sessão `Secure`/`HttpOnly`,
  headers de segurança (CSP, HSTS), dependências atualizadas.
- Não logue token, senha ou dado pessoal.
- **Observabilidade mínima**: monitoramento de erros em produção. Você não conserta o que não vê.

---

## 9. Arquitetura: o erro a evitar

Nada de microsserviço, cache distribuído, fila ou abstração genérica para um site com dezenas de
usuários. **Monolito, simples.** Arquitetura complexa é resposta a um problema real de escala —
sem o problema, você paga o custo e não recebe o benefício.

---

## 10. Ferramentas de qualidade já instaladas

- **Frontend**: ESLint 9 (flat config em `frontend/eslint.config.js`) + Prettier
  (`frontend/.prettierrc.json`). `no-explicit-any` é erro; os avisos de
  `react-hooks/exhaustive-deps` que já existiam ficaram como *warning* — resolva o do arquivo em
  que você mexer, sem refactor em massa.
- **Backend**: Ruff lint + format, configurado em `backend/pyproject.toml`
  (linha de 100, regras E/F/I/UP/B/DJ/C4/SIM, migrations fora do escopo).
- **Pre-commit**: `.pre-commit-config.yaml` na raiz — ruff, ruff-format, prettier, eslint e
  verificações básicas (arquivo grande, chave privada, YAML/TOML/JSON válidos).
- **CI**: `.github/workflows/ci.yml` roda lint, format check, typecheck, build, migrations e
  `pytest` em todo PR.

## 11. Lacunas conhecidas (backlog desta versão)

Registradas de propósito, para não fingir que já existem:

- [ ] Monitoramento de erros (Sentry ou equivalente) em produção.
- [ ] Atualização automática de dependências (Dependabot).
- [ ] Orçamento de performance medido no CI (Lighthouse).
- [ ] Testes de unidade do frontend (hoje só existe E2E).
- [ ] `backup.sql` continua no histórico do Git, embora não seja mais versionado;
      se o dump tiver dado sensível, o histórico precisa ser reescrito.
