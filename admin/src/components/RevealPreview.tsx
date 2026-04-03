import React, { useState, useCallback } from 'react';
import type { BlindBoxItem } from '../hooks/useBlindBoxApi';

interface RevealPreviewProps {
  items: BlindBoxItem[];
}

type PreviewState = 'idle' | 'spinning' | 'revealed';

export function RevealPreview({ items }: RevealPreviewProps): React.ReactElement {
  const [state, setState] = useState<PreviewState>('idle');
  const [revealedItem, setRevealedItem] = useState<BlindBoxItem | null>(null);

  const handlePreview = useCallback(() => {
    if (items.length === 0) return;

    setState('spinning');
    setRevealedItem(null);

    // Pick a random item for demo
    setTimeout(() => {
      const randomItem = items[Math.floor(Math.random() * items.length)];
      setRevealedItem(randomItem);
      setState('revealed');
    }, 1500);
  }, [items]);

  const handleReset = () => {
    setState('idle');
    setRevealedItem(null);
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#fafafa',
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
        Reveal Animation Preview
      </h3>

      {state === 'idle' && (
        <button
          onClick={handlePreview}
          disabled={items.length === 0}
          style={{
            padding: '10px 24px',
            backgroundColor: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: items.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            opacity: items.length === 0 ? 0.5 : 1,
          }}
        >
          Preview Reveal Animation
        </button>
      )}

      {state === 'spinning' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#7c3aed',
            borderRadius: '50%',
            animation: 'bb-preview-spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes bb-preview-spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Opening your blind box...</p>
        </div>
      )}

      {state === 'revealed' && revealedItem && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
            You got: {revealedItem.name}!
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            minWidth: '140px',
          }}>
            {revealedItem.imageUrl ? (
              <img
                src={revealedItem.imageUrl}
                alt={revealedItem.name}
                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
              />
            ) : (
              <div style={{ fontSize: '3rem', lineHeight: 1 }}>🎁</div>
            )}
            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>
              {revealedItem.name}
            </span>
            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>SKU: {revealedItem.sku}</span>
          </div>

          <button
            onClick={handleReset}
            style={{
              padding: '8px 20px',
              backgroundColor: 'transparent',
              border: '2px solid #7c3aed',
              color: '#7c3aed',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Preview Again
          </button>
        </div>
      )}
    </div>
  );
}
