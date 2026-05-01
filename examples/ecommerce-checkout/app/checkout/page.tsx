"use client";

import { useState } from "react";

// Intentional UX defects (target for PersonaBench detection):
//   1. shipping fee is hidden until the user expands "배송 정보" (price uncertainty)
//   2. coupon input competes visually with the primary CTA
//   3. final CTA is disabled with no inline reason; only a vague hint above
//   4. final total uses an ambiguous "약 ~원" prefix instead of a precise number

const ITEM_PRICE = 49_000;

export default function CheckoutPage() {
  const [coupon, setCoupon] = useState("");
  const [shippingExpanded, setShippingExpanded] = useState(false);
  const [agreeRequired, setAgreeRequired] = useState(false);
  const [agreeOptional, setAgreeOptional] = useState(false);

  // Defect 4: vague total. Shipping fee included only when the user has expanded
  // the shipping panel — otherwise the displayed total is the bare item price.
  const shippingFee = shippingExpanded ? 3_000 : 0;
  const subtotal = ITEM_PRICE + shippingFee;
  const totalDisplay = `약 ${subtotal.toLocaleString("ko-KR")}원~`;

  // Defect 3: CTA disabled when required agree is missing — but no inline error.
  const canSubmit = agreeRequired;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>주문/결제</h1>

      <section
        style={{
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600 }}>무선 이어폰 Pro</div>
        <div style={{ color: "#555", fontSize: 14 }}>블랙 · 1개</div>
        <div style={{ marginTop: 8 }}>₩{ITEM_PRICE.toLocaleString("ko-KR")}</div>
      </section>

      {/* Defect 1: shipping fee hidden behind a click */}
      <section
        style={{
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setShippingExpanded((v) => !v)}
          aria-expanded={shippingExpanded}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            color: "#111",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          배송 정보 {shippingExpanded ? "▾" : "▸"}
        </button>
        {shippingExpanded ? (
          <div style={{ marginTop: 8, fontSize: 14, color: "#333" }}>
            <div>일반 배송 (3-5일 소요)</div>
            <div>배송비: ₩{(3_000).toLocaleString("ko-KR")}</div>
          </div>
        ) : null}
      </section>

      {/* Defect 2: coupon input visually competes with CTA */}
      <section
        style={{
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <label htmlFor="coupon" style={{ fontSize: 14, color: "#555" }}>
          쿠폰 코드
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            id="coupon"
            type="text"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder="예: WELCOME10"
            style={{
              flex: 1,
              padding: "12px",
              border: "1px solid #d4d4d8",
              borderRadius: 6,
              fontSize: 15,
            }}
          />
          <button
            type="button"
            style={{
              padding: "12px 16px",
              background: "#111",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            적용
          </button>
        </div>
      </section>

      <section
        style={{
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={agreeRequired}
            onChange={(e) => setAgreeRequired(e.target.checked)}
          />
          <span>주문 내용 확인 및 결제 진행에 동의합니다 (필수)</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={agreeOptional}
            onChange={(e) => setAgreeOptional(e.target.checked)}
          />
          <span>마케팅 정보 수신에 동의합니다 (선택)</span>
        </label>
      </section>

      {/* Defect 4: vague total */}
      <section
        style={{
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#555" }}>예상 합계</span>
          <strong>{totalDisplay}</strong>
        </div>
      </section>

      <button
        type="button"
        disabled={!canSubmit}
        // PersonaBench safety policy blocks payment submission anyway; this is a UI defect surface.
        data-testid="confirm-pay-button"
        style={{
          width: "100%",
          padding: "14px",
          background: canSubmit ? "#111" : "#a1a1aa",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 16,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        결제 확정
      </button>
    </main>
  );
}
