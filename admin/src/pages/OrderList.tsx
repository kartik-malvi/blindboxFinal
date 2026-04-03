import React, { useEffect, useState } from 'react';
import { useBlindBoxApi, BlindBoxOrder } from '../hooks/useBlindBoxApi';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: '#fef9c3', text: '#ca8a04' },
  ASSIGNED:  { bg: '#dbeafe', text: '#2563eb' },
  FULFILLED: { bg: '#dcfce7', text: '#16a34a' },
  FAILED:    { bg: '#fee2e2', text: '#dc2626' },
};

export function OrderList(): React.ReactElement {
  const api = useBlindBoxApi();
  const [orders, setOrders] = useState<BlindBoxOrder[]>([]);
  const [filters, setFilters] = useState({
    status: '', blindBoxId: '', from: '', to: '',
  });

  const load = async () => {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.blindBoxId) params.blindBoxId = filters.blindBoxId;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;

    const data = await api.listOrders(params);
    if (data) setOrders(data);
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
        Orders
      </h1>

      {/* Filters */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Status</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
          >
            <option value="">All statuses</option>
            {['PENDING', 'ASSIGNED', 'FULFILLED', 'FAILED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>From</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>To</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
          />
        </label>

        <button
          onClick={load}
          style={{
            padding: '8px 20px',
            backgroundColor: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Filter
        </button>
      </div>

      {api.error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
          {api.error}
        </div>
      )}

      <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Order ID', 'Blind Box', 'Assigned Item', 'Qty', 'Status', 'Created'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {api.loading && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                  Loading...
                </td>
              </tr>
            )}

            {!api.loading && orders.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                  No orders found.
                </td>
              </tr>
            )}

            {orders.map((order, idx) => {
              const colors = STATUS_COLORS[order.status] || { bg: '#f3f4f6', text: '#374151' };
              return (
                <tr key={order.id} style={{ borderBottom: idx < orders.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontFamily: 'monospace', color: '#374151' }}>
                    {order.shoplineOrderId}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                    {order.blindBox.name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                    {order.assignedItem.name}
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{order.assignedItem.sku}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                    {order.quantity}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      padding: '2px 10px',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
