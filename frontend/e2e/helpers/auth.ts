import { expect, type Page } from "@playwright/test";

type SessionRole = "ADMIN" | "COMMON";

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function buildMockUser(role: SessionRole) {
  if (role === "ADMIN") {
    return {
      id: "admin-id",
      username: "admin",
      email: "admin@pelada.local",
      display_name: "Administrador",
      role: "ADMIN",
      linked_player: null,
    };
  }
  return {
    id: "common-id",
    username: "jogador",
    email: "jogador@pelada.local",
    display_name: "Jogador Comum",
    role: "COMMON",
    linked_player: "player-1",
  };
}

export async function mockApiSession(page: Page, role: SessionRole) {
  const user = buildMockUser(role);
  const token = role === "ADMIN" ? "token-admin" : "token-common";
  const players = [
    {
      id: "player-1",
      full_name: "Rafael Silva",
      nickname: "Rafa",
      player_type: "MEMBER",
      preferred_position: "MIDFIELDER",
      dominant_foot: "RIGHT",
      monthly_fee_amount: "70.00",
      shirt_number: 10,
      email: "",
      phone_number: "",
      joined_on: "2025-01-01",
      is_active: true,
      notes: "",
      overall: 79,
      attack: 78,
      defense: 72,
      speed: 77,
      dribble: 80,
      tackle: 70,
      passing: 81,
      stamina: 74,
      shooting: 73,
      goalkeeping: 20,
    },
  ];

  const transactions: Array<Record<string, unknown>> = [
    {
      id: "tx-1",
      direction: "INFLOW",
      category: "MONTHLY_FEE",
      status: "POSTED",
      amount: "70.00",
      description: "Mensalidade Rafael",
      occurred_on: "2026-04-01",
      reference_month: "2026-04-01",
      related_player: "player-1",
      related_player_name: "Rafael Silva",
      notes: "",
      match: null,
    },
    {
      id: "tx-2",
      direction: "OUTFLOW",
      category: "FIELD_RENT",
      status: "POSTED",
      amount: "120.00",
      description: "Aluguel do campo",
      occurred_on: "2026-04-02",
      reference_month: null,
      related_player: null,
      related_player_name: null,
      notes: "",
      match: null,
    },
  ];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/auth/login/" && method === "POST") {
      await route.fulfill(jsonResponse({ token, user }));
      return;
    }
    if (path === "/api/auth/me/" && method === "GET") {
      await route.fulfill(jsonResponse(user));
      return;
    }
    if (path === "/api/auth/logout/" && method === "POST") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/api/dashboard/financial-summary/" && method === "GET") {
      await route.fulfill(
        jsonResponse({
          current_balance: "-50.00",
          inflow_total: "70.00",
          outflow_total: "120.00",
          pending_total: "0.00",
        }),
      );
      return;
    }
    if (path === "/api/transactions/" && method === "GET") {
      await route.fulfill(jsonResponse(transactions));
      return;
    }
    if (path === "/api/transactions/" && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      transactions.unshift({
        id: `tx-${transactions.length + 1}`,
        direction: body.direction,
        category: body.category,
        status: body.status,
        amount: String(body.amount ?? "0.00"),
        description: String(body.description ?? "Novo lancamento"),
        occurred_on: String(body.occurred_on ?? "2026-04-10"),
        reference_month: body.reference_month ?? null,
        related_player: body.related_player ?? null,
        related_player_name: "Rafael Silva",
        notes: String(body.notes ?? ""),
        match: null,
      });
      await route.fulfill(jsonResponse(transactions[0], 201));
      return;
    }
    if (path === "/api/players/" && method === "GET") {
      await route.fulfill(jsonResponse(players));
      return;
    }
    if (path === "/api/matches/current/" && method === "GET") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/api/matches/" && method === "GET") {
      await route.fulfill(jsonResponse([]));
      return;
    }
    if (path === "/api/portal/me/overview/" && method === "GET") {
      await route.fulfill(
        jsonResponse({
          user,
          linked_player: players[0],
          financial_status: {
            reference_month: "2026-04",
            expected_monthly_fee: "70.00",
            paid_amount: "70.00",
            pending_amount: "0.00",
            outstanding_amount: "0.00",
            is_adimplente: true,
          },
          attendance_status: {
            confirmed_count: 8,
            pending_count: 1,
            declined_count: 1,
            total_count: 10,
          },
          recent_attendance: [
            {
              match_id: "match-1",
              scheduled_at: "2026-04-06T20:00:00Z",
              match_status: "ARCHIVED",
              attendance_status: "CONFIRMED",
              assigned_team_name: "Time Roxo",
            },
          ],
          upcoming_matches: [
            {
              match_id: "match-2",
              scheduled_at: "2026-04-13T20:00:00Z",
              location: "Arena Central",
              status: "OPEN",
              expected_team_count: 2,
              attendance_status: "CONFIRMED",
            },
          ],
        }),
      );
      return;
    }

    await route.fulfill(
      jsonResponse({ detail: `Endpoint mockado ausente: ${method} ${path}` }, 404),
    );
  });
}

export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Usuário ou celular").fill(identifier);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function expectOnDashboard(page: Page) {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Dashboard Financeiro")).toBeVisible();
}

export async function expectOnPortal(page: Page) {
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Portal do Jogador")).toBeVisible();
}
