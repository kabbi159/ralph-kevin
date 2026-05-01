/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@personabench/core", "@personabench/ui", "@personabench/analyzer"],
  // The CLI imports node-only modules (child_process, fs); ensure they are
  // not bundled for the client.
  serverExternalPackages: [
    "@personabench/cli",
    "@personabench/runner",
    "@duckdb/node-api",
    "agent-browser",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
