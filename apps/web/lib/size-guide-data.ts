export type SizeRow = {
  size: string;
  chest: string;
  waist: string;
  hip: string;
  length: string;
};

/** Finished garment inches. Cotton knits: plan ~3% length shrink after first cold wash. */
export const MEN_TOPS: SizeRow[] = [
  { size: "XS", chest: '34–36"', waist: '28–30"', hip: '36–38"', length: '26"' },
  { size: "S", chest: '36–38"', waist: '30–32"', hip: '38–40"', length: '27"' },
  { size: "M", chest: '38–40"', waist: '32–34"', hip: '40–42"', length: '28"' },
  { size: "L", chest: '40–42"', waist: '34–36"', hip: '42–44"', length: '29"' },
  { size: "XL", chest: '42–44"', waist: '36–38"', hip: '44–46"', length: '30"' },
  { size: "XXL", chest: '44–46"', waist: '38–40"', hip: '46–48"', length: '31"' },
];

export const WOMEN_TOPS: SizeRow[] = [
  { size: "XS", chest: '32–34"', waist: '24–26"', hip: '34–36"', length: '25"' },
  { size: "S", chest: '34–36"', waist: '26–28"', hip: '36–38"', length: '26"' },
  { size: "M", chest: '36–38"', waist: '28–30"', hip: '38–40"', length: '27"' },
  { size: "L", chest: '38–40"', waist: '30–32"', hip: '40–42"', length: '28"' },
  { size: "XL", chest: '40–42"', waist: '32–34"', hip: '42–44"', length: '29"' },
];

export const BOTTOMS: SizeRow[] = [
  { size: "XS", chest: "—", waist: '26–27"', hip: '34–35"', length: '38"' },
  { size: "S", chest: "—", waist: '28–29"', hip: '36–37"', length: '39"' },
  { size: "M", chest: "—", waist: '30–31"', hip: '38–39"', length: '40"' },
  { size: "L", chest: "—", waist: '32–33"', hip: '40–41"', length: '41"' },
  { size: "XL", chest: "—", waist: '34–35"', hip: '42–43"', length: '42"' },
  { size: "XXL", chest: "—", waist: '36–37"', hip: '44–45"', length: '43"' },
];

export const COTTON_SHRINK_NOTE =
  "Ring-spun cotton jersey and twill may relax ~2–4% in length after the first cold wash. Size up if you are between measurements or prefer a looser drape.";