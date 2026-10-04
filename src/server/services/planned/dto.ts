import type { PlannedExpense, RecurringCharge } from '../../db/schema';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import type { RecurringDto } from '@/src/lib/schemas/recurring';

export function plannedToDto(p: PlannedExpense): PlannedDto {
  return {
    id: p.id,
    title: p.title,
    amountMinor: Number(p.amountMinor),
    currency: p.currency,
    categoryId: p.categoryId,
    scheduledAt: p.scheduledAt.toISOString(),
    place: p.place,
    reason: p.reason,
    payee: p.payee,
    notes: p.notes,
    status: p.status,
    completedExpenseId: p.completedExpenseId,
    completedAt: p.completedAt?.toISOString() ?? null,
    recurringChargeId: p.recurringChargeId,
    periodStart: p.periodStart,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function recurringToDto(r: RecurringCharge, current: PlannedExpense | undefined): RecurringDto {
  return {
    id: r.id,
    name: r.name,
    amountMinor: Number(r.amountMinor),
    currency: r.currency,
    categoryId: r.categoryId,
    payee: r.payee,
    notes: r.notes,
    dayOfMonth: r.dayOfMonth,
    reminderTime: r.reminderTime.slice(0, 5),
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    currentMonth: current ? { plannedId: current.id, status: current.status, scheduledAt: current.scheduledAt.toISOString() } : null,
  };
}
