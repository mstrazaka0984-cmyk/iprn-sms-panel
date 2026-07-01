import React, { useEffect, useState, useCallback } from 'react';
import { fetchMessages, fetchSummary, fetchPlatforms, exportUrl } from './api.js';

const EMPTY_FILTERS = {
  numberFrom: '',
  numberTo: '',
  dateFrom: '',
  dateTo: '',
  payoutMin: '',
  payoutMax: '',
  platform: '',
  status: '',
  search: '',
};

export default function App() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [platforms, setPlatforms] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ message_count: 0, total_payout: 0, unique_numbers: 0 });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlatforms().then(setPlatforms).catch(() => setPlatforms([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [msgRes, summaryRes] = await Promise.all([
        fetchMessages(appliedFilters, page, pageSize),
        fetchSummary(appliedFilters),
      ]);
      setRows(msgRes.rows);
      setTotal(msgRes.total);
      setSummary(summaryRes);
    } catch (err) {
      setError('Could not reach the API. Is the backend running on port 4000?');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilterChange(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function applyFilters() {
    setPage(1);
    setAppliedFilters(filters);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">IPRN</span>
          <span className="brand-name">SMS Panel</span>
        </div>
        <div className="topbar-sub">prototype build</div>
      </header>

      <main className="layout">
        <section className="cards">
          <SummaryCard label="Messages (filtered)" value={summary.message_count} />
          <SummaryCard label="Total payout" value={`$${Number(summary.total_payout).toFixed(2)}`} accent />
          <SummaryCard label="Unique numbers" value={summary.unique_numbers} />
        </section>

        <section className="filters">
          <div className="filters-grid">
            <Field label="Number from">
              <input
                value={filters.numberFrom}
                onChange={(e) => handleFilterChange('numberFrom', e.target.value)}
                placeholder="e.g. 923000000000"
                inputMode="numeric"
              />
            </Field>
            <Field label="Number to">
              <input
                value={filters.numberTo}
                onChange={(e) => handleFilterChange('numberTo', e.target.value)}
                placeholder="e.g. 923009999999"
                inputMode="numeric"
              />
            </Field>
            <Field label="Date from">
              <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
            </Field>
            <Field label="Date to">
              <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
            </Field>
            <Field label="Payout min">
              <input
                value={filters.payoutMin}
                onChange={(e) => handleFilterChange('payoutMin', e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
            <Field label="Payout max">
              <input
                value={filters.payoutMax}
                onChange={(e) => handleFilterChange('payoutMax', e.target.value)}
                placeholder="1.00"
                inputMode="decimal"
              />
            </Field>
            <Field label="Platform">
              <select value={filters.platform} onChange={(e) => handleFilterChange('platform', e.target.value)}>
                <option value="">All platforms</option>
                {platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                <option value="">All statuses</option>
                <option value="received">received</option>
                <option value="duplicate">duplicate</option>
                <option value="failed">failed</option>
                <option value="flagged">flagged</option>
              </select>
            </Field>
            <Field label="Search">
              <input
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="number, OTP, or message text"
              />
            </Field>
          </div>

          <div className="filters-actions">
            <button className="btn primary" onClick={applyFilters}>Apply filters</button>
            <button className="btn ghost" onClick={clearFilters}>Clear</button>
            <div className="spacer" />
            <a className="btn export" href={exportUrl('excel', appliedFilters)}>Export Excel</a>
            <a className="btn export" href={exportUrl('pdf', appliedFilters)}>Export PDF</a>
          </div>
        </section>

        <section className="table-wrap">
          {error && <div className="banner error">{error}</div>}
          {loading ? (
            <div className="banner">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="banner">No messages match these filters.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Platform</th>
                  <th>Receiver</th>
                  <th>OTP</th>
                  <th>Message</th>
                  <th>Payout</th>
                  <th>Status</th>
                  <th>Received at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono dim">{r.id}</td>
                    <td>{r.platform_name}</td>
                    <td className="mono">{r.receiver_number}</td>
                    <td className="mono otp">{r.otp_code || '—'}</td>
                    <td className="message-cell" title={r.message_text}>{r.message_text}</td>
                    <td className="mono">${Number(r.payout).toFixed(4)}</td>
                    <td><span className={`status status-${r.status}`}>{r.status}</span></td>
                    <td className="mono dim">{new Date(r.received_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="pagination">
            <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="page-info">Page {page} of {totalPages} · {total} total</span>
            <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className={`card ${accent ? 'card-accent' : ''}`}>
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
