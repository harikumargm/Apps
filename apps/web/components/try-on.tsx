"use client";

import { useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { TRYON_PRESETS } from "@/lib/tryon-models";
import { useStore } from "@/lib/store";
import type { Product, TryOnResult } from "@/lib/types";

export function TryOn({ product, initialColor }: { product: Product; initialColor?: string }) {
  const user = useStore((state) => state.user);
  const measurements = user?.measurements;
  const [color, setColor] = useState(initialColor || product.colors[0].name);
  const [height, setHeight] = useState(Number(measurements?.height_cm || 168));
  const [chest, setChest] = useState(Number(measurements?.chest_cm || 88));
  const [waist, setWaist] = useState(Number(measurements?.waist_cm || 72));
  const [hips, setHips] = useState(Number(measurements?.hips_cm || 96));
  const [consent, setConsent] = useState(false);
  const [training, setTraining] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"twin" | "photo" | "preset">("preset");
  const [presetId, setPresetId] = useState(TRYON_PRESETS[0].id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TryOnResult | null>(null);

  const resultUrl = useMemo(() => (result ? `data:${result.media_type};base64,${result.image_base64}` : ""), [result]);

  async function run() {
    setError("");
    setPending(true);
    try {
      if (mode === "preset") {
        const preset = TRYON_PRESETS.find((entry) => entry.id === presetId) ?? TRYON_PRESETS[0];
        setResult(
          await api.tryOnTwin({
            product_slug: product.slug,
            color,
            height_cm: preset.height_cm,
            chest_cm: preset.chest_cm,
            waist_cm: preset.waist_cm,
            hips_cm: preset.hips_cm,
            consent: true,
            consent_training: training,
          }),
        );
      } else if (mode === "photo") {
        if (!file) throw new ApiError(400, "Choose a full-length photograph.");
        const body = new FormData();
        body.append("photo", file);
        body.append("product_slug", product.slug);
        body.append("color", color);
        body.append("consent", "true");
        body.append("consent_training", String(training));
        body.append("height_cm", String(height));
        body.append("chest_cm", String(chest));
        body.append("waist_cm", String(waist));
        body.append("hips_cm", String(hips));
        setResult(await api.tryOnPhoto(body));
      } else {
        setResult(
          await api.tryOnTwin({
            product_slug: product.slug,
            color,
            height_cm: height,
            chest_cm: chest,
            waist_cm: waist,
            hips_cm: hips,
            consent: true,
            consent_training: training,
          }),
        );
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Trial view did not finish.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <button className={`chip ${mode === "preset" ? "active" : ""}`} onClick={() => setMode("preset")}>
          AI model
        </button>
        <button className={`chip ${mode === "twin" ? "active" : ""}`} onClick={() => setMode("twin")}>
          Your measurements
        </button>
        <button className={`chip ${mode === "photo" ? "active" : ""}`} onClick={() => setMode("photo")}>
          Your photograph
        </button>
      </div>
      {mode === "preset" && (
        <motionless className="grid gap-2 sm:grid-cols-2">
          {TRYON_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`chip text-left ${presetId === preset.id ? "active" : ""}`}
              onClick={() => {
                setPresetId(preset.id);
                setHeight(preset.height_cm);
                setChest(preset.chest_cm);
                setWaist(preset.waist_cm);
                setHips(preset.hips_cm);
              }}
            >
              {preset.label} · {preset.body_type} · {preset.skin_tone}
            </button>
          ))}
        </motionless>
      )}
      <div className="flex flex-wrap gap-2">
        {product.colors.map((entry) => (
          <button
            key={entry.name}
            className="chip"
            aria-pressed={color === entry.name}
            onClick={() => setColor(entry.name)}
          >
            <span className="mr-2 inline-block h-3 w-3" style={{ background: entry.hex }} />
            {entry.name}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Height" value={height} min={120} max={210} unit="cm" onChange={setHeight} />
        <Slider label="Chest" value={chest} min={50} max={140} unit="cm" onChange={setChest} />
        <Slider label="Waist" value={waist} min={48} max={140} unit="cm" onChange={setWaist} />
        <Slider label="Hips" value={hips} min={50} max={150} unit="cm" onChange={setHips} />
      </div>
      {mode === "photo" && (
        <label className="field">
          <span>Full-length photograph</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const next = event.target.files?.[0] || null;
              setFile(next);
              setPreview(next ? URL.createObjectURL(next) : null);
            }}
          />
        </label>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
        <span>
          I consent to processing this body image for a private preview. It is removed from the inference server when the
          preview returns, and always within 24 hours if a crash leaves a scratch file. It is not used to train public models.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-[var(--muted)]">
        <input type="checkbox" checked={training} onChange={(event) => setTraining(event.target.checked)} className="mt-1" />
        <span>Store a training preference on my account. This build still does not export imagery to a training set.</span>
      </label>
      <button className="btn btn-madder w-full sm:w-auto" disabled={!consent || pending} onClick={() => void run()}>
        {pending ? "Draping…" : "Try on AI model"}
      </button>
      {error && <p className="text-sm text-[var(--madder)]">{error}</p>}
      {pending && <div className="skeleton aspect-[4/5] w-full" />}
      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          <figure>
            <div className="art-frame">
              {mode === "photo" && preview ? (
                // Local file preview sits beside the drape. The browser holds it; the server does not.
                <img src={preview} alt="Your photograph" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center text-sm text-[var(--muted)]">
                  Proportion form from {height} cm, chest {chest} cm, waist {waist} cm, hips {hips} cm.
                </div>
              )}
            </div>
            <figcaption className="mt-2 text-sm text-[var(--muted)]">{mode === "photo" ? "Your photograph" : "Measurements"}</figcaption>
          </figure>
          <figure>
            <div className="art-frame bg-[var(--paper-2)]">
              <img src={resultUrl} alt={`${product.name} draped in trial view`} className="h-full w-full object-contain" />
            </div>
            <figcaption className="mt-2 text-sm text-[var(--muted)]">
              Draped in {Math.round(result.latency_ms)} ms · {result.physics.fold_count} folds · hem sag {result.physics.hem_sag_px}px · {result.engine}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

function motionless({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>
        {label} · {value}
        {unit}
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
