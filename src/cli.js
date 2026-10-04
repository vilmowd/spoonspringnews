import { config } from "./config.js";
import { initDb, shutdown } from "./db.js";
import { seed } from "./seed.js";
import { publishEdition } from "./generate.js";
import { zonedNow } from "./clock.js";

const slot = String(process.argv[2] || "morning").toLowerCase();

async function viaServer() {
  let health;
  try {
    health = await fetch(`http://127.0.0.1:${config.port}/health`, { signal: AbortSignal.timeout(1500) });
  } catch {
    return false;
  }
  if (!health.ok) return false;
  const filed = await fetch(`http://127.0.0.1:${config.port}/desk/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Spoonspring-Token": config.deskToken,
    },
    body: new URLSearchParams({ slot }),
  });
  const body = await filed.json().catch(() => ({}));
  console.log(body.message || `Desk returned ${filed.status}`);
  if (!filed.ok || body.ok === false) process.exitCode = 1;
  return true;
}

const usedServer = await viaServer();
if (!usedServer) {
  try {
    await initDb();
    await seed();
    const result = await publishEdition(slot, zonedNow().date);
    console.log(result.message);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await shutdown();
  }
}
