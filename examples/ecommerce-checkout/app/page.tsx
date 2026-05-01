import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>데모 상점</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>장바구니에 한 상품이 담겨 있습니다.</p>
      <article
        style={{
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fff",
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 600 }}>무선 이어폰 Pro</div>
        <div style={{ color: "#555", fontSize: 14 }}>색상: 블랙 · 1개</div>
        <div style={{ marginTop: 8, fontWeight: 700 }}>₩49,000</div>
      </article>
      <Link
        href="/checkout"
        style={{
          display: "block",
          padding: "12px 16px",
          textAlign: "center",
          background: "#111",
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        결제하기
      </Link>
    </main>
  );
}
