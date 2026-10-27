"use client";

import { useId } from "react";

const SHAPES: Record<string, string[]> = {
  shirt: ["M148 108c16 24 88 24 104 0l34 18 36 62-26 16-24-46v150c-42 26-92 26-134 0V158l-24 46-26-16 36-62z"],
  kurta: ["M156 92c14 22 74 22 88 0l18 14 16 28-18 12-12-22v268c-8 28-34 40-48 40s-40-12-48-40V124l-12 22-18-12 16-28z"],
  bandhgala: ["M152 108h96l10 16 34 26-18 20-24-14v132H150V156l-24 14-18-20 34-26z"],
  trousers: ["M156 118h36l6 250h-28z", "M208 118h36l-14 250h-28z", "M156 108h88v22h-88z"],
  saree: ["M176 108c16 18 46 18 62 0l16 22-8 268c-26 18-70 18-96 0l10-268z", "M148 140l34-10 6 250-46 18z"],
  coord: ["M158 100h84v108h-84z", "M140 224h120l8 150h-136z"],
  dress: ["M168 96c12 20 52 20 64 0l28 26-18 14 34 250c-32 22-92 22-124 0l34-250-18-14z"],
  shirtdress: ["M150 100h100l22 24 24 36-18 14-16-26v268c-36 16-86 16-122 0V148l-16 26-18-14 24-36z"],
  "kids-set": ["M162 118h76l14 16 18 26-14 12-14-20v70h-84v-70l-14 20-14-12 18-26z", "M154 252h92l6 96h-104z"],
  shorts: ["M152 150h96v28l10 28-22 78h-28l-8-62h-8l-8 62h-28l-22-78 10-28z"],
  palazzo: ["M150 120h100l10 36-8 250h-40V210h-24v196h-40z"],
};

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
  const paths = SHAPES[silhouette] ?? SHAPES.shirt;
  const pattern =
    weave === "twill" ? (
      <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="var(--ink)" strokeOpacity="0.28" strokeWidth="1.4" />
      </pattern>
    ) : weave === "satin" ? (
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
    ) : (
      <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M7 0H0V7" fill="none" stroke="var(--ink)" strokeOpacity="0.22" strokeWidth="0.7" />
      </pattern>
    );

  return (
    <svg viewBox="0 0 400 520" role="img" aria-label={name} className="h-full w-full">
      <defs>{pattern}</defs>
      <rect width="400" height="520" fill="var(--art)" />
      {paths.map((path) => (
        <path key={path} d={path} fill={color} stroke="var(--ink)" strokeOpacity="0.22" strokeWidth="2" />
      ))}
      {paths.map((path) => (
        <path key={`${path}-weave`} d={path} fill={`url(#${id})`} />
      ))}
    </svg>
  );
}
