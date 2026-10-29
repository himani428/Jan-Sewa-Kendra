const KEY = 'jansewa_token';
export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

async function req(path, { method = 'GET', body, raw } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw Object.assign(new Error('network'), { code: 'network' }); }
  if (res.status === 401 && path !== '/login') { setToken(null); window.dispatchEvent(new Event('jansewa:logout')); }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw Object.assign(new Error(d.error || 'generic'), { code: d.error || 'generic', status: res.status }); }
  return raw ? res : res.json();
}
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();
const A = (id) => `/applications/${encodeURIComponent(id)}`;
export const api = {
  login: (b) => req('/login', { method: 'POST', body: b }), me: () => req('/me'), onboarded: (value) => req('/me/onboarded', { method: 'POST', body: { value } }),
  officers: () => req('/officers'), badges: () => req('/badges'), overview: () => req('/overview'),
  list: (query) => req('/applications?' + (typeof query === 'string' ? query : qs(query))), get: (id) => req(A(id)),
  analyze: (id, body = {}) => req(`${A(id)}/analyze`, { method: 'POST', body }), decide: (id, b) => req(`${A(id)}/decision`, { method: 'POST', body: b }),
  simulate: (id) => req(`${A(id)}/simulate-resubmission`, { method: 'POST' }), finding: (id, b) => req(`${A(id)}/findings`, { method: 'POST', body: b }),
  verify: (id, key, b) => req(`${A(id)}/docs/${key}/verify`, { method: 'POST', body: b }), note: (id, text) => req(`${A(id)}/notes`, { method: 'POST', body: { text } }),
  task: (id, b) => req(`${A(id)}/tasks`, { method: 'POST', body: b }), taskDone: (id, done) => req(`/tasks/${id}`, { method: 'PATCH', body: { done } }), tasks: (scope) => req('/tasks?scope=' + (scope || 'mine')),
  assign: (id, assignee) => req(`${A(id)}/assign`, { method: 'POST', body: { assignee } }), bulk: (b) => req('/bulk', { method: 'POST', body: b }),
  documents: () => req('/documents'), notifications: () => req('/notifications'), readNotifs: (b) => req('/notifications/read', { method: 'POST', body: b }),
  views: () => req('/views'), addView: (b) => req('/views', { method: 'POST', body: b }), renameView: (id, name) => req(`/views/${id}`, { method: 'PATCH', body: { name } }), delView: (id) => req(`/views/${id}`, { method: 'DELETE' }),
  audit: (query) => req('/audit?' + qs(query)), reports: (query) => req('/reports?' + qs(query)), reset: () => req('/reset', { method: 'POST' }),
  exportCsv: async (query) => (await req('/export/applications.csv?' + qs(query), { raw: true })).blob(),
};
export { qs };
