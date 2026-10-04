import { config } from "./config.js";

const origin = `http://127.0.0.1:${config.port}`;
let response;
try {
  response = await fetch(`${origin}/api/editions`, {
    headers: { Authorization: `Bearer ${config.publishKey}` },
  });
} catch {
  console.error(`Spoonspring is not answering on ${origin}. Start it with npm start, then run this again.`);
  process.exitCode = 1;
  process.exit();
}
const text = await response.text();
console.log(text);
if (!response.ok) process.exitCode = 1;
