"use client";

import { useId } from "react";

function tone(hex: string, amount: number) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
  const value = Number.parseInt(full, 16);
  const channel = (shift: number) => Math.max(0, Math.min(255, ((value >> shift) & 255) + amount));
  return `#${[channel(16), channel(8), channel(0)].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

export function GarmentArt({
  silhouette,
  color,
  weave,
  name,
}: {
  silhouette: string;
  color: string;
  weave: string;
  name: string;
}) {
  const id = useId().replace(/:/g, "");
  const deep = tone(color, -28);
  const lift = tone(color, 22);
  const seam = tone(color, -48);

  return (
    <svg viewBox="0 0 400 520" role="img" aria-label={name} className="h-full w-full">
      <defs>
        <radialGradient id={`${id}-studio`} cx="50%" cy="38%" r="68%">
          <stop offset="0%" stopColor="var(--studio)" />
          <stop offset="100%" stopColor="var(--art)" />
        </radialGradient>
        <pattern id={`${id}-weave`} width={weave === "twill" ? 9 : 6} height={weave === "twill" ? 9 : 6} patternUnits="userSpaceOnUse" patternTransform={weave === "twill" ? "rotate(36)" : undefined}>
          {weave === "satin" ? (
            <rect width="6" height="6" fill="#fff" fillOpacity="0.16" />
          ) : (
            <path d="M0 0 H6 M0 0 V6" fill="none" stroke={seam} strokeOpacity="0.35" strokeWidth="0.6" />
          )}
        </pattern>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={weave === "satin" ? 0.28 : 0.08} />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <rect width="400" height="520" fill={`url(#${id}-studio)`} />
      <ellipse cx="200" cy="470" rx="92" ry="12" fill="#000" opacity="0.08" />
      <g>
        <Cloth silhouette={silhouette} color={color} deep={deep} lift={lift} seam={seam} />
        <g fill={`url(#${id}-weave)`} opacity="0.55">
          <Cloth silhouette={silhouette} color="transparent" deep="transparent" lift="transparent" seam="transparent" clothOnly />
        </g>
        <g fill={`url(#${id}-sheen)`}>
          <Cloth silhouette={silhouette} color="transparent" deep="transparent" lift="transparent" seam="transparent" clothOnly />
        </g>
      </g>
    </svg>
  );
}

function Cloth({
  silhouette,
  color,
  deep,
  lift,
  seam,
  clothOnly = false,
}: {
  silhouette: string;
  color: string;
  deep: string;
  lift: string;
  seam: string;
  clothOnly?: boolean;
}) {
  if (silhouette === "kurta" || silhouette === "kids-set") return <Kurta color={color} deep={deep} lift={lift} seam={seam} small={silhouette === "kids-set"} clothOnly={clothOnly} />;
  if (silhouette === "saree") return <Saree color={color} deep={deep} lift={lift} seam={seam} clothOnly={clothOnly} />;
  if (silhouette === "dress") return <Slip color={color} deep={deep} seam={seam} clothOnly={clothOnly} />;
  if (silhouette === "shirtdress") return <Shirt color={color} deep={deep} lift={lift} seam={seam} long clothOnly={clothOnly} />;
  if (silhouette === "bandhgala") return <Bandhgala color={color} deep={deep} lift={lift} seam={seam} clothOnly={clothOnly} />;
  if (silhouette === "trousers" || silhouette === "shorts") return <Trousers color={color} deep={deep} seam={seam} short={silhouette === "shorts"} clothOnly={clothOnly} />;
  if (silhouette === "palazzo") return <Trousers color={color} deep={deep} seam={seam} wide clothOnly={clothOnly} />;
  if (silhouette === "coord") return <Coord color={color} deep={deep} lift={lift} seam={seam} clothOnly={clothOnly} />;
  return <Shirt color={color} deep={deep} lift={lift} seam={seam} clothOnly={clothOnly} />;
}

function Shirt({
  color,
  deep,
  lift,
  seam,
  long = false,
  clothOnly = false,
}: {
  color: string;
  deep: string;
  lift: string;
  seam: string;
  long?: boolean;
  clothOnly?: boolean;
}) {
  return (
    <g>
      <path
        fill={color}
        stroke={seam}
        strokeWidth="1.3"
        strokeLinejoin="round"
        d={`M158 138c14 24 70 24 84 0l16 12 44 46-22 16-26-32v${long ? 250 : 148}c-34 20-84 20-118 0V180l-26 32-22-16 44-46z`}
      />
      {!clothOnly && (
        <>
          <path d="M168 136c10 18 54 20 64 0-8 10-56 10-64 0z" fill={deep} />
          <path d="M186 148h28l-6 22h-16z" fill={lift} />
          <path d={`M200 168 v${long ? 210 : 128}`} stroke={seam} strokeWidth="1.4" fill="none" />
          {[0, 1, 2, 3, 4].map((index) => (
            <circle key={index} cx="200" cy={188 + index * 28} r="2.4" fill={seam} />
          ))}
          <path d="M164 196h28v24h-28z" fill="none" stroke={seam} strokeWidth="1.2" />
        </>
      )}
    </g>
  );
}

