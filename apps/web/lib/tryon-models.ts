export type TryOnPreset = {
  id: string;
  label: string;
  height_cm: number;
  chest_cm: number;
  waist_cm: number;
  hips_cm: number;
  skin_tone: string;
  body_type: string;
};

export const TRYON_PRESETS: TryOnPreset[] = [
  { id: "m-slim-168", label: "168 cm · slim", height_cm: 168, chest_cm: 86, waist_cm: 70, hips_cm: 92, skin_tone: "medium", body_type: "slim" },
  { id: "m-athletic-178", label: "178 cm · athletic", height_cm: 178, chest_cm: 100, waist_cm: 82, hips_cm: 98, skin_tone: "deep", body_type: "athletic" },
  { id: "m-regular-172", label: "172 cm · regular", height_cm: 172, chest_cm: 96, waist_cm: 82, hips_cm: 96, skin_tone: "fair", body_type: "regular" },
  { id: "w-petite-158", label: "158 cm · petite", height_cm: 158, chest_cm: 82, waist_cm: 66, hips_cm: 90, skin_tone: "medium", body_type: "petite" },
  { id: "w-curvy-165", label: "165 cm · curvy", height_cm: 165, chest_cm: 98, waist_cm: 78, hips_cm: 104, skin_tone: "deep", body_type: "curvy" },
  { id: "w-tall-175", label: "175 cm · tall", height_cm: 175, chest_cm: 90, waist_cm: 72, hips_cm: 98, skin_tone: "fair", body_type: "tall" },
];