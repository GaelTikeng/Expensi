CREATE TYPE "public"."attachment_kind" AS ENUM('photo', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."expense_source" AS ENUM('manual', 'import', 'planned', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."import_source_type" AS ENUM('xlsx', 'csv', 'pdf_text', 'pdf_scan');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('queued', 'processing', 'review', 'committed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."line_kind" AS ENUM('expense', 'total', 'subtotal', 'header', 'struck_through', 'illegible');--> statement-breakpoint
CREATE TYPE "public"."planned_status" AS ENUM('planned', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."recap_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('pending', 'accepted', 'edited', 'rejected');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"operation" varchar(32) NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_user_id_period_start_operation_pk" PRIMARY KEY("user_id","period_start","operation")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expense_id" uuid,
	"storage_key" text NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"mime_type" varchar(127) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64),
	"original_filename" varchar(255),
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"icon" varchar(64),
	"color_hex" varchar(7),
	"parent_id" uuid,
	"budget_minor" bigint,
	"budget_currency" varchar(3),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"exponent" smallint NOT NULL,
	"symbol" varchar(8) NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"occurred_on" date NOT NULL,
	"paid_on" date,
	"description" text NOT NULL,
	"payee" varchar(200),
	"category_id" uuid,
	"notes" text,
	"source" "expense_source" DEFAULT 'manual' NOT NULL,
	"is_estimated" boolean DEFAULT false NOT NULL,
	"import_item_id" uuid,
	"recurring_charge_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"line_index" smallint NOT NULL,
	"raw_text" text NOT NULL,
	"amount_minor" bigint,
	"currency" varchar(3),
	"occurred_on" date,
	"description" text,
	"payee" varchar(200),
	"category_guess" varchar(120),
	"category_id" uuid,
	"confidence" real,
	"ambiguity_note" text,
	"line_kind" "line_kind" DEFAULT 'expense' NOT NULL,
	"review_state" "review_state" DEFAULT 'pending' NOT NULL,
	"edited_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" "import_source_type" NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" varchar(255),
	"mime_type" varchar(127),
	"size_bytes" integer,
	"page_count" smallint DEFAULT 1 NOT NULL,
	"status" "import_status" DEFAULT 'queued' NOT NULL,
	"failure_reason" text,
	"attempt_count" smallint DEFAULT 0 NOT NULL,
	"model" varchar(128),
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"detected_currency" varchar(8),
	"detected_language" varchar(16),
	"document_quality" varchar(16),
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "planned_expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"category_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"place" varchar(200),
	"reason" text,
	"payee" varchar(200),
	"notes" text,
	"status" "planned_status" DEFAULT 'planned' NOT NULL,
	"completed_expense_id" uuid,
	"completed_at" timestamp with time zone,
	"recurring_charge_id" uuid,
	"period_start" date,
	"reminder_24h_sent_at" timestamp with time zone,
	"reminder_1h_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" "recap_period" NOT NULL,
	"period_start" date NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stats" jsonb NOT NULL,
	"narrative_md" text,
	"model" varchar(128),
	"is_stale" boolean DEFAULT false NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recurring_charges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"category_id" uuid,
	"payee" varchar(200),
	"notes" text,
	"day_of_month" smallint NOT NULL,
	"reminder_time" time DEFAULT '09:00' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(191) NOT NULL,
	"email" varchar(320),
	"display_name" varchar(200),
	"default_currency" varchar(3) DEFAULT 'XAF' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Africa/Douala' NOT NULL,
	"expo_push_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_budget_currency_currencies_code_fk" FOREIGN KEY ("budget_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_import_item_id_import_items_id_fk" FOREIGN KEY ("import_item_id") REFERENCES "public"."import_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_charge_id_recurring_charges_id_fk" FOREIGN KEY ("recurring_charge_id") REFERENCES "public"."recurring_charges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_completed_expense_id_expenses_id_fk" FOREIGN KEY ("completed_expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_recurring_charge_id_recurring_charges_id_fk" FOREIGN KEY ("recurring_charge_id") REFERENCES "public"."recurring_charges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "attachments_expense_idx" ON "attachments" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "attachments_user_idx" ON "attachments" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_name_key" ON "categories" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expenses_user_occurred_idx" ON "expenses" USING btree ("user_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "expenses_user_category_idx" ON "expenses" USING btree ("user_id","category_id","occurred_on");--> statement-breakpoint
CREATE INDEX "expenses_live_idx" ON "expenses" USING btree ("user_id","occurred_on") WHERE "expenses"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "import_items_line_key" ON "import_items" USING btree ("import_id","line_index");--> statement-breakpoint
CREATE INDEX "import_items_review_idx" ON "import_items" USING btree ("user_id","review_state");--> statement-breakpoint
CREATE INDEX "imports_user_idx" ON "imports" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "imports_pending_idx" ON "imports" USING btree ("status","created_at") WHERE "imports"."status" in ('queued','processing');--> statement-breakpoint
CREATE INDEX "planned_expenses_user_sched_idx" ON "planned_expenses" USING btree ("user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "planned_expenses_user_status_idx" ON "planned_expenses" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "planned_expenses_recurring_period_key" ON "planned_expenses" USING btree ("recurring_charge_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "recaps_user_period_key" ON "recaps" USING btree ("user_id","period","period_start");--> statement-breakpoint
CREATE INDEX "recurring_charges_user_idx" ON "recurring_charges" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users" USING btree ("clerk_user_id");