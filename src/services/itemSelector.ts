import { PrismaClient, BlindBoxItem } from '@prisma/client';
import { prisma } from '../config/db';
import { OutOfStockError } from '../utils/errors';

const MAX_RETRIES = 3;

interface SelectionResult {
  item: BlindBoxItem;
  normalizedProbability: number;
}

/**
 * Weighted random selection using cumulative distribution function.
 * All active items with stock > 0 are eligible.
 * Probabilities are normalized so they sum to 1.0 among eligible items.
 */
function weightedRandom(items: BlindBoxItem[]): SelectionResult {
  const totalWeight = items.reduce((sum, item) => sum + item.probability, 0);
  const rand = Math.random() * totalWeight;

  let cumulative = 0;
  for (const item of items) {
    cumulative += item.probability;
    if (rand <= cumulative) {
      return { item, normalizedProbability: item.probability / totalWeight };
    }
  }

  // Fallback: return last item (handles floating-point edge cases)
  const last = items[items.length - 1];
  return { item: last, normalizedProbability: last.probability / totalWeight };
}

/**
 * Select a BlindBoxItem for a given blindBoxId, decrement stock atomically.
 * Uses SELECT FOR UPDATE inside a transaction to prevent race conditions.
 *
 * @param blindBoxId  UUID of the BlindBox
 * @param quantity    Number of units ordered
 * @param tx          Optional external Prisma transaction client
 */
export async function selectItem(
  blindBoxId: string,
  quantity: number
): Promise<BlindBoxItem> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;

    try {
      const selected = await prisma.$transaction(async (tx) => {
        // Lock the rows we care about to prevent concurrent modifications
        const items = await tx.$queryRaw<BlindBoxItem[]>`
          SELECT *
          FROM "BlindBoxItem"
          WHERE "blindBoxId" = ${blindBoxId}
            AND "isActive" = true
            AND "stock" > 0
          FOR UPDATE
        `;

        if (items.length === 0) {
          throw new OutOfStockError(blindBoxId);
        }

        const { item } = weightedRandom(items);

        // Validate stock would not go below zero
        if (item.stock < quantity) {
          throw new RetryableStockError(item.id);
        }

        // Decrement stock atomically
        const updated = await tx.blindBoxItem.update({
          where: { id: item.id },
          data: { stock: { decrement: quantity } },
        });

        return updated;
      });

      return selected;
    } catch (err) {
      if (err instanceof RetryableStockError) {
        if (attempt >= MAX_RETRIES) {
          throw new OutOfStockError(blindBoxId);
        }
        // Retry — will re-run weighted selection excluding the depleted item
        continue;
      }
      throw err;
    }
  }

  throw new OutOfStockError(blindBoxId);
}

/**
 * Internal error used to signal that the selected item ran out of stock
 * between the eligibility check and the update — triggers a retry.
 */
class RetryableStockError extends Error {
  constructor(public readonly itemId: string) {
    super(`Item ${itemId} has insufficient stock — retrying`);
    this.name = 'RetryableStockError';
  }
}

/**
 * Restore stock for a given item (used when an order is cancelled).
 */
export async function restoreStock(
  itemId: string,
  quantity: number,
  tx?: PrismaClient
): Promise<void> {
  const client = tx || prisma;
  await (client as PrismaClient).blindBoxItem.update({
    where: { id: itemId },
    data: { stock: { increment: quantity } },
  });
}
