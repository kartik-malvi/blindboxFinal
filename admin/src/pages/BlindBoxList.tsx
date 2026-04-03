import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlindBoxApi, BlindBox } from '../hooks/useBlindBoxApi';
import { StockBadge } from '../components/StockBadge';
import { InstallBanner } from '../components/InstallBanner';

export function BlindBoxList(): React.ReactElement {
  const api = useBlindBoxApi();
  const [boxes, setBoxes] = useState<BlindBox[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', shoplineProductId: '' });

  useEffect(() => {
    api.listBlindBoxes().then((data) => {
      if (data) setBoxes(data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await api.createBlindBox({
      name: form.name,
      description: form.description,
      price: parseFloat(form.price) as unknown as string,
      shoplineProductId: form.shoplineProductId,
    });
    if (created) {
      setBoxes((prev) => [created, ...prev]);
      setShowCreateForm(false);
      setForm({ name: '', description: '', price: '', shoplineProductId: '' });
    }
  };

  const handleToggle = async (box: BlindBox) => {
    const updated = await api.updateBlindBox(box.id, { isActive: !box.isActive });
    if (updated) {
      setBoxes((prev) => prev.map((b) => (b.id === box.id ? updated : b)));
    }
  };

  const totalStock = (box: BlindBox) =>
    box.items.reduce((sum, item) => sum + item.stock, 0);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}>
      <InstallBanner />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          Blind Boxes
        </h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + Create Blind Box
        </button>
      </div>

      {api.error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
          {api.error}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>New Blind Box</h2>

          {[
            { label: 'Name', key: 'name', type: 'text', required: true },
            { label: 'Description', key: 'description', type: 'text', required: false },
            { label: 'Price (¥)', key: 'price', type: 'number', required: true },
            { label: 'Shopline Product ID', key: 'shoplineProductId', type: 'text', required: true },
          ].map(({ label, key, type, required }) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{label}</span>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required={required}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              />
            </label>
          ))}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              disabled={api.loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {api.loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {api.loading && boxes.length === 0 && (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>Loading...</p>
        )}

        {!api.loading && boxes.length === 0 && (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>
            No blind boxes yet. Create one to get started.
          </p>
        )}

        {boxes.map((box) => (
          <div key={box.id} style={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: box.isActive ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Link
                  to={`/blind-boxes/${box.id}`}
                  style={{ fontWeight: 600, color: '#111827', textDecoration: 'none', fontSize: '1rem' }}
                >
                  {box.name}
                </Link>
                {!box.isActive && (
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    borderRadius: '9999px',
                  }}>
                    Inactive
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: '#6b7280' }}>
                <span>¥{parseFloat(box.price).toFixed(2)}</span>
                <span>{box.items.length} items</span>
                <StockBadge stock={totalStock(box)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Link
                to={`/blind-boxes/${box.id}`}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Edit
              </Link>
              <button
                onClick={() => handleToggle(box)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: box.isActive ? '#fee2e2' : '#dcfce7',
                  color: box.isActive ? '#dc2626' : '#16a34a',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {box.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
