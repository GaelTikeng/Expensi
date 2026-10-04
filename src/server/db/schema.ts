/**
 * Neon Postgres schema — v2 scope. SERVER-SIDE ONLY.
 * This module (and DATABASE_URL) must never be imported by client code.
 *
 * Conventions (see CLAUDE.md §5):
 *  - Money: bigint minor units + ISO-4217 code. XAF exponent 0.
 *  - Calendar dates: `date`. Instants: `timestamptz`.
 *  - Soft deletes via deleted_at on all user data tables.
 *  - Every tenant table carries user_id; access only through repositories.
 */

import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

const auditCols = {
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  deletedAt: timestamptz('deleted_at'),
};

/* ── enums ────────────────────────────────────────────────────────────────── */
export const expenseSourceEnum = pgEnum('expense_source', [
  'manual',
  'import',
  'planned',
  'recurring',
]);

export const importStatusEnum = pgEnum('import_status', [
  'queued',
  'processing',
  'review',
  'committed',
  'failed',
]);

export const importSourceTypeEnum = pgEnum('import_source_type', [
  'xlsx',
  'csv',
  'pdf_text',
  'pdf_scan',
]);

export const lineKindEnum = pgEnum('line_kind', [
  'expense',
  'total',
  'subtotal',
  'header',
  'struck_through',
  'illegible',
]);

export const reviewStateEnum = pgEnum('review_state', [
  'pending',
  'accepted',
  'edited',
  'rejected',
]);

export const plannedStatusEnum = pgEnum('planned_status', ['planned', 'done', 'skipped']);

export const recapPeriodEnum = pgEnum('recap_period', ['day', 'week', 'month']);

export const attachmentKindEnum = pgEnum('attachment_kind', ['photo', 'pdf']);

/* ── users ────────────────────────────────────────────────────────────────── */
/** One row per Clerk user. Created on first authenticated request. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkUserId: varchar('clerk_user_id', { length: 191 }).notNull(),
    email: varchar('email', { length: 320 }),
    displayName: varchar('display_name', { length: 200 }),
    defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('XAF'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Africa/Douala'),
    expoPushToken: text('expo_push_token'),
    ...auditCols,
  },
  (t) => [uniqueIndex('users_clerk_user_id_key').on(t.clerkUserId)],
);

/* ── currencies (reference data, seeded) ──────────────────────────────────── */
export const currencies = pgTable('currencies', {
  code: varchar('code', { length: 3 }).primaryKey(),
  /** 0 for XAF, 2 for USD/EUR. Resolve before formatting. */
  exponent: smallint('exponent').notNull(),
  symbol: varchar('symbol', { length: 8 }).notNull(),
  name: text('name').notNull(),
});

/* ── categories ───────────────────────────────────────────────────────────── */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    icon: varchar('icon', { length: 64 }),
    colorHex: varchar('color_hex', { length: 7 }),
    /** One level of nesting only; enforced in the repository, not the DB. */
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
    budgetMinor: bigint('budget_minor', { mode: 'number' }),
    budgetCurrency: varchar('budget_currency', { length: 3 }).references(() => currencies.code),
    sortOrder: integer('sort_order').notNull().default(0),
    ...auditCols,
  },
  (t) => [
    uniqueIndex('categories_user_name_key').on(t.userId, t.name),
    index('categories_user_idx').on(t.userId),
  ],
);

/* ── imports (one per uploaded xlsx / csv / pdf) ──────────────────────────── */
export const imports = pgTable(
  'imports',
  {
    /** Client-generated UUID v7 so a retried upload is idempotent. */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    sourceType: importSourceTypeEnum('source_type').notNull(),
    /** S3 object key. Never a public URL. */
    storageKey: text('storage_key').notNull(),
    originalFilename: varchar('original_filename', { length: 255 }),
    mimeType: varchar('mime_type', { length: 127 }),
    sizeBytes: integer('size_bytes'),
    pageCount: smallint('page_count').notNull().default(1),

    status: importStatusEnum('status').notNull().default('queued'),
    failureReason: text('failure_reason'),
    attemptCount: smallint('attempt_count').notNull().default(0),

    model: varchar('model', { length: 128 }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    latencyMs: integer('latency_ms'),

    detectedCurrency: varchar('detected_currency', { length: 8 }),
    detectedLanguage: varchar('detected_language', { length: 16 }),
    documentQuality: varchar('document_quality', { length: 16 }),

    committedAt: timestamptz('committed_at'),
    ...auditCols,
  },
  (t) => [
    index('imports_user_idx').on(t.userId, t.createdAt.desc()),
    index('imports_pending_idx')
      .on(t.status, t.createdAt)
      .where(sql`${t.status} in ('queued','processing')`),
  ],
);

/* ── import_items (staging — never auto-promoted) ─────────────────────────── */
export const importItems = pgTable(
  'import_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    lineIndex: smallint('line_index').notNull(),
    rawText: text('raw_text').notNull(),

    amountMinor: bigint('amount_minor', { mode: 'number' }),
    currency: varchar('currency', { length: 3 }),
    occurredOn: date('occurred_on'),
    description: text('description'),
    payee: varchar('payee', { length: 200 }),
    categoryGuess: varchar('category_guess', { length: 120 }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),

    confidence: real('confidence'),
    ambiguityNote: text('ambiguity_note'),

    /** Totals and struck-through lines must never become expenses. */
    lineKind: lineKindEnum('line_kind').notNull().default('expense'),
    reviewState: reviewStateEnum('review_state').notNull().default('pending'),
    editedByUser: boolean('edited_by_user').notNull().default(false),

    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('import_items_line_key').on(t.importId, t.lineIndex),
    index('import_items_review_idx').on(t.userId, t.reviewState),
  ],
);

