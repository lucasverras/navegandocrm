import { test } from "node:test";
import assert from "node:assert/strict";
import { looksGeneric } from "./message-quality";

test("flags the forbidden generic openers", () => {
  assert.equal(looksGeneric("Vi o perfil e vocês têm muito potencial."), true);
  assert.equal(looksGeneric("Somos especialistas em conteúdo que gera resultados."), true);
  assert.equal(looksGeneric("Gostaria de apresentar nosso trabalho."), true);
  assert.equal(looksGeneric("Adorei o perfil de vocês!"), true);
  assert.equal(looksGeneric("Queremos potencializar seus resultados."), true);
});

test("passes a specific, grounded observation", () => {
  assert.equal(
    looksGeneric(
      "Fala Rafael, Lucas da Navegando. Vi que vocês mostram muito bem o produto, mas quase não aparece o preparo nem a equipe. Hoje fazem isso internamente?"
    ),
    false
  );
});
