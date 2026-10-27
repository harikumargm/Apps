"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api";
import { inr } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

export function AccountPanel() {
  const token = useStore((state) => state.token);
  const user = useStore((state) => state.user);
  const setAuth = useStore((state) => state.setAuth);
  const logout = useStore((state) => state.logout);
  const [mode, setMode] = useState<"login" | "register" | "phone">("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", code: "" });
  const [measure, setMeasure] = useState({
    height_cm: user?.measurements?.height_cm || 168,
    chest_cm: user?.measurements?.chest_cm || 88,
    waist_cm: user?.measurements?.waist_cm || 72,
    hips_cm: user?.measurements?.hips_cm || 96,
    preferred_fit: user?.measurements?.preferred_fit || "regular",
  });

  useEffect(() => {
    if (!token) return;
    void api.orders().then((result) => setOrders(result.orders)).catch(() => undefined);
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    try {
      if (mode === "register") {
        const result = await api.register({ name: form.name, email: form.email, password: form.password });
        setAuth(result.token, result.user);
      } else if (mode === "login") {
        const result = await api.login({ email: form.email, password: form.password });
        setAuth(result.token, result.user);
      } else if (!form.code) {
        const result = await api.requestOtp(form.phone);
        setInfo(result.demo_code ? `Demo code ${result.demo_code}. ${result.detail}` : result.detail);
      } else {
        const result = await api.verifyOtp(form.phone, form.code);
        setAuth(result.token, result.user);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign-in failed.");
    }
  }

  async function saveMeasurements(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const next = await api.saveMeasurements(measure);
      if (token) setAuth(token, next);
      setInfo("Measurements saved. Trial view and size suggestions will use them.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save measurements.");
    }
  }

  if (!user) {
    return (
      <div className="grid max-w-lg gap-5">
        <div className="flex gap-2">
          {(["login", "register", "phone"] as const).map((item) => (
            <button key={item} className={`chip capitalize ${mode === item ? "active" : ""}`} onClick={() => setMode(item)}>
              {item === "phone" ? "Phone" : item}
            </button>
          ))}
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          {mode === "register" && (
            <label className="field">
              <span>Name</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
          )}
          {mode !== "phone" && (
            <>
              <label className="field">
                <span>Email</span>
                <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </label>
              <label className="field">
                <span>Password</span>
                <input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </label>
            </>
          )}
          {mode === "phone" && (
            <>
              <label className="field">
                <span>Phone</span>
                <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+919800000000" />
              </label>
              <label className="field">
                <span>Code</span>
                <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              </label>
            </>
          )}
          {error && <p className="text-sm text-[var(--madder)]">{error}</p>}
          {info && <p className="text-sm">{info}</p>}
          <button className="btn btn-solid">{mode === "phone" && !form.code ? "Send code" : "Continue"}</button>
        </form>
        <p className="text-sm text-[var(--muted)]">
          Studio preview account: mira@sutra.test / loom-and-line. Phone demo: +919800000000. Google and Apple sign-in activate when GOOGLE_CLIENT_ID and APPLE_CLIENT_ID are set on the API; tokens are checked with Google and Apple, not accepted blindly.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Signed in</p>
        <h2 className="serif text-4xl">{user.name}</h2>
        <p className="mt-2 text-[var(--muted)]">{user.email || user.phone}</p>
        <button className="btn btn-line mt-4" onClick={logout}>
          Sign out
        </button>
        <form className="mt-8 grid gap-3" onSubmit={saveMeasurements}>
          <p className="eyebrow">Body measurements</p>
          {(["height_cm", "chest_cm", "waist_cm", "hips_cm"] as const).map((key) => (
            <label key={key} className="field">
              <span>{key.replace("_cm", "")} cm</span>
              <input
                type="number"
                value={measure[key]}
                onChange={(event) => setMeasure({ ...measure, [key]: Number(event.target.value) })}
              />
            </label>
          ))}
          <label className="field">
            <span>Preferred fit</span>
            <select value={measure.preferred_fit} onChange={(event) => setMeasure({ ...measure, preferred_fit: event.target.value })}>
              <option value="close">Close</option>
              <option value="regular">Regular</option>
              <option value="ease">Ease</option>
            </select>
          </label>
          {error && <p className="text-sm text-[var(--madder)]">{error}</p>}
          {info && <p className="text-sm">{info}</p>}
          <button className="btn btn-solid">Save measurements</button>
        </form>
      </div>
      <div>
        <p className="eyebrow">Orders</p>
        <ul className="mt-3 grid gap-3">
          {orders.length === 0 && <li className="text-[var(--muted)]">No orders yet.</li>}
          {orders.map((order) => (
            <li key={order.id} className="border border-[var(--line)] p-4">
              <Link href={`/orders/${order.id}`} className="serif text-2xl">
                {order.id}
              </Link>
              <p className="text-sm text-[var(--muted)]">
                {order.status} · {inr(order.total)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
