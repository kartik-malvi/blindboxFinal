import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBlindBoxApi, BlindBox, BlindBoxItem } from '../hooks/useBlindBoxApi';
import { StockBadge } from '../components/StockBadge';
import { ProbabilityEditor, ProbabilityItem } from '../components/ProbabilityEditor';
import { RevealPreview } from '../components/RevealPreview';

export function BlindBoxDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const api = useBlindBoxApi();
  const [box, setBox] = useState<BlindBox | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [probItems, setProbItems] = useState<ProbabilityItem[]>([]);
  const [itemForm, setItemForm] = useState({
    name: '', sku: '', imageUrl: '', stock: '0', probability: '0',
  });

  useEffect(() => {
    if (!id) return;
    api.getBlindBox(id).then((data) => {
      if (data) {
        setBox(data);
        setProbItems(data.items.filter((i) => i.isActive).map((i) => ({
          id: i.id,
          name: i.name,
          probability: i.probability,
          isActive: i.isActive,
        })));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const item = await api.addItem(id, {
      name: itemForm.name,
      sku: itemForm.sku,
      imageUrl: itemForm.imageUrl || undefined,
      stock: parseInt(itemForm.stock),
      probability: parseFloat(itemForm.probability),
    });

    if (item && box) {
      const updated = { ...box, items: [...box.items, item] };
      setBox(updated);
      setProbItems(updated.items.filter((i) => i.isActive).map((i) => ({
        id: i.id, name: i.name, probability: i.probability, isActive: i.isActive,
      })));
      setShowItemForm(false);
      setItemForm({ name: '', sku: '', imageUrl: '', stock: '0', probability: '0' });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id || !window.confirm('Remove this item?')) return;
    await api.deleteItem(id, itemId);
    if (box) {
      const updated = { ...box, items: box.items.filter((i) => i.id !== itemId) };
      setBox(updated);
      setProbItems(updated.items.filter((i) => i.isActive).map((i) => ({
        id: i.id, name: i.name, probability: i.probability, isActive: i.isActive,
      })));
    }
  };

  const handleProbChange = async (updated: ProbabilityItem[]) => {
    setProbItems(updated);
    if (!id) return;
    for (const pi of updated) {
      await api.updateItem(id, pi.id, { probability: pi.probability });
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
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/blind-boxes" style={{ color: '#7c3aed', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to Blind Boxes
        </Link>
      </div>

      <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 700 }}>{box.name}</h1>
      {box.description && <p style={{ margin: '0 0 24px 0', color: '#6b7280' }}>{box.description}</p>}

      {api.error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
          {api.error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <Link
          to={`/blind-boxes/${box.id}/stock`}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          Manage Stock
        </Link>
      </div>

      {/* Items table */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Items</h2>
          <button
            onClick={() => setShowItemForm(!showItemForm)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            + Add Item
          </button>
        </div>

        {showItemForm && (
          <form onSubmit={handleAddItem} style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            {[
              { label: 'Name', key: 'name', required: true },
              { label: 'SKU', key: 'sku', required: true },
              { label: 'Image URL', key: 'imageUrl', required: false },
              { label: 'Stock', key: 'stock', required: true, type: 'number' },
              { label: 'Probability (0–1)', key: 'probability', required: true, type: 'number' },
            ].map(({ label, key, required, type = 'text' }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151' }}>{label}</span>
                <input
                  type={type}
                  step="any"
                  value={itemForm[key as keyof typeof itemForm]}
                  onChange={(e) => setItemForm((f) => ({ ...f, [key]: e.target.value }))}
                  required={required}
                  style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                />
              </label>
            ))}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px' }}>
              <button type="submit" style={{
                padding: '9px 18px', backgroundColor: '#7c3aed', color: '#fff',
                border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              }}>Add</button>
              <button type="button" onClick={() => setShowItemForm(false)} style={{
                padding: '9px 18px', backgroundColor: '#f3f4f6', color: '#374151',
                border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              }}>Cancel</button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {box.items.filter((i: BlindBoxItem) => i.isActive).map((item: BlindBoxItem) => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', backgroundColor: '#fff', border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>SKU: {item.sku}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <StockBadge stock={item.stock} />
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{(item.probability * 100).toFixed(1)}%</span>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  style={{
                    padding: '6px 12px', backgroundColor: '#fee2e2', color: '#dc2626',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {box.items.filter((i: BlindBoxItem) => i.isActive).length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
              No items yet. Add items to this blind box.
            </p>
          )}
        </div>
      </section>

      {/* Probability editor */}
      {probItems.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.125rem', fontWeight: 600 }}>
            Probability Distribution
          </h2>
          <div style={{
            backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '12px', padding: '20px',
          }}>
            <ProbabilityEditor items={probItems} onChange={handleProbChange} />
          </div>
        </section>
      )}

      {/* Reveal preview */}
      <section>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.125rem', fontWeight: 600 }}>
          Preview
        </h2>
        <RevealPreview items={box.items.filter((i: BlindBoxItem) => i.isActive)} />
      </section>
    </div>
  );
}
