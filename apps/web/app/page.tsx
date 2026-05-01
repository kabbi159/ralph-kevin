export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "64px 24px",
      }}
    >
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>PersonaBench</h1>
      <p style={{ color: "#a1a1aa", marginBottom: 32 }}>
        Data-grounded persona UX testing — local-first.
      </p>
      <section
        style={{
          padding: 24,
          border: "1px solid #27272a",
          borderRadius: 8,
          background: "#111114",
        }}
      >
        <h2 style={{ fontSize: 20, marginTop: 0 }}>Recent runs</h2>
        <p style={{ color: "#71717a" }}>
          No runs yet. Use <code>personabench run</code> from the CLI, or wait for the runner API to
          be wired up in Phase 8.
        </p>
      </section>
    </main>
  );
}
