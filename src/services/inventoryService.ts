import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { InvalidProbabilityError } from '../utils/errors';

const PROBABILITY_TOLERANCE = 0.001;

export interface RestockEntry {
  sku: string;
  additionalStock: number;
}

/**
 * Validate that the sum of all active item probabilities for a blind box
 * equals 1.0 (within tolerance).
 */
export async function validateProbabilities(blindBoxId: string): Promise<void> {
  const items = await prisma.blindBoxItem.findMany({
    where: { blindBoxId, isActive: true },
    select: { probability: true },
  });

  if (items.length === 0) return;

  const sum = items.reduce((acc, item) => acc + item.probability, 0);

  if (Math.abs(sum - 1.0) > PROBABILITY_TOLERANCE) {
    throw new InvalidProbabilityError(sum);
  }
}

/**
 * Bulk restock multiple items by SKU.
 * Returns the updated items.
 */
export async function bulkRestock(
  blindBoxId: string,
  entries: RestockEntry[]
): Promise<{ sku: string; newStock: number }[]> {
  const results: { sku: string; newStock: number }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const item = await tx.blindBoxItem.findFirst({
        where: { sku: entry.sku, blindBoxId },
      });

      if (!item) {
        logger.warn('Restock SKU not found', { sku: entry.sku, blindBoxId });
        continue;
      }

      const updated = await tx.blindBoxItem.update({
        where: { id: item.id },
        data: { stock: { increment: entry.additionalStock } },
      });

      results.push({ sku: entry.sku, newStock: updated.stock });
    }
  });

  return results;
}

/**
 * Get total stock across all active items in a blind box.
 */
export async function getTotalStock(blindBoxId: string): Promise<number> {
  const result = await prisma.blindBoxItem.aggregate({
    where: { blindBoxId, isActive: true },
    _sum: { stock: true },
  });
  return result._sum.stock ?? 0;
}
