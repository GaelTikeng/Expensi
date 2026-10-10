-- D14: currency codes are validated in code (src/lib/currencies.ts); the
-- reference table and the FKs pointing at it go. Constraints first so the
-- table drop needs no CASCADE.
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_budget_currency_currencies_code_fk";
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_currency_currencies_code_fk";
--> statement-breakpoint
ALTER TABLE "planned_expenses" DROP CONSTRAINT IF EXISTS "planned_expenses_currency_currencies_code_fk";
--> statement-breakpoint
ALTER TABLE "recurring_charges" DROP CONSTRAINT IF EXISTS "recurring_charges_currency_currencies_code_fk";
--> statement-breakpoint
DROP TABLE IF EXISTS "currencies";
