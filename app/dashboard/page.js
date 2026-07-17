'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API = '';
const SESSION_KEY = 'ppt_dashboard_session_v1';

function StatusBadge({ status }) {
  const map = {
    confirmed: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', label: 'Подтверждено' },
    rejected: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Отклонено' },
    pending: { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: 'Ожидает' },
    online: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', label: 'Online' },
    offline: { bg: '#f4f4f5', color: '#71717a', border: '#e4e4e7', label: 'Offline' },
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
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
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

function DashboardMap({ branches, factory, deliveries, liveDrivers = [], focusDriverId = null }) {
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

    deliveries.slice(0, 30).forEach((d) => {
      if (!d.driver_lat || !d.driver_lng) return;
      const color =
        d.status === 'confirmed' ? '#16a34a' : d.status === 'rejected' ? '#dc2626' : '#d97706';
      L.circleMarker([d.driver_lat, d.driver_lng], {
        radius: 6,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.8,
      })
        .addTo(map)
        .bindPopup(
          `<b>${d.driver_name}</b> → ${d.branch_name}<br/>${d.status}<br/>${d.created_at}<br/>${d.distance} м`
        );
    });

    // Live driver paths + current position
    const focus = liveDrivers.find((d) => Number(d.driver_id) === Number(focusDriverId));
    const list = focus ? [focus] : liveDrivers;
    list.forEach((d) => {
      if (d.path?.length > 1) {
        const latlngs = d.path.map((p) => [p.lat, p.lng]);
        L.polyline(latlngs, {
          color: d.online ? '#2563eb' : '#94a3b8',
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
      }
      if (d.lat && d.lng) {
        L.marker([d.lat, d.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${d.online ? '#2563eb' : '#64748b'};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:14px">🚚</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<b>${d.driver_name}</b><br/>${d.online ? 'Online' : 'Offline'} · ${d.distance_km} км · ${d.duration_label}<br/>${d.last_seen}`
          );
      }
    });

    if (focus?.path?.length > 1) {
      try {
        map.fitBounds(L.latLngBounds(focus.path.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
      } catch {}
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [branches, factory, deliveries, liveDrivers, focusDriverId]);

  return (
    <div
      ref={ref}
      style={{
        height: 400,
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
  const [session, setSession] = useState(null);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState('activity'); // activity | live | roles
  const [branches, setBranches] = useState([]);
  const [factory, setFactory] = useState(null);
  const [stats, setStats] = useState({ confirmed: 0, rejected: 0, pending: 0, total: 0 });
  const [todayStats, setTodayStats] = useState({ confirmed: 0, rejected: 0, pending: 0, total: 0 });
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [q, setQ] = useState('');
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [identity, setIdentity] = useState(null);

  // Live tracking
  const [liveDrivers, setLiveDrivers] = useState([]);
  const [liveMsg, setLiveMsg] = useState('');
  const [focusDriverId, setFocusDriverId] = useState(null);
  const [sinceMinutes, setSinceMinutes] = useState(180);

  // Roles
  const [rosterPeople, setRosterPeople] = useState([]);
  const [accessList, setAccessList] = useState([]);
  const [formTgId, setFormTgId] = useState('');
  const [formTgUsername, setFormTgUsername] = useState('');
  const [formRole, setFormRole] = useState('manager');
  const [formBranchId, setFormBranchId] = useState(1);
  const [roleMsg, setRoleMsg] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

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

  useEffect(() => {
    fetch(`${API}/api/branches`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        setBranches(d.branches || []);
        setFactory(d.factory || null);
        if (d.factory) setFormBranchId(d.factory.id);
      })
      .catch(() => {});
  }, []);

  const authBody = useCallback(() => {
    if (!session) return {};
    return {
      phone: session.phone || null,
      username: session.username || null,
      telegram_id: session.telegram_id || null,
      director_telegram_id: session.telegram_id || null,
    };
  }, [session]);

  const loadActivity = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const roleRes = await fetch(`${API}/api/get-user-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody()),
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
        body: JSON.stringify(authBody()),
      });
      const d = await r.json();
      if (!d.ok) setError(d.error || 'Не удалось загрузить данные');
      else {
        setStats(d.stats || { confirmed: 0, rejected: 0, pending: 0, total: 0 });
        setTodayStats(d.todayStats || { confirmed: 0, rejected: 0, pending: 0, total: 0 });
        setDeliveries(d.deliveries || []);
        setLastRefresh(new Date());
      }
    } catch {
      setError('Ошибка соединения');
    }
    setLoading(false);
  }, [session, authBody]);

  const loadLive = useCallback(async () => {
    if (!session) return;
    try {
      const r = await fetch(`${API}/api/driver-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authBody(), since_minutes: sinceMinutes }),
      });
      const d = await r.json();
      if (!d.ok) {
        setLiveMsg(d.error || 'Ошибка live');
        return;
      }
      if (d.table_missing) {
        setLiveMsg(
          'Нужна SQL-миграция: supabase/migrate_driver_tracks.sql в Supabase SQL Editor'
        );
        setLiveDrivers([]);
        return;
      }
      setLiveDrivers(d.drivers || []);
      setLiveMsg(
        `Обновлено ${new Date(d.generated_at || Date.now()).toLocaleTimeString('ru-RU')} · окно ${d.since_minutes} мин`
      );
      if (d.branches) setBranches(d.branches);
      if (d.factory) setFactory(d.factory);
      setLastRefresh(new Date());
    } catch {
      setLiveMsg('Ошибка соединения live');
    }
  }, [session, authBody, sinceMinutes]);

  const loadRoles = useCallback(async () => {
    if (!session) return;
    try {
      const r = await fetch(`${API}/api/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authBody()),
      });
      const d = await r.json();
      if (!d.ok) {
        setRoleMsg(d.error || 'Ошибка roster');
        return;
      }
      setRosterPeople(d.people || []);
      setAccessList(d.accessList || []);
      if (d.branches) setBranches(d.branches);
      if (d.factory) setFactory(d.factory);
    } catch {
      setRoleMsg('Ошибка соединения roles');
    }
  }, [session, authBody]);

  useEffect(() => {
    if (!session) return undefined;
    loadActivity();
    const id = setInterval(() => {
      if (tab === 'activity') loadActivity();
      if (tab === 'live') loadLive();
    }, tab === 'live' ? 8000 : 10000);
    return () => clearInterval(id);
  }, [session, tab, loadActivity, loadLive]);

  useEffect(() => {
    if (!session) return;
    if (tab === 'live') loadLive();
    if (tab === 'roles') loadRoles();
  }, [tab, session, loadLive, loadRoles]);

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
    setLiveDrivers([]);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    setRoleMsg('');
    if (!formTgId) {
      setRoleMsg('Нужен Telegram User ID');
      return;
    }
    try {
      const r = await fetch(`${API}/api/grant-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authBody(),
          target_telegram_id: Number(formTgId),
          telegram_username: formTgUsername || null,
          role: formRole,
          branch_id: formRole === 'manager' ? Number(formBranchId) : null,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setRoleMsg('Роль выдана');
        setFormTgId('');
        setFormTgUsername('');
        loadRoles();
      } else setRoleMsg(d.error || 'Ошибка');
    } catch {
      setRoleMsg('Ошибка соединения');
    }
  };

  const handleRevoke = async (tgId) => {
    if (!confirm('Удалить доступ?')) return;
    try {
      const r = await fetch(`${API}/api/revoke-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authBody(),
          target_telegram_id: tgId,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setRoleMsg('Доступ удалён');
        loadRoles();
      } else setRoleMsg(d.error || 'Ошибка');
    } catch {
      setRoleMsg('Ошибка соединения');
    }
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

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.loginWrap}>
          <div style={styles.loginCard}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <h1 style={styles.loginTitle}>Панель директора</h1>
            <p style={styles.loginSub}>
              Desktop-дашборд: события, live-трекинг развозчиков, назначение ролей.
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
              {lastRefresh ? ` · ${lastRefresh.toLocaleTimeString('ru-RU')}` : ''}
              {loading ? ' · загрузка…' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            style={styles.secondaryBtn}
            onClick={() => {
              if (tab === 'activity') loadActivity();
              if (tab === 'live') loadLive();
              if (tab === 'roles') loadRoles();
            }}
          >
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

      <div style={styles.tabsBar}>
        {[
          { id: 'activity', label: '📦 События' },
          { id: 'live', label: '🚚 Live трекинг' },
          { id: 'roles', label: '👥 Роли' },
        ].map((t) => (
          <button
            key={t.id}
            style={tab === t.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main style={styles.main}>
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* ─── ACTIVITY ─── */}
        {tab === 'activity' && (
          <>
            <section style={styles.section}>
              <div style={styles.sectionTitle}>Сегодня</div>
              <div style={styles.statGrid}>
                <StatCard label="Всего сегодня" value={todayStats.total} />
                <StatCard label="Подтверждено" value={todayStats.confirmed} accent="#16a34a" />
                <StatCard label="Ожидает" value={todayStats.pending} accent="#d97706" />
                <StatCard label="Отклонено" value={todayStats.rejected} accent="#dc2626" />
              </div>
            </section>

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
              <section style={{ ...styles.card, flex: 1.4 }}>
                <div style={styles.cardHeader}>
                  <div style={styles.sectionTitle}>Карта активности</div>
                </div>
                {leafletLoaded ? (
                  <DashboardMap branches={branches} factory={factory} deliveries={deliveries} />
                ) : (
                  <div style={styles.mapPlaceholder}>Загрузка карты…</div>
                )}
              </section>
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
                    placeholder="Поиск"
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
                          Нет событий
                        </td>
                      </tr>
                    )}
                    {filtered.map((d) => (
                      <tr key={d.id}>
                        <td style={styles.td}>#{d.id}</td>
                        <td style={styles.td}>{d.type === 'pickup' ? '📦 Забор' : '🚚 Доставка'}</td>
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
          </>
        )}

        {/* ─── LIVE TRACKING ─── */}
        {tab === 'live' && (
          <>
            <div style={{ ...styles.infoBox, marginBottom: 16 }}>
              <b>Как это работает:</b> пока развозчик открыл Mini App (можно свернуть, не убивать),
              GPS-точки уходят на сервер каждые ~8–20 сек. Здесь видно где он сейчас, сколько км
              проехал и сколько времени в пути. Полностью закрытый Telegram/OS может остановить
              фон — это ограничение мобильных ОС, не сервера.
            </div>
            {liveMsg && <div style={{ fontSize: 12, color: '#71717a', marginBottom: 12 }}>{liveMsg}</div>}

            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#71717a' }}>Окно:</label>
              <select
                style={styles.select}
                value={sinceMinutes}
                onChange={(e) => setSinceMinutes(Number(e.target.value))}
              >
                <option value={60}>1 час</option>
                <option value={180}>3 часа</option>
                <option value={360}>6 часов</option>
                <option value={720}>12 часов</option>
                <option value={1440}>24 часа</option>
              </select>
              <button style={styles.secondaryBtn} onClick={loadLive}>
                Обновить live
              </button>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>
                online = точка ≤ 90 сек назад · auto 8 сек
              </span>
            </div>

            <div style={styles.twoCol}>
              <section style={{ ...styles.card, flex: 1.5 }}>
                <div style={styles.sectionTitle}>Карта маршрута</div>
                {leafletLoaded ? (
                  <DashboardMap
                    branches={branches}
                    factory={factory}
                    deliveries={[]}
                    liveDrivers={liveDrivers}
                    focusDriverId={focusDriverId}
                  />
                ) : (
                  <div style={styles.mapPlaceholder}>Загрузка карты…</div>
                )}
              </section>

              <section style={{ ...styles.card, flex: 1 }}>
                <div style={styles.sectionTitle}>Развозчики сейчас</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {liveDrivers.length === 0 && (
                    <div style={{ color: '#a1a1aa', fontSize: 13, lineHeight: 1.5 }}>
                      Нет GPS-точек. Пусть развозчик откроет Mini App с геолокацией.
                      {liveMsg?.includes('SQL') ? ` ${liveMsg}` : ''}
                    </div>
                  )}
                  {liveDrivers.map((d) => (
                    <button
                      key={d.driver_id}
                      type="button"
                      onClick={() =>
                        setFocusDriverId(
                          Number(focusDriverId) === Number(d.driver_id) ? null : d.driver_id
                        )
                      }
                      style={{
                        ...styles.branchRow,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border:
                          Number(focusDriverId) === Number(d.driver_id)
                            ? '2px solid #2563eb'
                            : '1px solid #f4f4f5',
                        background: '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>🚚 {d.driver_name}</div>
                        <StatusBadge status={d.online ? 'online' : 'offline'} />
                      </div>
                      <div style={{ fontSize: 12, color: '#52525b', marginTop: 6, lineHeight: 1.45 }}>
                        <div>
                          📏 <b>{d.distance_km} км</b> · ⏱ {d.duration_label} · ⚡ {d.avg_kmh} км/ч
                        </div>
                        <div>
                          📍 {d.lat?.toFixed?.(5)}, {d.lng?.toFixed?.(5)} · точек: {d.points_count}
                        </div>
                        <div>
                          🕐 last: {d.last_seen} ({d.age_sec}s ago)
                          {d.phone ? ` · ${d.phone}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <section style={{ ...styles.card, marginTop: 16 }}>
              <div style={styles.sectionTitle}>Детали маршрута</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Развозчик</th>
                      <th style={styles.th}>Статус</th>
                      <th style={styles.th}>Км</th>
                      <th style={styles.th}>Время в пути</th>
                      <th style={styles.th}>Ср. скорость</th>
                      <th style={styles.th}>Точек</th>
                      <th style={styles.th}>Последняя точка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveDrivers.map((d) => (
                      <tr key={d.driver_id}>
                        <td style={styles.td}>{d.driver_name}</td>
                        <td style={styles.td}>
                          <StatusBadge status={d.online ? 'online' : 'offline'} />
                        </td>
                        <td style={styles.td}>{d.distance_km}</td>
                        <td style={styles.td}>{d.duration_label}</td>
                        <td style={styles.td}>{d.avg_kmh} км/ч</td>
                        <td style={styles.td}>{d.points_count}</td>
                        <td style={styles.td}>{d.last_seen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ─── ROLES ─── */}
        {tab === 'roles' && (
          <>
            <section style={styles.section}>
              <div style={styles.sectionTitle}>Кто есть кто (статический roster)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Роль</th>
                      <th style={styles.th}>Имя / username</th>
                      <th style={styles.th}>Телефон</th>
                      <th style={styles.th}>Точка</th>
                      <th style={styles.th}>За что отвечает</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterPeople.map((p, i) => (
                      <tr key={`${p.role}-${p.username || p.phone || i}`}>
                        <td style={styles.td}>
                          {p.role === 'director'
                            ? '👑 Директор'
                            : p.role === 'driver'
                              ? '🚚 Развозчик'
                              : '🏢 Управляющий'}
                        </td>
                        <td style={styles.td}>
                          {p.username ? `@${p.username}` : p.name}
                        </td>
                        <td style={styles.td}>{p.phone || '—'}</td>
                        <td style={styles.td}>{p.branch_name || '—'}</td>
                        <td style={{ ...styles.td, maxWidth: 360 }}>{p.responsibility}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div style={styles.twoCol}>
              <section style={{ ...styles.card, flex: 1 }}>
                <div style={styles.sectionTitle}>Выдать / изменить роль</div>
                <form onSubmit={handleGrant} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  <label style={styles.label}>Telegram User ID (цифры)</label>
                  <input
                    style={styles.input}
                    type="number"
                    required
                    placeholder="123456789"
                    value={formTgId}
                    onChange={(e) => setFormTgId(e.target.value)}
                  />
                  <label style={styles.label}>Username (опционально)</label>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="ivan_manager"
                    value={formTgUsername}
                    onChange={(e) => setFormTgUsername(e.target.value)}
                  />
                  <label style={styles.label}>Роль</label>
                  <select style={styles.select} value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                    <option value="manager">🏢 Управляющий</option>
                    <option value="driver">🚚 Развозчик</option>
                    <option value="director">👑 Директор</option>
                  </select>
                  {formRole === 'manager' && (
                    <>
                      <label style={styles.label}>Филиал / точка</label>
                      <select
                        style={styles.select}
                        value={formBranchId}
                        onChange={(e) => setFormBranchId(Number(e.target.value))}
                      >
                        {factory && <option value={factory.id}>🏭 {factory.name}</option>}
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            🏢 {b.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <button type="submit" style={styles.primaryBtn}>
                    Сохранить роль
                  </button>
                  {roleMsg && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{roleMsg}</div>
                  )}
                </form>
              </section>

              <section style={{ ...styles.card, flex: 1 }}>
                <div style={styles.sectionTitle}>Динамический доступ (ACL в БД)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {accessList.length === 0 && (
                    <div style={{ color: '#a1a1aa', fontSize: 13 }}>Список пуст — используются только static roles</div>
                  )}
                  {accessList.map((a) => (
                    <div key={a.telegram_id} style={styles.branchRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            🆔 {a.telegram_id} {a.username ? `(@${a.username})` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: '#52525b', marginTop: 3 }}>
                            {a.role === 'director'
                              ? '👑 Директор'
                              : a.role === 'driver'
                                ? '🚚 Развозчик'
                                : `🏢 Управ · ${a.branch_name || a.branch_id}`}
                          </div>
                        </div>
                        <button style={styles.dangerBtn} onClick={() => handleRevoke(a.telegram_id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        <footer style={styles.footer}>
          <a href="https://pasta-pasta-tracker.vercel.app/dashboard" style={{ color: '#2563eb' }}>
            pasta-pasta-tracker.vercel.app/dashboard
          </a>
          {' · '}auto-refresh · Supabase
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
  tabsBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 28px 0',
    maxWidth: 1280,
    margin: '0 auto',
  },
  tab: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    background: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    color: '#71717a',
  },
  tabActive: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #18181b',
    background: '#18181b',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    color: '#fff',
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
  main: { maxWidth: 1280, margin: '0 auto', padding: '20px 28px 48px' },
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
  twoCol: { display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' },
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
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
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
  td: { padding: '12px', borderBottom: '1px solid #f4f4f5', verticalAlign: 'middle' },
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
  dangerBtn: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  loginTitle: { fontSize: 24, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.4px' },
  loginSub: { fontSize: 13, color: '#71717a', lineHeight: 1.5, marginBottom: 20 },
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
  infoBox: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1e3a8a',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: 1.5,
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
    height: 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a1a1aa',
    borderRadius: 16,
    border: '1px dashed #e4e4e7',
  },
  footer: { marginTop: 28, textAlign: 'center', fontSize: 12, color: '#a1a1aa' },
};
