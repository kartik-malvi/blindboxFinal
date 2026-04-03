import { useState, useCallback } from 'react';

// In production (Vercel), VITE_API_URL points to the Railway backend.
// In development, requests go to the local dev server via Vite proxy.
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/admin`
  : '/api/admin';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Api-Key': import.meta.env.VITE_ADMIN_API_KEY || '',
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export interface BlindBox {
  id: string;
  name: string;
  description?: string;
  price: string;
  shoplineProductId: string;
  isActive: boolean;
  items: BlindBoxItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BlindBoxItem {
  id: string;
  blindBoxId: string;
  name: string;
  sku: string;
  imageUrl?: string;
  stock: number;
  probability: number;
  isActive: boolean;
}

export interface BlindBoxOrder {
  id: string;
  shoplineOrderId: string;
  shoplineCustomerId: string;
  blindBoxId: string;
  assignedItemId: string;
  quantity: number;
  status: 'PENDING' | 'ASSIGNED' | 'FULFILLED' | 'FAILED';
  revealedAt?: string;
  createdAt: string;
  blindBox: { name: string };
  assignedItem: { name: string; sku: string };
}

export function useBlindBoxApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,

    // Blind Boxes
    listBlindBoxes: () =>
      request(() => apiFetch<BlindBox[]>('/blind-boxes')),

    getBlindBox: (id: string) =>
      request(() => apiFetch<BlindBox>(`/blind-boxes/${id}`)),

    createBlindBox: (data: Partial<BlindBox>) =>
      request(() =>
        apiFetch<BlindBox>('/blind-boxes', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      ),

    updateBlindBox: (id: string, data: Partial<BlindBox>) =>
      request(() =>
        apiFetch<BlindBox>(`/blind-boxes/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      ),

    deleteBlindBox: (id: string) =>
      request(() =>
        apiFetch<void>(`/blind-boxes/${id}`, { method: 'DELETE' })
      ),

    // Items
    addItem: (blindBoxId: string, data: Partial<BlindBoxItem>) =>
      request(() =>
        apiFetch<BlindBoxItem>(`/blind-boxes/${blindBoxId}/items`, {
          method: 'POST',
          body: JSON.stringify(data),
        })
      ),

    updateItem: (blindBoxId: string, itemId: string, data: Partial<BlindBoxItem>) =>
      request(() =>
        apiFetch<BlindBoxItem>(`/blind-boxes/${blindBoxId}/items/${itemId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
      ),

    deleteItem: (blindBoxId: string, itemId: string) =>
      request(() =>
        apiFetch<void>(`/blind-boxes/${blindBoxId}/items/${itemId}`, {
          method: 'DELETE',
        })
      ),

    bulkRestock: (blindBoxId: string, entries: { sku: string; additionalStock: number }[]) =>
      request(() =>
        apiFetch<{ sku: string; newStock: number }[]>(
          `/blind-boxes/${blindBoxId}/items/restock`,
          { method: 'POST', body: JSON.stringify(entries) }
        )
      ),

    // Orders
    listOrders: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(() => apiFetch<BlindBoxOrder[]>(`/orders${qs}`));
    },

    getOrder: (shoplineOrderId: string) =>
      request(() => apiFetch<BlindBoxOrder>(`/orders/${shoplineOrderId}`)),
  };
}
