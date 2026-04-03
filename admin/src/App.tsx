import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { BlindBoxList } from './pages/BlindBoxList';
import { BlindBoxDetail } from './pages/BlindBoxDetail';
import { StockManager } from './pages/StockManager';
import { OrderList } from './pages/OrderList';

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: 'block',
  padding: '8px 16px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: isActive ? '#7c3aed' : '#374151',
  backgroundColor: isActive ? '#ede9fe' : 'transparent',
  transition: 'background-color 0.15s ease, color 0.15s ease',
});

export default function App(): React.ReactElement {
  return (
    <BrowserRouter basename="/admin">
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {/* Sidebar */}
        <nav style={{
          width: '220px',
          flexShrink: 0,
          backgroundColor: '#fff',
          borderRight: '1px solid #e5e7eb',
          padding: '24px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{ padding: '0 8px 20px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: '8px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#7c3aed' }}>🎁 Blind Box</span>
          </div>

          <NavLink to="/blind-boxes" style={navLinkStyle}>
            Blind Boxes
          </NavLink>
          <NavLink to="/orders" style={navLinkStyle}>
            Orders
          </NavLink>
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, backgroundColor: '#f9fafb', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/blind-boxes" replace />} />
            <Route path="/blind-boxes" element={<BlindBoxList />} />
            <Route path="/blind-boxes/:id" element={<BlindBoxDetail />} />
            <Route path="/blind-boxes/:id/stock" element={<StockManager />} />
            <Route path="/orders" element={<OrderList />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
