import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDiscoveredPlace, reclassifyByNameCategory, isEligibleForProspecting } from "./discovery-filters";

// §3/§4: these MUST be excluded (return a non-null reason).
const MUST_FAIL: { name: string; types: string[] }[] = [
  { name: "Extra Mercado", types: ["supermarket"] },
  { name: "Extra Mercado", types: ["restaurant"] }, // Google misclassified — name still catches it
  { name: "Posto Petrobras", types: ["gas_station"] },
  { name: "Posto Ipiranga", types: ["gas_station", "convenience_store"] },
  { name: "McDonald's", types: ["hamburger_restaurant", "restaurant"] },
  { name: "Burger King Mooca", types: ["hamburger_restaurant"] },
  { name: "Drogaria São Paulo", types: ["pharmacy"] },
  { name: "Drogaria São Paulo", types: ["restaurant"] }, // misclassified pharmacy
  { name: "Ragazzo Shopping Anália Franco", types: ["italian_restaurant"] },
  { name: "Giraffas", types: ["brazilian_restaurant"] },
  { name: "Assaí Atacadista", types: ["supermarket"] },
  { name: "Casa de Carnes Boi Bom", types: ["store"] }, // açougue-like, no allowlist type/food signal
];

// §3: these MUST pass (return null) — real independent food businesses.
const MUST_PASS: { name: string; types: string[] }[] = [
  { name: "Buba Burger", types: ["hamburger_restaurant"] },
  { name: "Pizzaria do Bairro", types: ["pizza_restaurant"] },
  { name: "Japa One Fast", types: ["japanese_restaurant"] },
  { name: "Padaria Real", types: ["bakery"] },
  { name: "Café Girondino", types: ["cafe", "coffee_shop"] },
  { name: "Empório Gourmet", types: ["store"] }, // "empório" allowed because of food signal "gourmet"
  { name: "Cantina da Nonna", types: ["italian_restaurant"] },
  { name: "Sushi Yassu", types: ["restaurant"] },
];

test("layered filter excludes markets, gas stations, pharmacies and big chains", () => {
  for (const p of MUST_FAIL) {
    const reason = classifyDiscoveredPlace({ name: p.name, types: p.types });
    assert.notEqual(reason, null, `expected "${p.name}" (${p.types}) to be excluded, got null`);
    assert.equal(isEligibleForProspecting(p.name, p.types), false, `"${p.name}" should be ineligible`);
  }
});

test("layered filter passes real independent food businesses", () => {
  for (const p of MUST_PASS) {
    const reason = classifyDiscoveredPlace({ name: p.name, types: p.types });
    assert.equal(reason, null, `expected "${p.name}" (${p.types}) to pass, got "${reason}"`);
    assert.equal(isEligibleForProspecting(p.name, p.types), true, `"${p.name}" should be eligible`);
  }
});

test("reclassifyByNameCategory catches junk stored with only a category", () => {
  assert.notEqual(reclassifyByNameCategory("Extra Mercado", "supermarket"), null);
  assert.notEqual(reclassifyByNameCategory("Extra Mercado", "restaurant"), null); // name catches it
  assert.notEqual(reclassifyByNameCategory("Posto Petrobras", "gas_station"), null);
  assert.notEqual(reclassifyByNameCategory("McDonald's", "hamburger_restaurant"), null);
  assert.equal(reclassifyByNameCategory("Buba Burger", "hamburger_restaurant"), null);
  assert.equal(reclassifyByNameCategory("Padaria Real", "bakery"), null);
});

test("word-boundary keyword matching avoids false positives", () => {
  // "posto" inside "Apóstolo", "shell" inside "Shellfish" should NOT trigger.
  assert.equal(classifyDiscoveredPlace({ name: "Restaurante Apóstolo", types: ["restaurant"] }), null);
  assert.equal(classifyDiscoveredPlace({ name: "Shellfish Bar", types: ["seafood_restaurant"] }), null);
  // Petiscaria must not be blocked by a stray "pet".
  assert.equal(classifyDiscoveredPlace({ name: "Petiscaria do Zé", types: ["bar"] }), null);
});
