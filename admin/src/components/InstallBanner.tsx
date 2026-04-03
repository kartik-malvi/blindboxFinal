import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'blind-box-install-banner-dismissed';
const APP_URL = import.meta.env.VITE_APP_URL || 'https://yourapp.com';

export function InstallBanner(): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(true); // default hidden until check

  useEffect(() => {
    const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(APP_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (dismissed) return null;

  return (
    <div style={{
      backgroundColor: '#ede9fe',
      border: '1px solid #c4b5fd',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#4c1d95' }}>
          Install the Blind Box Widget in Your Theme
        </h2>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#7c3aed',
            fontSize: '1.25rem',
            lineHeight: 1,
            padding: '2px 6px',
          }}
          aria-label="Dismiss install banner"
        >
          ×
        </button>
      </div>

      <ol style={{ margin: '0 0 20px 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <li style={{ color: '#374151', lineHeight: 1.6 }}>
          <strong>Go to your Shopline Admin</strong> → Online Store → Design
        </li>
        <li style={{ color: '#374151', lineHeight: 1.6 }}>
          Click <strong>"Add component"</strong> → <strong>"Apps" tab</strong> → select <strong>Blind Box Widget</strong>
        </li>
        <li style={{ color: '#374151', lineHeight: 1.6 }}>
          Paste your API URL into the block settings field:
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <input
              readOnly
              value={APP_URL}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #c4b5fd',
                borderRadius: '6px',
                backgroundColor: '#fff',
                fontSize: '0.875rem',
                color: '#374151',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 16px',
                backgroundColor: '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </li>
      </ol>

      <button
        onClick={handleDismiss}
        style={{
          padding: '10px 24px',
          backgroundColor: '#7c3aed',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        Got it
      </button>
    </div>
  );
}
