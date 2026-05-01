import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/runs/[runId]/artifacts/[...path] — stream a file from
// .personabench/runs/<runId>/<path> with a path-traversal guard so the
// route can't be tricked into serving arbitrary disk files. Used by
// /runs/[runId] to render screenshots, trace.zip, etc., inside the
// browser without exposing the absolute filesystem path.

const RUNS_ROOT = resolve(process.cwd(), "..", "..", ".personabench", "runs");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ndjson": "application/x-ndjson; charset=utf-8",
};

const guessType = (path: string): string => {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  return CONTENT_TYPES[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string; path: string[] }> },
): Promise<NextResponse> {
  const { runId, path } = await params;
  const safeRunId = runId.replace(/[^a-z0-9_-]/gi, "");
  if (safeRunId !== runId) {
    return NextResponse.json({ error: "invalid runId" }, { status: 400 });
  }
  const rel = path.join("/");
  const target = normalize(join(RUNS_ROOT, safeRunId, rel));
  const runRoot = normalize(join(RUNS_ROOT, safeRunId));
  if (!target.startsWith(`${runRoot}/`) && target !== runRoot) {
    return NextResponse.json({ error: "path traversal blocked" }, { status: 400 });
  }
  if (!existsSync(target)) {
    return NextResponse.json({ error: "not found", path: rel }, { status: 404 });
  }
  const buf = readFileSync(target);
  const arr = new Uint8Array(buf.byteLength);
  arr.set(buf);
  return new NextResponse(arr, {
    headers: {
      "content-type": guessType(target),
      "cache-control": "no-cache",
    },
  });
}
