# Data Quality Report — Radar Navegando V9

## How to Run

Execute `scripts/data-quality-check.sql` against the production database via Supabase SQL Editor.

## Checks Included

| # | Check | What it flags |
|---|-------|---------------|
| 1 | clients_missing_data | Closed clients with missing mensalidade or closed_at |
| 2 | pipeline_no_next_action | Active pipeline leads without a defined next step |
| 3 | duplicate_instagram | Multiple leads sharing the same Instagram handle |
| 4 | duplicate_phone | Multiple leads sharing the same phone number |
| 5 | pipeline_no_phone | Pipeline leads that can't be contacted via WhatsApp |
| 6 | commission_zero_percent | Closed clients with commission type but 0% rate |
| 7 | empty_regions | Active regions with zero associated leads |
| 8 | pending_reimbursements | Count of unresolved reimbursements |
| 9 | table_row_counts | Total rows per key table for snapshot comparison |

## Resolution Rules

- **clients_missing_data**: Use the "Completar dados" flow in Resultados to fill in missing fields.
- **pipeline_no_next_action**: These leads appear on the Home page as "Sem próximo passo" exceptions. Assign a next action.
- **duplicate_instagram/phone**: Review manually. May be legitimate (different locations) or data entry errors.
- **pipeline_no_phone**: Check if Instagram or alternative contact exists. Flag for review.
- **commission_zero_percent**: Likely data entry error. Edit the client in Resultados.
- **empty_regions**: Archive unused regions in Configurações > Regiões.

## Do Not Auto-Fix

If a value is unknown or ambiguous, flag it for human review. Never invent dates, amounts, or percentages.
