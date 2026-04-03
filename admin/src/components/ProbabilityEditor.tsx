import React, { useState, useCallback } from 'react';

export interface ProbabilityItem {
  id: string;
  name: string;
  probability: number;
  isActive: boolean;
}

interface ProbabilityEditorProps {
  items: ProbabilityItem[];
  onChange: (items: ProbabilityItem[]) => void;
}

const TOLERANCE = 0.001;

export function ProbabilityEditor({ items, onChange }: ProbabilityEditorProps): React.ReactElement {
  const activeItems = items.filter((i) => i.isActive);
  const total = activeItems.reduce((sum, i) => sum + i.probability, 0);
  const isValid = Math.abs(total - 1.0) <= TOLERANCE;

  const handleDrag = useCallback(
    (changedId: string, newValue: number) => {
      if (activeItems.length <= 1) return;

      const clamped = Math.max(0, Math.min(1, newValue));
      const others = activeItems.filter((i) => i.id !== changedId);
      const remaining = 1 - clamped;
      const otherTotal = others.reduce((s, i) => s + i.probability, 0);

      const updated = items.map((item) => {
        if (!item.isActive) return item;
        if (item.id === changedId) return { ...item, probability: clamped };

        // Redistribute remaining proportionally
        const share = otherTotal > 0
          ? (item.probability / otherTotal) * remaining
          : remaining / others.length;

        return { ...item, probability: Math.max(0, share) };
      });

      onChange(updated);
    },
    [activeItems, items, onChange]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {!isValid && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}>
          ⚠ Probabilities must sum to 100%. Current total: {(total * 100).toFixed(1)}%
        </div>
      )}

      {activeItems.map((item) => {
        const pct = (item.probability * 100).toFixed(1);
        const isOnly = activeItems.length === 1;

        return (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                {item.name}
              </span>
              <span style={{ fontSize: '0.875rem', color: '#6b7280', minWidth: '48px', textAlign: 'right' }}>
                {pct}%
              </span>
            </div>

            <div style={{ position: 'relative', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${item.probability * 100}%`,
                  backgroundColor: '#7c3aed',
                  borderRadius: '4px',
                  transition: 'width 0.1s ease',
                }}
              />
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={item.probability * 100}
              disabled={isOnly}
              onChange={(e) => handleDrag(item.id, parseFloat(e.target.value) / 100)}
              aria-label={`Probability for ${item.name}`}
              style={{
                width: '100%',
                cursor: isOnly ? 'not-allowed' : 'pointer',
                opacity: isOnly ? 0.5 : 1,
                accentColor: '#7c3aed',
              }}
            />
          </div>
        );
      })}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: '8px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '0.875rem',
      }}>
        <span style={{ color: '#6b7280' }}>Total</span>
        <span style={{ fontWeight: 700, color: isValid ? '#16a34a' : '#dc2626' }}>
          {(total * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
