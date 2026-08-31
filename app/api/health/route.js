export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health - a liveness probe. Returns 200 as soon as the process
// is up. NEVER exposes secrets, connection strings, user counts or infra
// details.
export async function GET() {
  return Response.json({
    status: "ok",
    service: "futureos",
    time: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? process.env.APP_COMMIT?.slice(0, 8) ?? "dev",
  });
}
