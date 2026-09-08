// Deterministic "could this be sent to 20 different restaurants?" validator (brief §MENSAGEM).
// The message prompt already forbids generic openers, but models still slip — so we check the
// output in code and regenerate once when it reads generic. No AI, no network.

const BANNED_PHRASES = [
  "muito potencial",
  "bastante potencial",
  "grande potencial",
  "todo potencial",
  "adorei o perfil",
  "adorei o trabalho",
  "gostei do trabalho",
  "gostei muito do",
  "conteudo e muito interessante",
  "conteudo muito interessante",
  "somos especialistas",
  "especialistas em resultados",
  "gostaria de apresentar",
  "venho apresentar",
  "solucoes personalizadas",
  "potencializar",
  "estrategia inovadora",
  "alavancar",
  "parceria de sucesso",
  "espero que esteja tudo bem",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Returns true when the text reads like a generic template that ignores this restaurant.
export function looksGeneric(text: string): boolean {
  const n = normalize(text);
  return BANNED_PHRASES.some((p) => n.includes(p));
}

// Stronger instruction appended when a first attempt failed the check.
export const REGENERATE_HINT =
  " A versão anterior soou genérica (poderia ser enviada para 20 restaurantes). Reescreva com uma observação concreta e específica sobre ESTE restaurante, sem nenhuma frase de elogio vago ou linguagem de proposta comercial.";