/* ── recurring_charges (fixed monthly charges) ────────────────────────────── */
export const recurringCharges = pgTable(
  'recurring_charges',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 200 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    payee: varchar('payee', { length: 200 }),
    notes: text('notes'),

    /** 1..31; clamped to the last day of shorter months when materialising. */
    dayOfMonth: smallint('day_of_month').notNull(),
    /** Local time of day for the reminder; interpreted in users.timezone. */
    reminderTime: time('reminder_time').notNull().default('09:00'),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (t) => [index('recurring_charges_user_idx').on(t.userId, t.isActive)],
);

/* ── expenses (the ledger) ────────────────────────────────────────────────── */
export const expenses = pgTable(
  'expenses',
  {
    /** Client-generated UUID v7 — idempotent retries, offline-friendly. */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code),

    /** Drives all reporting. */
    occurredOn: date('occurred_on').notNull(),
    /** Informational only. */
    paidOn: date('paid_on'),

    description: text('description').notNull(),
    payee: varchar('payee', { length: 200 }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    notes: text('notes'),

    source: expenseSourceEnum('source').notNull().default('manual'),
    isEstimated: boolean('is_estimated').notNull().default(false),

    /** Audit trail back to the staged row this expense was promoted from. */
    importItemId: uuid('import_item_id').references(() => importItems.id, {
      onDelete: 'set null',
    }),
    recurringChargeId: uuid('recurring_charge_id').references(() => recurringCharges.id, {
      onDelete: 'set null',
    }),

    ...auditCols,
  },
  (t) => [
    index('expenses_user_occurred_idx').on(t.userId, t.occurredOn.desc()),
    index('expenses_user_category_idx').on(t.userId, t.categoryId, t.occurredOn),
    index('expenses_live_idx')
      .on(t.userId, t.occurredOn)
      .where(sql`${t.deletedAt} is null`),
  ],
);

/* ── planned_expenses (scheduled future spend, with reminders) ────────────── */
export const plannedExpenses = pgTable(
  'planned_expenses',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    title: varchar('title', { length: 200 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),

    /** The moment the expense is meant to happen; reminders are T-24h and T-1h. */
    scheduledAt: timestamptz('scheduled_at').notNull(),
    place: varchar('place', { length: 200 }),
    reason: text('reason'),
    payee: varchar('payee', { length: 200 }),
    notes: text('notes'),

    status: plannedStatusEnum('status').notNull().default('planned'),
    completedExpenseId: uuid('completed_expense_id').references(() => expenses.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamptz('completed_at'),

    /** Materialised from a fixed monthly charge, if any. */
    recurringChargeId: uuid('recurring_charge_id').references(() => recurringCharges.id, {
      onDelete: 'set null',
    }),
    /** YYYY-MM-01 of the month this row was materialised for. Unique per charge. */
    periodStart: date('period_start'),

    reminder24hSentAt: timestamptz('reminder_24h_sent_at'),
    reminder1hSentAt: timestamptz('reminder_1h_sent_at'),

    ...auditCols,
  },
  (t) => [
    index('planned_expenses_user_sched_idx').on(t.userId, t.scheduledAt),
    index('planned_expenses_user_status_idx').on(t.userId, t.status),
    uniqueIndex('planned_expenses_recurring_period_key').on(t.recurringChargeId, t.periodStart),
  ],
);

/* ── attachments (proof files in S3) ──────────────────────────────────────── */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Nullable until the client confirms the upload and links it. */
    expenseId: uuid('expense_id').references(() => expenses.id, { onDelete: 'cascade' }),

    /** `users/{userId}/{yyyy}/{mm}/{uuid}.{ext}` — per-user purge is a prefix delete. */
    storageKey: text('storage_key').notNull(),
    kind: attachmentKindEnum('kind').notNull(),
    mimeType: varchar('mime_type', { length: 127 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: varchar('sha256', { length: 64 }),
    originalFilename: varchar('original_filename', { length: 255 }),

    uploadedAt: timestamptz('uploaded_at'),
    ...auditCols,
  },
  (t) => [
    uniqueIndex('attachments_storage_key_key').on(t.storageKey),
    index('attachments_expense_idx').on(t.expenseId),
    index('attachments_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);

/* ── recaps (day / week / month) ──────────────────────────────────────────── */
export const recaps = pgTable(
  'recaps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    period: recapPeriodEnum('period').notNull(),
    /** First day of the period (Monday for weeks). */
    periodStart: date('period_start').notNull(),

    generatedAt: timestamptz('generated_at').notNull().defaultNow(),
    /** Deterministic figures from SQL. The model never computes these. */
    stats: jsonb('stats').notNull(),
    /** Model prose over those figures. */
    narrativeMd: text('narrative_md'),
    model: varchar('model', { length: 128 }),
    isStale: boolean('is_stale').notNull().default(false),
    notifiedAt: timestamptz('notified_at'),
  },
  (t) => [uniqueIndex('recaps_user_period_key').on(t.userId, t.period, t.periodStart)],
);

/* ── ai_usage (server-authoritative quota ledger) ─────────────────────────── */
export const aiUsage = pgTable(
  'ai_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    operation: varchar('operation', { length: 32 }).notNull(),
    callCount: integer('call_count').notNull().default(0),
    inputTokens: bigint('input_tokens', { mode: 'number' }).notNull().default(0),
    outputTokens: bigint('output_tokens', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.periodStart, t.operation] })],
);

