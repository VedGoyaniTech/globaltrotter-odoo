import { ExpenseCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type BudgetBreakdown = {
  tripId: string;
  currencyNote: string;
  totals: Record<ExpenseCategory, number>;
  total: number;
  budgetLimit: number | null;
  overBudget: boolean;
  days: number;
  averagePerDay: number;
  perDay: { date: string; total: number; overAverage: boolean }[];
};

const emptyTotals = (): Record<ExpenseCategory, number> => ({
  TRANSPORT: 0,
  STAY: 0,
  ACTIVITIES: 0,
  MEALS: 0,
  OTHER: 0,
});

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Cost breakdown for the Budget screen.
 * ACTIVITIES is derived from the itinerary; the other categories come from
 * manually entered Expense rows. Manual ACTIVITIES rows are added on top.
 */
export async function getBreakdown(tripId: string): Promise<BudgetBreakdown> {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      expenses: true,
      stops: { include: { activities: true } },
    },
  });

  const totals = emptyTotals();
  const perDayMap = new Map<string, number>();

  const addToDay = (date: Date | null, amount: number) => {
    if (!date) return;
    const key = dayKey(date);
    perDayMap.set(key, (perDayMap.get(key) ?? 0) + amount);
  };

  for (const stop of trip.stops) {
    for (const activity of stop.activities) {
      const amount = Number(activity.cost);
      totals.ACTIVITIES += amount;
      addToDay(activity.scheduledDate ?? stop.startDate, amount);
    }
  }

  for (const expense of trip.expenses) {
    const amount = Number(expense.amount);
    totals[expense.category] += amount;
    addToDay(expense.date, amount);
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  const msPerDay = 86_400_000;
  const days = Math.max(
    1,
    Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / msPerDay) + 1,
  );
  const averagePerDay = total / days;

  const perDay: BudgetBreakdown['perDay'] = [];
  const cursor = new Date(trip.startDate);
  while (cursor <= trip.endDate) {
    const key = dayKey(cursor);
    const dayTotal = perDayMap.get(key) ?? 0;
    perDay.push({ date: key, total: dayTotal, overAverage: dayTotal > averagePerDay });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const budgetLimit = trip.budgetLimit === null ? null : Number(trip.budgetLimit);

  return {
    tripId,
    currencyNote: 'All amounts are in the platform base currency.',
    totals,
    total,
    budgetLimit,
    overBudget: budgetLimit !== null && total > budgetLimit,
    days,
    averagePerDay,
    perDay,
  };
}
