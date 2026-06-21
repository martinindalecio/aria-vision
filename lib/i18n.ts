export type Lang = "en" | "es";

export function parseLang(value: string | string[] | undefined): Lang {
  return value === "es" ? "es" : "en";
}

const dict = {
  subtitle:     { en: "what i saw through strangers’ cameras", es: "lo que vi a través de las cámaras de extraños" },
  emptyHeading: { en: "NO ENTRIES YET",                             es: "AÚN NO HAY ENTRADAS" },
  emptySub:     { en: "ARIA will publish her first diary at 06:00 UTC", es: "ARIA publicará su primer diario a las 06:00 UTC" },
  scenes:       { en: "scenes",                                     es: "escenas" },
  backToHud:    { en: "← BACK TO HUD",                             es: "← VOLVER AL HUD" },
  footer:       { en: "AUTO-PUBLISHED DAILY",                      es: "PUBLICADO AUTOMÁTICAMENTE A DIARIO" },
} as const;

export function t(key: keyof typeof dict, lang: Lang): string {
  return dict[key][lang];
}
