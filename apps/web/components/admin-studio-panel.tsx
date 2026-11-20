"use client";

import {
  Check,
  Copy,
  Cpu,
  Eye,
  Image as ImageIcon,
  Layers,
  ShoppingBag,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
  Wand2,
} from "lucide-react";
import { useRef, useState } from "react";

export const STUDIO_PRESETS = [
  {
    id: "ghost-mannequin",
    label: "Ghost mannequin (3D clean)",
    desc: "Remove hangers, tags, and wrinkles on pure #FFFFFF studio backdrop",
    badge: "Catalog standard",
  },
  {
    id: "flat-lay",
    label: "Minimalist linen flat-lay",
    desc: "Natural sunlight shadows highlighting cotton weave and GSM texture",
    badge: "Instagram / lookbook",
  },
  {
    id: "ai-model-drape",
    label: "AI model studio drape",
    desc: "Garment on editorial model in warm studio light",
    badge: "High conversion",
  },
  {
    id: "macro-fabric",
    label: "100% cotton weave macro",
    desc: "Close fibre detail inset for product gallery slide #4",
    badge: "Trust badge",
  },
] as const;

const PRESET_OUTPUTS: Record<string, string> = {
  "ghost-mannequin":
    "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=85",
  "flat-lay":
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=85",
  "ai-model-drape":
    "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=600&q=85",
  "macro-fabric":
    "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=600&q=85",
};

export type CatalogSection =
  | "catalog_grid"
  | "combo_offers"
  | "home_looks"
  | "pdp_gallery"
  | "lookbook";

export const STORE_SECTION_OPTIONS: { id: CatalogSection; label: string; hint: string }[] = [
  { id: "catalog_grid", label: "Men / Women catalog grid", hint: "Primary card on /catalog" },
  { id: "combo_offers", label: "Combo offers collection", hint: "Tags SKU for /catalog/combo-offers" },
  { id: "home_looks", label: "Homepage editorial row", hint: "Hero looks on /" },
  { id: "pdp_gallery", label: "PDP gallery slide", hint: "Extra angle on product page" },
  { id: "lookbook", label: "Lookbook / Instagram", hint: "Lookbook strip on PDP" },
];

export type StudioCatalogProduct = {
  id: string;
  slug: string;
  name: string;
  audience: string;
};

export type PublishedTo = {
  productId: string;
  productName: string;
  section: CatalogSection;
  sectionLabel: string;
  storefrontPath: string;
};

export type GeneratedDisplay = {
  id: string;
  presetLabel: string;
  engine: string;
  timestamp: string;
  imageUrl: string;
  promptUsed: string;
  publishedTo?: PublishedTo;
};

type CleanOptions = {
  removeHangerAndTags: boolean;
  steamWrinkles: boolean;
  enhanceCottonTexture: boolean;
  pureWhiteBg: boolean;
};

type AdminStudioPanelProps = {
  defaultSource: string;
  adminToken: string;
  catalogProducts: StudioCatalogProduct[];
};

