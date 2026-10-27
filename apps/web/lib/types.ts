export type Fiber = { fiber: string; percent: number };

export type Fabric = {
  type: string;
  composition: Fiber[];
  weave: string;
  weight: string;
  gsm: number;
  stretch_index: number;
  care: string[];
  ai_verified: boolean;
  confidence: number;
  engine: string;
  mill_note: string;
};

export type Colorway = { name: string; hex: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  edition: string;
  departments: string[];
  audience: string;
  occasion: string;
  price: number;
  mrp?: number;
  rating?: number;
  reviews?: number;
  silhouette: string;
  image?: string;
  summary: string;
  story: string;
  colors: Colorway[];
  sizes: string[];
  featured: boolean;
  fabric: Fabric;
  inventory: Record<string, number>;
  stock?: Record<string, number>;
  suggested_size?: string | null;
};

export type Catalog = {
  brand: string;
  currency: string;
  shipping_free_above: number;
  shipping_fee: number;
  products: Product[];
};

export type CartLine = {
  product_id: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  hex: string;
  silhouette: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type Cart = {
  items: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  free_shipping_above: number;
  version: number;
  updated_at?: string;
};

export type Measurements = {
  height_cm: number;
  chest_cm: number;
  waist_cm: number;
  hips_cm: number;
  preferred_fit?: string;
  size?: string | null;
};

export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  oauth_provider: string | null;
  measurements: Partial<Measurements>;
  consent_training: boolean;
};

export type Order = {
  id: string;
  email: string;
  items: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_ref: string;
  payment: Record<string, string | number>;
  address: Record<string, string>;
  timeline: { status: string; at: string; label: string }[];
  created_at: string;
};

export type FabricReading = {
  engine: string;
  fabric_type: string;
  composition: Fiber[];
  weave: string;
  weight: string;
  gsm_range: number[];
  stretch_index: number;
  elasticity: string;
  care: string[];
  confidence: number;
  disclaimer: string;
};

export type TryOnResult = {
  engine: string;
  mode: string;
  media_type: string;
  image_base64: string;
  width: number;
  height: number;
  latency_ms: number;
  within_budget: boolean;
  stages: { garment_parser_ms: number; pose_estimator_ms: number; renderer_ms: number };
  physics: { fold_count: number; hem_sag_px: number; ease: number; weight: string; model: string };
  privacy: { inference_retained: boolean; purge_within_hours: number; used_for_training: boolean; training_note: string };
};
