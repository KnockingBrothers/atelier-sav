// Remplace l'API window.storage de Claude par des appels vers l'API
// du serveur (server/server.js), elle-même adossée à une base SQLite.
// Toutes les fiches sont ainsi centralisées et visibles depuis tous les postes.

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`storage error: ${res.status}`);
  return res.json();
}

window.storage = {
  async get(key) {
    const data = await request("GET", `/api/storage/${encodeURIComponent(key)}`);
    if (!data) return null;
    return { key, value: data.value, shared: true };
  },
  async set(key, value) {
    const data = await request("PUT", `/api/storage/${encodeURIComponent(key)}`, { value });
    return { key, value: data.value, shared: true };
  },
  async delete(key) {
    await request("DELETE", `/api/storage/${encodeURIComponent(key)}`);
    return { key, deleted: true, shared: true };
  },
  async list(prefix = "") {
    const data = await request("GET", `/api/storage?prefix=${encodeURIComponent(prefix)}`);
    return { keys: (data && data.keys) || [], prefix, shared: true };
  },
};
