import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getHealth } from '../services/health.service.js';

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Products', path: '/products' },
  { label: 'Receipts', path: '/receipts' },
  { label: 'Deliveries', path: '/deliveries' },
  { label: 'Transfers', path: '/transfers' },
  { label: 'Adjustments', path: '/adjustments' },
  { label: 'Ledger', path: '/ledger' }
];

const PlaceholderPage = ({ title }) => (
  <section className="page">
    <p className="eyebrow">StockSense foundation</p>
    <h1>{title}</h1>
    <p className="muted">This module is ready for its approved implementation.</p>
  </section>
);

const DashboardPlaceholder = () => {
  const [health, setHealth] = useState({ state: 'checking' });

  useEffect(() => {
    getHealth()
      .then((result) => setHealth({ state: result.status, database: result.database }))
      .catch(() => setHealth({ state: 'unavailable' }));
  }, []);

  return (
    <section className="page">
      <p className="eyebrow">Inventory workspace</p>
      <h1>Dashboard</h1>
      <p className="muted">Core inventory workflows will be added after the foundation.</p>
      <div className="status-panel" aria-live="polite">
        <span className={'status-dot status-' + health.state} />
        <div>
          <strong>API status</strong>
          <span>{health.state === 'ok' ? 'Connected' : health.state}</span>
          {health.database && <span>Database: {health.database}</span>}
        </div>
      </div>
    </section>
  );
};

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            <strong>StockSense</strong>
            <span>Inventory control</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              key={item.path}
              to={item.path}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>Inventory workspace</span>
          <span className="demo-user">Foundation mode</span>
        </header>
        <Routes>
          <Route path="/" element={<Navigate replace to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPlaceholder />} />
          <Route path="/products" element={<PlaceholderPage title="Products" />} />
          <Route path="/receipts" element={<PlaceholderPage title="Receipts" />} />
          <Route path="/deliveries" element={<PlaceholderPage title="Deliveries" />} />
          <Route path="/transfers" element={<PlaceholderPage title="Internal transfers" />} />
          <Route path="/adjustments" element={<PlaceholderPage title="Adjustments" />} />
          <Route path="/ledger" element={<PlaceholderPage title="Stock ledger" />} />
          <Route path="*" element={<Navigate replace to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}
