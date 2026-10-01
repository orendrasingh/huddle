// Creates random secrets once, on first `docker compose up`.
// Output lives in the `huddle-secrets` volume — never in the repo or image.
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "/secrets";
const ENV = `${DIR}/env`;
mkdirSync(DIR, { recursive: true });

const rand = (n) => randomBytes(n).toString("hex");
const b64u = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const jwt = (payload, secret) => {
  const body = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u(payload)}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
};

let env = {};
if (existsSync(ENV)) {
  for (const line of readFileSync(ENV, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1).replace(/^'|'$/g, "");
  }
  console.log("[secrets] existing secrets found — keeping them");
} else {
  const JWT_SECRET = process.env.JWT_SECRET || rand(32);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24 * 365 * 10;
  env = {
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || rand(24),
    JWT_SECRET,
    ANON_KEY: jwt({ role: "anon", iss: "supabase", iat, exp }, JWT_SECRET),
    SERVICE_ROLE_KEY: jwt({ role: "service_role", iss: "supabase", iat, exp }, JWT_SECRET),
    SECRET_KEY_BASE: rand(32),
    DB_ENC_KEY: rand(8), // realtime needs exactly 16 chars
  };
  writeFileSync(ENV, Object.entries(env).map(([k, v]) => `${k}='${v}'`).join("\n") + "\n", { mode: 0o644 });
  console.log("[secrets] generated new secrets");
}

writeFileSync(
  `${DIR}/postgrest.conf`,
  [
    `db-uri = "postgres://authenticator:${env.POSTGRES_PASSWORD}@db:5432/postgres"`,
    `db-schemas = "public,storage,graphql_public"`,
    `db-anon-role = "anon"`,
    `jwt-secret = "${env.JWT_SECRET}"`,
    `db-use-legacy-gucs = false`,
    `server-port = 3000`,
  ].join("\n") + "\n",
  { mode: 0o644 },
);