/* ── relations ────────────────────────────────────────────────────────────── */
export const usersRelations = relations(users, ({ many }) => ({
  expenses: many(expenses),
  categories: many(categories),
  imports: many(imports),
  plannedExpenses: many(plannedExpenses),
  recurringCharges: many(recurringCharges),
  attachments: many(attachments),
  recaps: many(recaps),
  aiUsage: many(aiUsage),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryParent',
  }),
  children: many(categories, { relationName: 'categoryParent' }),
  expenses: many(expenses),
}));

export const importsRelations = relations(imports, ({ one, many }) => ({
  user: one(users, { fields: [imports.userId], references: [users.id] }),
  items: many(importItems),
}));

export const importItemsRelations = relations(importItems, ({ one }) => ({
  import: one(imports, { fields: [importItems.importId], references: [imports.id] }),
  user: one(users, { fields: [importItems.userId], references: [users.id] }),
  category: one(categories, { fields: [importItems.categoryId], references: [categories.id] }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  user: one(users, { fields: [expenses.userId], references: [users.id] }),
  category: one(categories, { fields: [expenses.categoryId], references: [categories.id] }),
  importItem: one(importItems, { fields: [expenses.importItemId], references: [importItems.id] }),
  recurringCharge: one(recurringCharges, {
    fields: [expenses.recurringChargeId],
    references: [recurringCharges.id],
  }),
  attachments: many(attachments),
}));

export const plannedExpensesRelations = relations(plannedExpenses, ({ one }) => ({
  user: one(users, { fields: [plannedExpenses.userId], references: [users.id] }),
  category: one(categories, { fields: [plannedExpenses.categoryId], references: [categories.id] }),
  completedExpense: one(expenses, {
    fields: [plannedExpenses.completedExpenseId],
    references: [expenses.id],
  }),
  recurringCharge: one(recurringCharges, {
    fields: [plannedExpenses.recurringChargeId],
    references: [recurringCharges.id],
  }),
}));

export const recurringChargesRelations = relations(recurringCharges, ({ one, many }) => ({
  user: one(users, { fields: [recurringCharges.userId], references: [users.id] }),
  category: one(categories, {
    fields: [recurringCharges.categoryId],
    references: [categories.id],
  }),
  plannedExpenses: many(plannedExpenses),
  expenses: many(expenses),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  user: one(users, { fields: [attachments.userId], references: [users.id] }),
  expense: one(expenses, { fields: [attachments.expenseId], references: [expenses.id] }),
}));

export const recapsRelations = relations(recaps, ({ one }) => ({
  user: one(users, { fields: [recaps.userId], references: [users.id] }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  user: one(users, { fields: [aiUsage.userId], references: [users.id] }),
}));

/* ── row types ────────────────────────────────────────────────────────────── */
export type User = typeof users.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Import = typeof imports.$inferSelect;
export type ImportItem = typeof importItems.$inferSelect;
export type PlannedExpense = typeof plannedExpenses.$inferSelect;
export type RecurringCharge = typeof recurringCharges.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Recap = typeof recaps.$inferSelect;
