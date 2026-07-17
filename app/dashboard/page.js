'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API = '';
const SESSION_KEY = 'ppt_dashboard_session_v1';

function StatusBadge({ status }) {
  const map = {
    confirmed: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', label: 'Подтверждено' },
    rejected: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Отклонено' },
    pending: { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: 'Ожидает' },
  };
  const s = map[status] || map.pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: s.color,
        }}
      />
      {s.label}
    </span>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e4e4e7',
        borderRadius: 16,
        padding: '18px 20px',
        borderLeft: accent ? `4px solid ${accent}` : '1px solid #e4e4e7',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || '#18181b', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: '#71717a', fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function DashboardMap({ branches, factory, deliveries }) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.L || !ref.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const L = window.L;
    const center = factory
      ? [factory.lat, factory.lng]
      : branches[0]
        ? [branches[0].lat, branches[0].lng]
        : [41.31, 69.28];
    const map = L.map(ref.current, { center, zoom: 12, zoomControl: true });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    if (factory) {
      L.marker([factory.lat, factory.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#dc2626;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:14px">🏭</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      })
        .addTo(map)
        .bindPopup(`<b>Фабрика</b><br/>${factory.address || ''}`);
    }

    branches.forEach((b) => {
      L.marker([b.lat, b.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#18181b;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2);font-size:12px">🏢</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .addTo(map)
        .bindPopup(`<b>${b.name}</b><br/>${b.address || ''}`);
    });

    deliveries.slice(0, 40).forEach((d) => {
      if (!d.driver_lat || !d.driver_lng) return;
      const color =
        d.status === 'confirmed' ? '#16a34a' : d.status === 'rejected' ? '#dc2626' : '#d97706';
      L.circleMarker([d.driver_lat, d.driver_lng], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.85,
      })
        .addTo(map)
        .bindPopup(
          `<b>${d.driver_name}</b> → ${d.branch_name}<br/>${d.status}<br/>${d.created_at}<br/>${d.distance} м`
        );
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [branches, factory, deliveries]);

  return (
    <div
      ref={ref}
      style={{
        height: 380,
        width: '100%',
        borderRadius: 16,
        border: '1px solid #e4e4e7',
        overflow: 'hidden',
        background: '#f4f4f5',
      }}
    />
  );
}

export default function DesktopDashboard() {
  const [session, setSession] = useState(null); // { phone, username }
  const [loginPhone, setLoginPhone] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [factory, setFactory] = useState(null);
  const [stats, setStats] = useState({ confirmed: 0, rejected: 0, pending: 0, total: 0 });
  const [todayStats, setTodayStats] = useState({ confirmed: 0, rejected: 0, pending: 0, total: 0 });
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all|pending|confirmed|rejected
  const [branchFilter, setBranchFilter] = useState('all');
  const [q, setQ] = useState('');
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [identity, setIdentity] = useState(null);

  // Restore session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  // Leaflet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Branches
  useEffect(() => {
    fetch(`${API}/api/branches`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        setBranches(d.branches || []);
        setFactory(d.factory || null);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      // verify director
      const roleRes = await fetch(`${API}/api/get-user-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: session.phone || null,
          username: session.username || null,
        }),
      });
      const role = await roleRes.json();
      if (!role.ok || role.role !== 'director') {
        setError('Доступ только для директоров');
        setIdentity(null);
        setLoading(false);
        return;
      }
      setIdentity(role);

      const r = await fetch(`${API}/api/all-deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: session.phone || null,
          username: session.username || null,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || 'Не удалось загрузить данные');
      } else {
        setStats(d.stats || { confirmed: 0, rejected: 0, pending: 0, total: 0 });
        setTodayStats(d.todayStats || { confirmed: 0, rejected: 0, pending: 0, total: 0 });
        setDeliveries(d.deliveries || []);
        setLastRefresh(new Date());
      }
    } catch {
      setError('Ошибка соединения');
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadData();
    if (!session) return undefined;
    const id = setInterval(loadData, 10000);
    return () => clearInterval(id);
  }, [session, loadData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const phone = loginPhone.replace(/\D/g, '');
    const username = loginUsername.replace(/^@/, '').trim();
    if (!phone && !username) {
      setLoginError('Укажите телефон директора или username');
      setLoginLoading(false);
      return;
    }
    try {
      const r = await fetch(`${API}/api/get-user-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || null, username: username || null }),
      });
      const d = await r.json();
      if (!d.ok || d.role !== 'director') {
        setLoginError('Это не аккаунт директора. Доступ запрещён.');
        setLoginLoading(false);
        return;
      }
      const s = { phone: phone || null, username: username || null };
      setSession(s);
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } catch {}
    } catch {
      setLoginError('Ошибка соединения');
    }
    setLoginLoading(false);
  };

  const logout = () => {
    setSession(null);
    setIdentity(null);
    setDeliveries([]);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  };

  const filtered = useMemo(() => {
    return deliveries.filter((d) => {
      if (filter !== 'all' && d.status !== filter) return false;
      if (branchFilter !== 'all' && String(d.branch_id) !== String(branchFilter)) return false;
      if (q) {
        const s = q.toLowerCase();
        const hay = `${d.driver_name || ''} ${d.branch_name || ''} ${d.confirmed_by_name || ''} #${d.id}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [deliveries, filter, branchFilter, q]);

  const byBranch = useMemo(() => {
    const map = {};
    deliveries.forEach((d) => {
      const key = d.branch_name || `id ${d.branch_id}`;
      if (!map[key]) map[key] = { name: key, total: 0, confirmed: 0, rejected: 0, pending: 0 };
      map[key].total += 1;
      if (map[key][d.status] != null) map[key][d.status] += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [deliveries]);

  // ── Login screen ──
  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.loginWrap}>
          <div style={styles.loginCard}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <h1 style={styles.loginTitle}>Панель директора</h1>
            <p style={styles.loginSub}>
              Desktop-дашборд Pasta Pasta Tracker. Вход только для директоров
              (@grxt777 / @javdat_n).
            </p>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={styles.label}>Телефон директора</label>
              <input
                style={styles.input}
                type="tel"
                placeholder="+998 93 376 21 09"
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
              />
              <div style={{ textAlign: 'center', color: '#a1a1aa', fontSize: 12, fontWeight: 600 }}>или</div>
              <label style={styles.label}>Telegram username</label>
              <input
                style={styles.input}
                type="text"
                placeholder="grxt777"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              />
              {loginError && <div style={styles.errorBox}>{loginError}</div>}
              <button type="submit" style={styles.primaryBtn} disabled={loginLoading}>
                {loginLoading ? 'Проверка…' : 'Войти в дашборд'}
              </button>
            </form>
            <a href="/" style={styles.mutedLink}>
              ← Открыть Mini App
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <header style={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.logo}>🍝</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
              Pasta Pasta · Desktop Dashboard
            </div>
            <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>
              {identity?.label || 'Директор'}
              {session.phone ? ` · +${session.phone}` : ''}
              {session.username ? ` · @${session.username}` : ''}
              {lastRefresh ? ` · обновлено ${lastRefresh.toLocaleTimeString('ru-RU')}` : ''}
              {loading ? ' · загрузка…' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={styles.secondaryBtn} onClick={loadData} disabled={loading}>
            Обновить
          </button>
          <a href="/" style={styles.secondaryBtnLink}>
            Mini App
          </a>
          <button style={styles.ghostBtn} onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Today */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Сегодня</div>
          <div style={styles.statGrid}>
            <StatCard label="Всего сегодня" value={todayStats.total} />
            <StatCard label="Подтверждено" value={todayStats.confirmed} accent="#16a34a" />
            <StatCard label="Ожидает" value={todayStats.pending} accent="#d97706" />
            <StatCard label="Отклонено" value={todayStats.rejected} accent="#dc2626" />
          </div>
        </section>

        {/* All time */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Всего в базе</div>
          <div style={styles.statGrid}>
            <StatCard label="Все события" value={stats.total} />
            <StatCard label="Подтверждено" value={stats.confirmed} accent="#16a34a" />
            <StatCard label="Ожидает" value={stats.pending} accent="#d97706" />
            <StatCard label="Отклонено" value={stats.rejected} accent="#dc2626" />
          </div>
        </section>

        <div style={styles.twoCol}>
          {/* Map */}
          <section style={{ ...styles.card, flex: 1.4 }}>
            <div style={styles.cardHeader}>
              <div style={styles.sectionTitle}>Карта активности</div>
              <div style={{ fontSize: 12, color: '#71717a' }}>
                🟢 confirmed · 🟠 pending · 🔴 rejected
              </div>
            </div>
            {leafletLoaded ? (
              <DashboardMap branches={branches} factory={factory} deliveries={deliveries} />
            ) : (
              <div style={styles.mapPlaceholder}>Загрузка карты…</div>
            )}
          </section>

          {/* By branch */}
          <section style={{ ...styles.card, flex: 1 }}>
            <div style={styles.sectionTitle}>По филиалам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {byBranch.length === 0 && (
                <div style={{ color: '#a1a1aa', fontSize: 13 }}>Пока нет событий</div>
              )}
              {byBranch.map((b) => (
                <div key={b.name} style={styles.branchRow}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</div>
                  <div style={styles.branchMeta}>
                    <span>всего {b.total}</span>
                    <span style={{ color: '#16a34a' }}>✓ {b.confirmed}</span>
                    <span style={{ color: '#d97706' }}>⏳ {b.pending}</span>
                    <span style={{ color: '#dc2626' }}>✕ {b.rejected}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Feed */}
        <section style={{ ...styles.card, marginTop: 20 }}>
          <div style={styles.cardHeader}>
            <div style={styles.sectionTitle}>Лента событий ({filtered.length})</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select style={styles.select} value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Все статусы</option>
                <option value="pending">Ожидает</option>
                <option value="confirmed">Подтверждено</option>
                <option value="rejected">Отклонено</option>
              </select>
              <select
                style={styles.select}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="all">Все точки</option>
                {factory && <option value={factory.id}>🏭 {factory.name}</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                style={{ ...styles.input, minWidth: 200, margin: 0 }}
                placeholder="Поиск: водитель, филиал, #id"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Тип</th>
                  <th style={styles.th}>Статус</th>
                  <th style={styles.th}>Водитель</th>
                  <th style={styles.th}>Точка</th>
                  <th style={styles.th}>Дистанция</th>
                  <th style={styles.th}>Время</th>
                  <th style={styles.th}>Управляющий</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ ...styles.td, textAlign: 'center', color: '#a1a1aa' }}>
                      Нет событий по фильтру
                    </td>
                  </tr>
                )}
                {filtered.map((d) => (
                  <tr key={d.id} style={styles.tr}>
                    <td style={styles.td}>#{d.id}</td>
                    <td style={styles.td}>
                      {d.type === 'pickup' ? '📦 Забор' : '🚚 Доставка'}
                    </td>
                    <td style={styles.td}>
                      <StatusBadge status={d.status} />
                    </td>
                    <td style={styles.td}>{d.driver_name}</td>
                    <td style={styles.td}>{d.branch_name}</td>
                    <td style={styles.td}>{d.distance != null ? `${d.distance} м` : '—'}</td>
                    <td style={styles.td}>{d.created_at}</td>
                    <td style={styles.td}>{d.confirmed_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer style={styles.footer}>
          Auto-refresh каждые 10 сек · данные из Supabase ·{' '}
          <a href="https://pasta-pasta-tracker.vercel.app/dashboard" style={{ color: '#2563eb' }}>
            pasta-pasta-tracker.vercel.app/dashboard
          </a>
        </footer>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f4f4f5',
    color: '#18181b',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  topbar: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 28px',
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #e4e4e7',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#18181b',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  main: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '24px 28px 48px',
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#71717a',
    marginBottom: 10,
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  twoCol: {
    display: 'flex',
    gap: 16,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  card: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 18,
    padding: 18,
    minWidth: 280,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  branchRow: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #f4f4f5',
    background: '#fafafa',
  },
  branchMeta: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
    fontSize: 12,
    color: '#52525b',
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid #e4e4e7',
    color: '#71717a',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #f4f4f5',
    verticalAlign: 'middle',
  },
  tr: {},
  input: {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  },
  select: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    fontSize: 13,
    fontWeight: 600,
    background: '#fff',
    outline: 'none',
  },
  primaryBtn: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: 'none',
    background: '#18181b',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
  },
  secondaryBtn: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    background: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtnLink: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    background: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    color: '#18181b',
    display: 'inline-block',
  },
  ghostBtn: {
    padding: '8px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    color: '#71717a',
  },
  loginWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 20,
    padding: 28,
    boxShadow: '0 20px 50px rgba(0,0,0,0.06)',
    textAlign: 'center',
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 800,
    margin: '0 0 8px',
    letterSpacing: '-0.4px',
  },
  loginSub: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  label: {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 800,
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 12,
  },
  mutedLink: {
    display: 'inline-block',
    marginTop: 16,
    color: '#71717a',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
  mapPlaceholder: {
    height: 380,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a1a1aa',
    borderRadius: 16,
    border: '1px dashed #e4e4e7',
  },
  footer: {
    marginTop: 28,
    textAlign: 'center',
    fontSize: 12,
    color: '#a1a1aa',
  },
};
