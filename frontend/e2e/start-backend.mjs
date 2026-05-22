import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = resolve(dirname(currentFile), "..", "..");
const managePy = resolve(rootDir, "backend", "manage.py");

function resolvePythonExecutable() {
  const candidates = [
    join(rootDir, ".venv_clean", "bin", "python"),
    join(rootDir, ".venv_clean", "Scripts", "python.exe"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

const python = resolvePythonExecutable();
const env = {
  ...process.env,
  USE_SQLITE: "true",
  DJANGO_ALLOWED_HOSTS: "127.0.0.1,localhost",
};

function runDjangoCommand(args) {
  const command = spawnSync(python, [managePy, ...args], {
    cwd: rootDir,
    env,
    stdio: "inherit",
  });

  if (command.status !== 0) {
    process.exit(command.status ?? 1);
  }
}

runDjangoCommand(["migrate", "--noinput"]);
runDjangoCommand(["seed_e2e", "--reset"]);

const server = spawn(python, [managePy, "runserver", "127.0.0.1:8000"], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

const terminate = () => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

process.on("SIGINT", terminate);
process.on("SIGTERM", terminate);

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