function Kurta({
  color,
  deep,
  lift,
  seam,
  small,
  clothOnly,
}: {
  color: string;
  deep: string;
  lift: string;
  seam: string;
  small?: boolean;
  clothOnly?: boolean;
}) {
  return (
    <g transform={small ? "translate(28 36) scale(0.86)" : undefined}>
      <path fill={color} stroke={seam} strokeWidth="1.3" strokeLinejoin="round" d="M158 124c14 22 70 22 84 0l14 8 20 30-16 12-14-22v268c-26 18-68 18-94 0V152l-14 22-16-12 20-30z" />
      {!clothOnly && (
        <>
          <path d="M176 124h48v16c-8 8-32 8-48 0z" fill={deep} />
          <path d="M196 140h8v18h-8z" fill={lift} />
          <path d="M200 158 v220" stroke={seam} strokeWidth="1.3" />
          {[0, 1, 2, 3, 4].map((index) => (
            <circle key={index} cx="200" cy={176 + index * 32} r="2.2" fill={seam} />
          ))}
          <path d="M172 390 v28 M228 390 v28" stroke={seam} strokeWidth="1.2" fill="none" />
        </>
      )}
    </g>
  );
}

function Saree({ color, deep, lift, seam, clothOnly }: { color: string; deep: string; lift: string; seam: string; clothOnly?: boolean }) {
  return (
    <g>
      <path d="M168 214c8-18 56-18 64 0l18 250c-28 18-72 18-100 0z" fill={color} />
      <path d="M214 132c22 8 48 36 36 92 18 40 8 120-6 196l-28-6c10-70 8-130-8-160-6-28-4-70 6-122z" fill={deep} />
      <path d="M176 150c12 16 40 16 52 0l8 18-14 8c-8 16-32 16-40 0l-14-8z" fill={color} />
      {!clothOnly && (
        <>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <path key={index} d={`M${178 + index * 10} 230 v210`} stroke={seam} strokeOpacity="0.45" strokeWidth="1" />
          ))}
          <path d="M230 168c20 24 22 70 8 120" fill="none" stroke={lift} strokeWidth="6" strokeLinecap="round" opacity="0.45" />
        </>
      )}
    </g>
  );
}

function Slip({ color, deep, seam, clothOnly }: { color: string; deep: string; seam: string; clothOnly?: boolean }) {
  return (
    <g>
      <path d="M176 118c8 16 40 16 48 0l34 36-16 10 28 292c-30 20-78 20-108 0l28-292-16-10z" fill={color} />
      {!clothOnly && (
        <>
          <path d="M184 122c6 10 26 10 32 0" fill="none" stroke={deep} strokeWidth="3" />
          <path d="M200 160c-18 40-18 90 0 250M200 160c18 40 18 90 0 250" fill="none" stroke={seam} strokeOpacity="0.4" />
        </>
      )}
    </g>
  );
}

function Bandhgala({ color, deep, lift, seam, clothOnly }: { color: string; deep: string; lift: string; seam: string; clothOnly?: boolean }) {
  return (
    <g>
      <path d="M146 150h108l8 18 40 28-16 20-30-16v156H144V200l-30 16-16-20 40-28z" fill={color} />
      {!clothOnly && (
        <>
          <path d="M170 150h60v28c-10 10-40 10-60 0z" fill={deep} />
          <path d="M196 164h8v16h-8z" fill={lift} />
          <path d="M200 178v150" stroke={seam} strokeWidth="1.3" />
          {[0, 1, 2, 3, 4].map((index) => (
            <circle key={index} cx="200" cy={196 + index * 26} r="2.3" fill={seam} />
          ))}
          <path d="M158 196c16 10 20 24 8 36M242 196c-16 10-20 24-8 36" fill="none" stroke={seam} strokeOpacity="0.6" />
        </>
      )}
    </g>
  );
}

function Trousers({
  color,
  deep,
  seam,
  short,
  wide,
  clothOnly,
}: {
  color: string;
  deep: string;
  seam: string;
  short?: boolean;
  wide?: boolean;
  clothOnly?: boolean;
}) {
  const hem = short ? 310 : 458;
  const inset = wide ? 118 : 146;
  const inner = wide ? 196 : 188;
  return (
    <g>
      <path d={`M${inset} 158 h${400 - inset * 2} v26 h-${400 - inset * 2} z`} fill={deep} />
      <path d={`M${inset + 4} 184 h${inner - inset - 8} l8 16 l-10 ${hem - 200} h-36 z`} fill={color} />
      <path d={`M${inner + 8} 184 h${400 - inset - inner - 12} l10 ${hem - 184} h-36 l-8 ${200 - hem} z`} fill={color} />
      {!clothOnly && (
        <>
          <path d={`M${inset + 28} 206 v${hem - 230} M${400 - inset - 28} 206 v${hem - 230}`} stroke={seam} strokeOpacity="0.4" />
          <path d={`M${200 - 28} 170 h56`} stroke={seam} strokeWidth="1.4" />
        </>
      )}
    </g>
  );
}

function Coord({ color, deep, lift, seam, clothOnly }: { color: string; deep: string; lift: string; seam: string; clothOnly?: boolean }) {
  return (
    <g>
      <Shirt color={color} deep={deep} lift={lift} seam={seam} clothOnly={clothOnly} />
      <g transform="translate(0 168) scale(1 0.72)">
        <Trousers color={color} deep={deep} seam={seam} wide clothOnly={clothOnly} />
      </g>
    </g>
  );
}
