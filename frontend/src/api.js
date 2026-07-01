const BASE = '/api';

function toQueryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export async function fetchMessages(filters, page, pageSize) {
  const qs = toQueryString({ ...filters, page, pageSize });
  const res = await fetch(`${BASE}/messages?${qs}`);
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
}

export async function fetchSummary(filters) {
  const qs = toQueryString(filters);
  const res = await fetch(`${BASE}/messages/summary?${qs}`);
  if (!res.ok) throw new Error('Failed to load summary');
  return res.json();
}

export async function fetchPlatforms() {
  const res = await fetch(`${BASE}/messages/meta/platforms`);
  if (!res.ok) throw new Error('Failed to load platforms');
  return res.json();
}

export function exportUrl(kind, filters) {
  const qs = toQueryString(filters);
  return `${BASE}/export/${kind}?${qs}`;
}
