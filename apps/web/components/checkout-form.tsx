"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { inr } from "@/lib/format";
import { useStore } from "@/lib/store";

const METHODS = [
  { id: "upi", title: "UPI", copy: "A demo intent with a upi:// link. Confirm to record the order." },
  { id: "razorpay", title: "Razorpay", copy: "Creates a demo Razorpay order id. No charge is sent." },
  { id: "stripe", title: "Stripe", copy: "Creates a demo PaymentIntent. No card is captured." },
];

export function CheckoutForm() {
  const router = useRouter();
  const items = useStore((state) => state.items);
  const user = useStore((state) => state.user);
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  const shipping = subtotal === 0 || subtotal >= 2500 ? 0 : 149;
  const [method, setMethod] = useState("upi");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    email: user?.email || "",
    name: user?.name || "",
    phone: user?.phone || "",
    line1: "",
    city: "",
    region: "",
    postal_code: "",
  });

  function set(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function place(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await api.checkout({
        email: form.email,
        method,
        address: {
          name: form.name,
          phone: form.phone,
          line1: form.line1,
          city: form.city,
          region: form.region,
          postal_code: form.postal_code,
        },
        items: items.map((item) => ({
          product_id: item.product_id,
          size: item.size,
          color: item.color,
          qty: item.qty,
        })),
      });
      const confirmed = await api.confirm(response.order.id);
      router.push(`/orders/${confirmed.order.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Checkout did not complete.");
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-[var(--muted)]">Your bag is empty.</p>;
  }

  return (
    <form className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]" onSubmit={place}>
      <div className="grid gap-4">
        <label className="field">
          <span>Email</span>
          <input required type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span>Name</span>
            <input required value={form.name} onChange={(event) => set("name", event.target.value)} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input required value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+91…" />
          </label>
        </div>
        <label className="field">
          <span>Address</span>
          <input required value={form.line1} onChange={(event) => set("line1", event.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="field">
            <span>City</span>
            <input required value={form.city} onChange={(event) => set("city", event.target.value)} />
          </label>
          <label className="field">
            <span>State</span>
            <input required value={form.region} onChange={(event) => set("region", event.target.value)} />
          </label>
          <label className="field">
            <span>PIN</span>
            <input required value={form.postal_code} onChange={(event) => set("postal_code", event.target.value)} />
          </label>
        </div>
        <fieldset className="grid gap-3">
          <legend className="eyebrow mb-2">Payment</legend>
          {METHODS.map((entry) => (
            <label key={entry.id} className="flex gap-3 border border-[var(--line)] p-4">
              <input type="radio" name="method" checked={method === entry.id} onChange={() => setMethod(entry.id)} />
              <span>
                <strong>{entry.title}</strong>
                <span className="mt-1 block text-sm text-[var(--muted)]">{entry.copy}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p className="text-sm text-[var(--madder)]">{error}</p>}
        <button className="btn btn-solid" disabled={pending}>
          {pending ? "Placing…" : `Place order · ${inr(subtotal + shipping)}`}
        </button>
      </div>
      <aside className="h-fit border border-[var(--line)] p-5">
        <h2 className="serif text-3xl">Summary</h2>
        <ul className="mt-4 grid gap-3 text-sm">
          {items.map((item) => (
            <li key={`${item.product_id}${item.size}${item.color}`} className="flex justify-between gap-3">
              <span>
                {item.name}
                <span className="block text-[var(--muted)]">
                  {item.color} / {item.size} × {item.qty}
                </span>
              </span>
              <span>{inr(item.unit_price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <hr className="rule my-4" />
        <Row label="Subtotal" value={inr(subtotal)} />
        <Row label="Shipping" value={shipping === 0 ? "Complimentary" : inr(shipping)} />
        <Row label="Total" value={inr(subtotal + shipping)} />
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}