export function AdminStudioPanel({ defaultSource, adminToken, catalogProducts }: AdminStudioPanelProps) {
  const studioFileInputRef = useRef<HTMLInputElement>(null);
  const [studioSourceImage, setStudioSourceImage] = useState(defaultSource);
  const [selectedPreset, setSelectedPreset] = useState<(typeof STUDIO_PRESETS)[number]["id"]>("ghost-mannequin");
  const [aiEngine, setAiEngine] = useState<"gemini-2.5-flash-image" | "cursor-batch-pipeline">("gemini-2.5-flash-image");
  const [cleanOptions, setCleanOptions] = useState<CleanOptions>({
    removeHangerAndTags: true,
    steamWrinkles: true,
    enhanceCottonTexture: true,
    pureWhiteBg: true,
  });
  const [customDirectorPrompt, setCustomDirectorPrompt] = useState(
    "Preserve exact cotton jersey weave, remove hanger and price tag, soft diffused studio key light.",
  );
  const [isGeneratingDisplay, setIsGeneratingDisplay] = useState(false);
  const [copiedCursorSnippet, setCopiedCursorSnippet] = useState(false);
  const [generatedOutputs, setGeneratedOutputs] = useState<GeneratedDisplay[]>([
    {
      id: "GEN-101",
      presetLabel: "Ghost mannequin (3D clean)",
      engine: "Gemini vision + image gen",
      timestamp: "Sample",
      imageUrl: PRESET_OUTPUTS["ghost-mannequin"],
      promptUsed: "Ghost mannequin, #FFFFFF backdrop, cotton weave preserved",
    },
  ]);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishDraft, setPublishDraft] = useState<
    Record<string, { productId: string; section: CatalogSection }>
  >({});
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);

  function handleGenerateStudioDisplay() {
    setIsGeneratingDisplay(true);
    const activePreset = STUDIO_PRESETS.find((p) => p.id === selectedPreset);
    window.setTimeout(() => {
      const newAsset: GeneratedDisplay = {
        id: `GEN-${Math.floor(200 + Math.random() * 799)}`,
        presetLabel: activePreset?.label ?? "Studio display",
        engine: aiEngine === "gemini-2.5-flash-image" ? "Gemini vision + image gen" : "Cursor automation pipeline",
        timestamp: "Just now",
        imageUrl: PRESET_OUTPUTS[selectedPreset] ?? studioSourceImage,
        promptUsed: customDirectorPrompt,
      };
      setGeneratedOutputs((prev) => [newAsset, ...prev]);
      setIsGeneratingDisplay(false);
    }, 1800);
  }

  function copyCursorPromptSnippet() {
    const snippet = `// Cursor + Gemini e-commerce display generator
const response = await gemini.models.generateImage({
  model: "gemini-2.5-flash-image",
  referenceImage: uploadedRawGarmentBase64,
  prompt: "Transform raw garment into ${selectedPreset} studio shot. ${
    cleanOptions.removeHangerAndTags ? "Remove hangers, tags, clutter. " : ""
  }${cleanOptions.steamWrinkles ? "Smooth creases, keep authentic cotton weave. " : ""}${customDirectorPrompt}"
});`;
    void navigator.clipboard.writeText(snippet);
    setCopiedCursorSnippet(true);
    window.setTimeout(() => setCopiedCursorSnippet(false), 2500);
  }

  function removeOutput(id: string) {
    setGeneratedOutputs((prev) => prev.filter((item) => item.id !== id));
    setPublishDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function draftFor(assetId: string) {
    const existing = publishDraft[assetId];
    if (existing) return existing;
    const first = catalogProducts[0];
    return {
      productId: first?.id ?? "",
      section: "catalog_grid" as CatalogSection,
    };
  }

  async function publishToStore(asset: GeneratedDisplay) {
    if (!adminToken) {
      setStudioError("Enter a valid admin token on the dashboard first.");
      return;
    }
    const draft = draftFor(asset.id);
    if (!draft.productId) {
      setStudioError("Choose a catalog product.");
      return;
    }
    setPublishingId(asset.id);
    setStudioError(null);
  setStudioNotice(null);
    try {
      const response = await fetch("/api/v1/admin/catalog/publish-studio-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
        },
        body: JSON.stringify({
          product_id: draft.productId,
          image_url: asset.imageUrl,
          section: draft.section,
          studio_output_id: asset.id,
          preset_label: asset.presetLabel,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.detail === "string" ? payload.detail : "Could not publish to catalog.");
      }
      const product = catalogProducts.find((p) => p.id === draft.productId);
      const sectionLabel = STORE_SECTION_OPTIONS.find((s) => s.id === draft.section)?.label ?? draft.section;
      setGeneratedOutputs((prev) =>
        prev.map((item) =>
          item.id === asset.id
            ? {
                ...item,
                publishedTo: {
                  productId: draft.productId,
                  productName: product?.name ?? draft.productId,
                  section: draft.section,
                  sectionLabel,
                  storefrontPath: payload.storefront_paths ?? "/catalog",
                },
              }
            : item,
        ),
      );
      setStudioNotice(`Live on store: ${product?.name ?? draft.productId} · ${sectionLabel}`);
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {studioNotice ? (
        <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{studioNotice}</p>
      ) : null}
      {studioError ? (
        <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{studioError}</p>
      ) : null}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-violet-600" />
              E-commerce product display studio
            </h3>
            <p className="text-xs text-slate-500 mt-1">Gemini vision + Cursor pipeline · publish outputs into storefront sections</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyCursorPromptSnippet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedCursorSnippet ? "Copied" : "Copy Cursor prompt"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 aspect-[3/4]">
              <img src={studioSourceImage} alt="Source garment" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => studioFileInputRef.current?.click()}
                className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-white/95 text-xs font-semibold shadow"
              >
                Replace source
              </button>
              <input
                ref={studioFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setStudioSourceImage(URL.createObjectURL(file));
                }}
              />
            </div>
            <label className="grid gap-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <Cpu className="w-3.5 h-3.5" /> AI engine
              </span>
              <select
                value={aiEngine}
                onChange={(e) => setAiEngine(e.target.value as typeof aiEngine)}
                className="h-10 rounded-lg border border-slate-200 px-2 text-sm"
              >
                <option value="gemini-2.5-flash-image">Gemini 2.5 flash image</option>
                <option value="cursor-batch-pipeline">Cursor batch pipeline</option>
              </select>
            </label>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Studio presets
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {STUDIO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`text-left rounded-xl border p-3 transition ${
                    selectedPreset === preset.id
                      ? "border-violet-500 bg-violet-50 ring-1 ring-violet-200"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{preset.label}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{preset.desc}</p>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-3">
                <Sliders className="w-3.5 h-3.5" /> Clean & enhance
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                {(
                  [
                    ["removeHangerAndTags", "Remove hanger & tags"],
                    ["steamWrinkles", "Steam wrinkles"],
                    ["enhanceCottonTexture", "Enhance cotton texture"],
                    ["pureWhiteBg", "Pure white (#FFFFFF) bg"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cleanOptions[key]}
                      onChange={(e) => setCleanOptions((o) => ({ ...o, [key]: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <label className="grid gap-1 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <Terminal className="w-3.5 h-3.5" /> Director prompt
              </span>
              <textarea
                value={customDirectorPrompt}
                onChange={(e) => setCustomDirectorPrompt(e.target.value)}
                rows={3}
                className="text-sm border border-slate-200 rounded-lg p-2 w-full"
              />
            </label>

            <button
              type="button"
              disabled={isGeneratingDisplay}
              onClick={handleGenerateStudioDisplay}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-60"
            >
              {isGeneratingDisplay ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Generating display…
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  Generate studio display
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h4 className="font-bold flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-600" />
            Generated outputs
          </h4>
          <p className="text-xs text-slate-500">Remove local previews or push into a storefront section</p>
        </div>
        {generatedOutputs.length === 0 ? (
          <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-8 text-center">
            No studio outputs yet. Generate a display to publish it on the store.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {generatedOutputs.map((asset) => {
              const draft = draftFor(asset.id);
              return (
                <figure key={asset.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                  <div className="relative">
                    <img src={asset.imageUrl} alt={asset.presetLabel} className="w-full aspect-[3/4] object-cover" />
                    <button
                      type="button"
                      aria-label="Remove output"
                      onClick={() => removeOutput(asset.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/95 text-slate-700 hover:bg-red-50 hover:text-red-700 shadow"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {asset.publishedTo ? (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold uppercase">
                        <Check className="w-3 h-3" /> Live
                      </span>
                    ) : null}
                  </div>
                  <figcaption className="p-3 text-xs space-y-2 flex-1 flex flex-col">
                    <p className="font-bold text-slate-900">{asset.presetLabel}</p>
                    <p className="text-slate-500">
                      {asset.engine} · {asset.timestamp}
                    </p>
                    <p className="text-slate-600 line-clamp-2">{asset.promptUsed}</p>
                    {asset.publishedTo ? (
                      <p className="text-emerald-700 font-semibold">
                        {asset.publishedTo.productName} · {asset.publishedTo.sectionLabel}
                        <a className="block text-[10px] text-emerald-600 underline mt-0.5" href={asset.publishedTo.storefrontPath} target="_blank" rel="noreferrer">
                          View on storefront
                        </a>
                      </p>
                    ) : (
                      <div className="mt-auto space-y-2 pt-2 border-t border-slate-200">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Catalog product</span>
                          <select
                            value={draft.productId}
                            onChange={(e) =>
                              setPublishDraft((prev) => ({
                                ...prev,
                                [asset.id]: { ...draftFor(asset.id), productId: e.target.value },
                              }))
                            }
                            className="h-9 rounded-lg border border-slate-200 px-2 text-xs w-full"
                          >
                            {catalogProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.audience})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Store section</span>
                          <select
                            value={draft.section}
                            onChange={(e) =>
                              setPublishDraft((prev) => ({
                                ...prev,
                                [asset.id]: {
                                  ...draftFor(asset.id),
                                  section: e.target.value as CatalogSection,
                                },
                              }))
                            }
                            className="h-9 rounded-lg border border-slate-200 px-2 text-xs w-full"
                          >
                            {STORE_SECTION_OPTIONS.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.label}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-slate-400">
                            {STORE_SECTION_OPTIONS.find((s) => s.id === draft.section)?.hint}
                          </span>
                        </label>
                        <button
                          type="button"
                          disabled={publishingId === asset.id}
                          onClick={() => void publishToStore(asset)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {publishingId === asset.id ? "Publishing…" : "Add to store catalog"}
                        </button>
                      </div>
                    )}
                    <p className="font-mono text-[10px] text-slate-400">{asset.id}</p>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}