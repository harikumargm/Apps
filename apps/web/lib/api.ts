"use client";

import { useStore } from "./store";
import type { Cart, FabricReading, Order, TryOnResult, User } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sessionId(): string {
  const existing = useStore.getState().sessionId || localStorage.getItem("sutra-session") || "";
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("sutra-session", created);
  useStore.getState().setSessionId(created);
  return created;
}

export function ensureSession(): string {
  const id = sessionId();
  if (!useStore.getState().sessionId) useStore.getState().setSessionId(id);
  localStorage.setItem("sutra-session", id);
  return id;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useStore.getState().token;
  const headers = new Headers(init.headers);
  headers.set("X-Session-Id", ensureSession());
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`/api${path}`, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "The studio could not complete that.";
    throw new ApiError(response.status, detail);
  }
  return data as T;
}

export const api = {
  cart: () => request<Cart>("/v1/cart"),
  saveCart: (items: { product_id: string; size: string; color: string; qty: number }[]) =>
    request<Cart>("/v1/cart", { method: "PUT", body: JSON.stringify({ items }) }),
  register: (body: { name: string; email: string; password: string }) =>
    request<{ token: string; user: User }>("/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),
  requestOtp: (phone: string) =>
    request<{ demo_code?: string; detail: string }>("/v1/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: User }>("/v1/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  saveMeasurements: (body: unknown) => request<User>("/v1/me/measurements", { method: "PATCH", body: JSON.stringify(body) }),
  orders: () => request<{ orders: Order[] }>("/v1/orders"),
  order: (id: string) => request<{ order: Order }>(`/v1/orders/${id}`),
  checkout: (body: unknown) => request<{ order: Order; payment: Record<string, string | number> }>("/v1/checkout", { method: "POST", body: JSON.stringify(body) }),
  confirm: (id: string) => request<{ order: Order }>(`/v1/orders/${id}/confirm`, { method: "POST", body: "{}" }),
  analyze: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{ reading: FabricReading }>("/v1/fabric/analyze", { method: "POST", body });
  },
  tryOnTwin: (body: unknown) => request<TryOnResult>("/v1/tryon/twin", { method: "POST", body: JSON.stringify(body) }),
  tryOnPhoto: (body: FormData) => request<TryOnResult>("/v1/tryon/photo", { method: "POST", body }),
};
