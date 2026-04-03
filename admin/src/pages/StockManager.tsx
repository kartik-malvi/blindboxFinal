import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBlindBoxApi, BlindBox, BlindBoxItem } from '../hooks/useBlindBoxApi';
import { StockBadge } from '../components/StockBadge';

interface RestockRow {
  sku: string;
  name: string;
  currentStock: number;
  additionalStock: number;
}

export function StockManager(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const api = useBlindBoxApi();
  const [box, setBox] = useState<BlindBox | null>(null);
  const [rows, setRows] = useState<RestockRow[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getBlindBox(id).then((data) => {
      if (data) {
        setBox(data);
        setRows(
          data.items
            .filter((i: BlindBoxItem) => i.isActive)
            .map((i: BlindBoxItem) => ({
              sku: i.sku,
              name: i.name,
              currentStock: i.stock,
              additionalStock: 0,
            }))
        );
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRestock = async () => {
    if (!id) return;

    const entries = rows
      .filter((r) => r.additionalStock > 0)
      .map((r) => ({ sku: r.sku, additionalStock: r.additionalStock }));

    if (entries.length === 0) return;

    const results = await api.bulkRestock(id, entries);
    if (results) {
      setRows((prev) =>
        prev.map((row) => {
          const result = results.find((r) => r.sku === row.sku);
          return result
            ? { ...row, currentStock: result.newStock, additionalStock: 0 }
            : row;
        })
      );
      setSuccess(`Successfully restocked ${entries.length} item(s).`);
      setTimeout(() => setSuccess(null), 4000);
    }
  };

  if (!box) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
        {api.loading ? 'Loading...' : 'Blind box not found.'}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to={`/blind-boxes/${id}`} style={{ color: '#7c3aed', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to {box.name}
        </Link>
      </div>

      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: 700 }}>Manage Stock</h1>

      {api.error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
          {api.error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '8px', marginBottom: '16px' }}>
          {success}
        </div>
      )}

      <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Item', 'SKU', 'Current Stock', 'Add Stock'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.sku} style={{ borderBottom: idx < rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                  {row.name}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280', fontFamily: 'monospace' }}>
                  {row.sku}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StockBadge stock={row.currentStock} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <input
                    type="number"
                    min={0}
                    value={row.additionalStock}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.sku === row.sku
                            ? { ...r, additionalStock: Math.max(0, parseInt(e.target.value) || 0) }
                            : r
                        )
                      )
                    }
                    style={{
                      width: '80px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleRestock}
          disabled={api.loading || rows.every((r) => r.additionalStock === 0)}
          style={{
            padding: '10px 24px',
            backgroundColor: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            opacity: rows.every((r) => r.additionalStock === 0) ? 0.5 : 1,
          }}
        >
          {api.loading ? 'Saving...' : 'Apply Restock'}
        </button>
      </div>
    </div>
  );
}
