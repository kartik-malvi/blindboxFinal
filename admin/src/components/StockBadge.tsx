import React from 'react';

interface StockBadgeProps {
  stock: number;
}

export function StockBadge({ stock }: StockBadgeProps): React.ReactElement {
  if (stock === 0) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: '#fee2e2',
        color: '#dc2626',
      }}>
        OUT OF STOCK
      </span>
    );
  }

  if (stock <= 20) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: '#fef9c3',
        color: '#ca8a04',
      }}>
        {stock} left
      </span>
    );
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: '#dcfce7',
      color: '#16a34a',
    }}>
      {stock} in stock
    </span>
  );
}
