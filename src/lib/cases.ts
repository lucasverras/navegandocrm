// Structured library of Navegando MKT reference cases. The message generator picks the case
// whose `categories` best match the lead's Google category, so the "case" strategy cites a
// genuinely comparable restaurant instead of name-dropping whatever is most famous.
//
// Keep `result` QUALITATIVE — never invent numbers. The generator is instructed not to state
// metrics that aren't written here.

export interface NavegandoCase {
  name: string;
  // Google Places categories this case is a good comparable for.
  categories: string[];
  // Plain-language niche, used when no category matches exactly.
  niche: string;
  did: string;
  result: string;
}

export const NAVEGANDO_CASES: NavegandoCase[] = [
  {
    name: "Pecatto",
    categories: ["hamburger_restaurant", "sandwich_shop", "meal_takeaway"],
    niche: "hamburgueria",
    did: "produção de conteúdo mostrando o preparo do hambúrguer, bastidores da cozinha e a equipe",
    result: "o perfil passou a mostrar o preparo e a rotina da casa com constância, não só a foto do produto pronto",
  },
  {
    name: "La Braciera",
    categories: ["pizza_restaurant", "italian_restaurant"],
    niche: "pizzaria / cozinha italiana",
    did: "captação presencial da massa, do forno e do ambiente, com formatos pensados para alcance",
    result: "o conteúdo passou a transmitir a experiência da casa, não apenas o cardápio",
  },
  {
    name: "Legado Parrilla",
    categories: ["steak_house", "brazilian_restaurant", "bar"],
    niche: "parrilla / churrasco",
    did: "conteúdo mostrando o corte, a brasa e o ritual do preparo na parrilla",
    result: "o preparo e o ambiente viraram o centro do perfil, criando desejo pela experiência",
  },
];

// Sensible fallback when nothing matches — the most broadly relatable case.
const DEFAULT_CASE = NAVEGANDO_CASES[0];

export function pickRelevantCase(category: string | null | undefined): NavegandoCase {
  if (!category) return DEFAULT_CASE;
  const match = NAVEGANDO_CASES.find((c) => c.categories.includes(category));
  return match ?? DEFAULT_CASE;
}

// One-line reference string handed to the model for the chosen case.
export function describeCase(c: NavegandoCase): string {
  return `${c.name} (${c.niche}): ${c.did}. Resultado: ${c.result}.`;
}
