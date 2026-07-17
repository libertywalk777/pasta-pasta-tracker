'use client';

import React, { useState, useEffect, useCallback } from 'react';

const API = '';

// SVG Icons
const TruckIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const PackageIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const HistoryIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 8v4l3 3" />
    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
  </svg>
);

const PinIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CheckIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ArrowLeftIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ClockIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const NavigationIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const ClipboardIcon = ({ size = 20, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

// Map Component for Location (Driver & Manager)
function LocationMap({ driverLat, driverLng, branchLat, branchLng, branchName, height = 200 }) {
  const mapRef = React.useRef(null);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.L || !containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const L = window.L;
    const center = [(driverLat + branchLat) / 2, (driverLng + branchLng) / 2];

    const map = L.map(containerRef.current, {
      center: center,
      zoom: 15,
      zoomControl: false
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Branch Marker
    L.marker([branchLat, branchLng], {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #18181b; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2)">🏢</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map).bindPopup(`<b>${branchName}</b>`);

    // Driver Marker
    L.marker([driverLat, driverLng], {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #2563eb; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2)">🚚</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map).bindPopup('<b>Развозчик</b>');

    const bounds = L.latLngBounds([[driverLat, driverLng], [branchLat, branchLng]]);
    map.fitBounds(bounds, { padding: [30, 30] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [driverLat, driverLng, branchLat, branchLng, branchName]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        height: height, 
        width: '100%', 
        borderRadius: 12, 
        border: '1px solid #e4e4e7',
        marginTop: 10,
        overflow: 'hidden',
        zIndex: 1
      }} 
    />
  );
}

// Map Component for Director
function DirectorMap({ branches, factory, deliveries, height = 300 }) {
  const mapRef = React.useRef(null);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.L || !containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const L = window.L;

    // Centered around first branch or Tashkent default
    const center = branches[0] ? [branches[0].lat, branches[0].lng] : [41.311676, 69.292960];
    const map = L.map(containerRef.current, {
      center: center,
      zoom: 12,
      zoomControl: false
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Factory Marker
    if (factory) {
      L.marker([factory.lat, factory.lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #dc2626; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3)">🏭</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(map).bindPopup(`<b>Фабрика</b><br/>${factory.address}`);
    }

    // Branch Markers
    branches.forEach(b => {
      L.marker([b.lat, b.lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #18181b; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2)">🏢</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(map).bindPopup(`<b>${b.name}</b><br/>${b.address}`);
    });

    // Recent delivery checkpoints
    deliveries.slice(0, 15).forEach(d => {
      if (d.driver_lat && d.driver_lng) {
        const statusColor = d.status === 'confirmed' ? '#16a34a' : d.status === 'rejected' ? '#dc2626' : '#d97706';
        L.circleMarker([d.driver_lat, d.driver_lng], {
          radius: 6,
          fillColor: statusColor,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(map).bindPopup(`<b>${d.driver_name}</b> -> ${d.branch_name}<br/>Статус: ${d.status}<br/>Время: ${d.created_at}`);
      }
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
      ref={containerRef} 
      style={{ 
        height: height, 
        width: '100%', 
        borderRadius: 14, 
        border: '1px solid #e4e4e7',
        marginBottom: 20,
        overflow: 'hidden',
        zIndex: 1
      }} 
    />
  );
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('driver');
  const [userBranchId, setUserBranchId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [factory, setFactory] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [step, setStep] = useState('choose');
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [deliveries, setDeliveries] = useState([]);
  const [tab, setTab] = useState('deliver');

  // Auto role state (phone-first, no manual role switch)
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [matchedBy, setMatchedBy] = useState('');
  const [roleLabel, setRoleLabel] = useState('');

  const [userPhone, setUserPhone] = useState('');
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

  // Director access list & management
  const [directorTab, setDirectorTab] = useState('activity');
  const [accessList, setAccessList] = useState([]);
  const [formTgId, setFormTgId] = useState('');
  const [formTgUsername, setFormTgUsername] = useState('');
  const [formRole, setFormRole] = useState('manager');
  const [formBranchId, setFormBranchId] = useState(0);

  // Dashboard logs
  const [directorStats, setDirectorStats] = useState({ confirmed: 0, rejected: 0, pending: 0, total: 0 });
  const [todayStats, setTodayStats] = useState({ confirmed: 0, rejected: 0, pending: 0, total: 0 });
  const [directorDeliveries, setDirectorDeliveries] = useState([]);
  const [managerDeliveries, setManagerDeliveries] = useState([]);

  const isTelegram =
    typeof window !== 'undefined' &&
    !!window.Telegram?.WebApp &&
    (!!window.Telegram.WebApp.initData || !!window.Telegram.WebApp.initDataUnsafe?.user);

  // Load Leaflet resources dynamically
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

  // Restore cached phone (so Mini App remembers after share)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('ppt_phone');
      if (cached) setUserPhone(cached);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const w = window.Telegram.WebApp;
      try {
        w.ready();
        w.expand();
        if (w.setHeaderColor) w.setHeaderColor('#ffffff');
        if (w.setBackgroundColor) w.setBackgroundColor('#ffffff');
      } catch {}
      setUser(w.initDataUnsafe?.user || null);

      // Listen for contact share (phone auto-role)
      const onContact = (event) => {
        try {
          const phone =
            event?.responseUnsafe?.contact?.phone_number ||
            event?.contact?.phone_number ||
            '';
          if (phone) {
            const digits = String(phone).replace(/\D/g, '');
            setUserPhone(digits);
            try { localStorage.setItem('ppt_phone', digits); } catch {}
            setPhonePrompt(false);
          }
        } catch {}
      };
      try { w.onEvent && w.onEvent('contactRequested', onContact); } catch {}
      return () => {
        try { w.offEvent && w.offEvent('contactRequested', onContact); } catch {}
      };
    }
  }, []);

  // Fetch branches
  useEffect(() => {
    fetch(`${API}/api/branches`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setBranches(d.branches || []);
        setFactory(d.factory);
        setDriverInfo(d.driver);
        if (d.factory) setFormBranchId(d.factory.id);
      })
      .catch(() => {});
  }, []);

  // Auto role: phone (preferred) → username → default driver
  // No manual role switch — identity is resolved only from phone/username.
  const refreshRole = useCallback(() => {
    const u = user?.username || '';
    const tid = user?.id || '';
    setRoleLoading(true);
    fetch(`${API}/api/get-user-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: tid || null,
        username: u || null,
        phone: userPhone || null,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setUserRole(d.role || 'driver');
          setUserBranchId(d.branch_id ?? null);
          setMatchedBy(d.matched_by || '');
          setRoleLabel(d.label || '');
          // Ask for phone if not matched by phone yet (username-only is ok but phone is preferred)
          if (!userPhone && d.matched_by !== 'phone' && d.matched_by !== 'db') {
            setPhonePrompt(true);
          } else {
            setPhonePrompt(false);
          }
        }
      })
      .catch(() => {})
      .finally(() => setRoleLoading(false));
  }, [user, userPhone]);

  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  const requestTelegramPhone = () => {
    const w = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    if (!w) {
      setPhonePrompt(true);
      return;
    }
    setPhoneBusy(true);
    try {
      if (typeof w.requestContact === 'function') {
        w.requestContact((sent, event) => {
          setPhoneBusy(false);
          if (!sent) return;
          const phone =
            event?.responseUnsafe?.contact?.phone_number ||
            event?.contact?.phone_number ||
            '';
          if (phone) {
            const digits = String(phone).replace(/\D/g, '');
            setUserPhone(digits);
            try { localStorage.setItem('ppt_phone', digits); } catch {}
            setPhonePrompt(false);
          }
        });
      } else {
        setPhoneBusy(false);
        setPhonePrompt(true);
      }
    } catch {
      setPhoneBusy(false);
      setPhonePrompt(true);
    }
  };

  const submitManualPhone = () => {
    const digits = String(manualPhone || '').replace(/\D/g, '');
    if (digits.length < 9) {
      alert('Введите номер полностью, например +998901234567');
      return;
    }
    setUserPhone(digits);
    try { localStorage.setItem('ppt_phone', digits); } catch {}
    setPhonePrompt(false);
  };

  useEffect(() => {
    if (!navigator.geolocation) { setLocError('Геолокация не поддерживается'); return; }
    const id = navigator.geolocation.watchPosition(
      p => { setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocError(''); },
      () => setLocError('Включите геолокацию'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Role is automatic — no override switch
  const activeRole = userRole;
  const activeBranchId = userBranchId;

  // Load Driver History
  const loadHistory = useCallback(() => {
    const id = user?.id || 0;
    if (!id && !userPhone) return;
    fetch(`${API}/api/my-deliveries`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: id || 123456 }),
    }).then(r => r.json()).then(d => setDeliveries(d.deliveries || [])).catch(() => {});
  }, [user, userPhone]);

  // Load Manager History and Pending Deliveries
  const loadBranchHistory = useCallback(() => {
    if (activeBranchId === null) return;
    fetch(`${API}/api/branch-deliveries`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: activeBranchId }),
    }).then(r => r.json()).then(d => setManagerDeliveries(d.deliveries || [])).catch(() => {});
  }, [activeBranchId]);

  // Load Director Dashboard Statistics (all events from DB)
  const loadDirectorStats = useCallback(() => {
    fetch(`${API}/api/all-deliveries`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user?.username || null,
        phone: userPhone || null,
        telegram_id: user?.id || null,
      }),
    }).then(r => r.json()).then(d => {
      if (d.ok) {
        setDirectorStats(d.stats || { confirmed: 0, rejected: 0, pending: 0, total: 0 });
        setTodayStats(d.todayStats || { confirmed: 0, rejected: 0, pending: 0, total: 0 });
        setDirectorDeliveries(d.deliveries || []);
      }
    }).catch(() => {});
  }, [user, userPhone]);

  // Load Director Access List
  const loadAccessList = useCallback(() => {
    fetch(`${API}/api/get-access-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user?.username || null,
        phone: userPhone || null,
        telegram_id: user?.id || null,
      })
    })
    .then(r => r.json())
    .then(d => {
      if (d.ok) setAccessList(d.accessList || []);
    })
    .catch(() => {});
  }, [user, userPhone]);

  // Fetch triggers
  useEffect(() => { 
    if (tab === 'history' && activeRole === 'driver') loadHistory(); 
  }, [tab, activeRole, loadHistory]);

  useEffect(() => { 
    if (activeRole === 'manager' && activeBranchId !== null) loadBranchHistory(); 
  }, [activeRole, activeBranchId, loadBranchHistory]);

  useEffect(() => { 
    if (activeRole === 'director') {
      loadDirectorStats();
      const interval = setInterval(loadDirectorStats, 10000);
      return () => clearInterval(interval);
    }
  }, [activeRole, loadDirectorStats]);

  useEffect(() => {
    if (activeRole === 'director' && directorTab === 'access') {
      loadAccessList();
    }
  }, [activeRole, directorTab, loadAccessList]);

  const submit = async (type, branchId) => {
    if (!location) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch(`${API}/api/deliver`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: user?.id || 123456,
          driver_name: user?.first_name || user?.username || 'Развозчик',
          branch_id: branchId, lat: location.lat, lng: location.lng, type,
        }),
      });
      const d = await r.json();
      if (d.ok) { setResult(d); setStep('done'); }
      else setError(d.message || d.error || 'Ошибка');
    } catch { setError('Ошибка соединения'); }
    setLoading(false);
  };

  const handleConfirm = async (deliveryId, status) => {
    setActionLoading(deliveryId);
    try {
      const managerId = user?.id || 9999;
      const managerName = user?.first_name || user?.username || 'Управляющий';
      const r = await fetch(`${API}/api/confirm-delivery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: deliveryId, status, manager_id: managerId, manager_name: managerName }),
      });
      const d = await r.json();
      if (d.ok) {
        loadBranchHistory();
        if (userRole === 'director') loadDirectorStats();
      } else {
        alert(d.error || 'Ошибка');
      }
    } catch {
      alert('Ошибка соединения');
    }
    setActionLoading(null);
  };

  // Access management handlers (director only — identity from phone/username)
  const directorAuthBody = () => ({
    username: user?.username || null,
    phone: userPhone || null,
    telegram_id: user?.id || null,
  });

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    if (!formTgId) return;
    try {
      const r = await fetch(`${API}/api/grant-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // director identity (phone/username) — do NOT overwrite with target id
          username: user?.username || null,
          phone: userPhone || null,
          director_telegram_id: user?.id || null,
          // target user being granted
          target_telegram_id: Number(formTgId),
          telegram_username: formTgUsername || null,
          role: formRole,
          branch_id: formRole === 'manager' ? Number(formBranchId) : null
        })
      });
      const d = await r.json();
      if (d.ok) {
        setFormTgId('');
        setFormTgUsername('');
        loadAccessList();
      } else {
        alert(d.error || 'Ошибка');
      }
    } catch {
      alert('Ошибка соединения');
    }
  };

  const handleRevokeAccess = async (tgId) => {
    if (!confirm('Вы уверены, что хотите удалить доступ?')) return;
    try {
      const r = await fetch(`${API}/api/revoke-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username || null,
          phone: userPhone || null,
          director_telegram_id: user?.id || null,
          target_telegram_id: tgId,
        })
      });
      const d = await r.json();
      if (d.ok) {
        loadAccessList();
      }
    } catch {
      alert('Ошибка соединения');
    }
  };

  const reset = () => { setStep('choose'); setSelectedBranch(null); setResult(null); setError(''); };

  const statusStyles = {
    confirmed: {
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      label: 'Подтверждено',
      icon: (size = 14) => <CheckIcon size={size} color="#16a34a" />
    },
    rejected: {
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
      label: 'Отклонено',
      icon: (size = 14) => <CloseIcon size={size} color="#dc2626" />
    },
    pending: {
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      label: 'Ожидает',
      icon: (size = 14) => <ClockIcon size={size} color="#d97706" />
    }
  };

  const managerActiveBranch = branches.find(b => b.id === activeBranchId) || 
                              (factory?.id === activeBranchId ? factory : null);

  return (
    <main style={c.container}>
      {/* Phone identity — sole way to select role (automatic) */}
      {phonePrompt && (
        <div style={c.phoneBanner}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📱 Вход по номеру телефона</div>
          <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.4, marginBottom: 10 }}>
            Роль (развозчик / управляющий / директор) определяется <b>только по номеру</b>. Переключателя ролей нет.
          </div>
          {isTelegram && (
            <button style={c.phoneBtn} onClick={requestTelegramPhone} disabled={phoneBusy}>
              {phoneBusy ? 'Ожидание…' : 'Отправить номер из Telegram'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="tel"
              placeholder="+998 XX XXX XX XX"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              style={c.phoneInput}
            />
            <button style={c.phoneBtnSecondary} onClick={submitManualPhone}>Войти</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={c.header}>
        <div style={c.headerTitleContainer}>
          {activeRole === 'director' ? (
            <ClipboardIcon size={22} style={c.headerTitleIcon} />
          ) : activeRole === 'manager' ? (
            <PackageIcon size={22} style={c.headerTitleIcon} />
          ) : (
            <TruckIcon size={22} style={c.headerTitleIcon} />
          )}
          <div style={c.headerTitle}>
            {roleLoading
              ? 'Загрузка…'
              : activeRole === 'director'
                ? 'Панель Директора'
                : activeRole === 'manager'
                  ? 'Панель Управляющего'
                  : 'Трекер доставок'}
          </div>
        </div>
        <div style={c.headerSub}>
          {activeRole === 'manager' && managerActiveBranch ? `${managerActiveBranch.name} · ` : ''}
          {roleLabel || (user ? user.first_name || user.username : driverInfo?.name || 'Развозчик')}
          {matchedBy === 'phone' ? ' · 📱' : matchedBy === 'username' ? ' · @' : matchedBy === 'db' ? ' · DB' : ''}
          {userPhone ? ` · +${String(userPhone).replace(/^\+/, '')}` : ''}
        </div>
        {!userPhone && (
          <button style={c.linkBtn} onClick={() => { setPhonePrompt(true); if (isTelegram) requestTelegramPhone(); }}>
            Указать телефон
          </button>
        )}
        {userPhone && (
          <button
            style={c.linkBtn}
            onClick={() => {
              setUserPhone('');
              try { localStorage.removeItem('ppt_phone'); } catch {}
              setPhonePrompt(true);
              setManualPhone('');
            }}
          >
            Сменить номер
          </button>
        )}
      </div>

      {/* RENDER VIEW ACCORDING TO ROLE */}

      {/* ─────────────────── DIRECTOR ROLE ─────────────────── */}
      {activeRole === 'director' && (
        <div style={c.content}>
          {/* Sub tabs */}
          <div style={c.dirTabs}>
            <button 
              style={directorTab === 'activity' ? c.dirTabActive : c.dirTab}
              onClick={() => setDirectorTab('activity')}
            >
              Активность
              {directorTab === 'activity' && <span style={c.dirTabIndicator} />}
            </button>
            <button 
              style={directorTab === 'access' ? c.dirTabActive : c.dirTab}
              onClick={() => setDirectorTab('access')}
            >
              Доступ
              {directorTab === 'access' && <span style={c.dirTabIndicator} />}
            </button>
          </div>

          {directorTab === 'activity' ? (
            <>
              {/* Stats Cards — today + all-time from DB */}
              <div style={c.label}>Сегодня</div>
              <div style={c.statsContainer}>
                <div style={c.statCard}>
                  <div style={c.statVal}>{todayStats.total}</div>
                  <div style={c.statLbl}>Всего сегодня</div>
                </div>
                <div style={{ ...c.statCard, borderLeft: '3px solid #16a34a' }}>
                  <div style={{ ...c.statVal, color: '#16a34a' }}>{todayStats.confirmed}</div>
                  <div style={c.statLbl}>Подтверждено</div>
                </div>
                <div style={{ ...c.statCard, borderLeft: '3px solid #d97706' }}>
                  <div style={{ ...c.statVal, color: '#d97706' }}>{todayStats.pending}</div>
                  <div style={c.statLbl}>Ожидает</div>
                </div>
                <div style={{ ...c.statCard, borderLeft: '3px solid #dc2626' }}>
                  <div style={{ ...c.statVal, color: '#dc2626' }}>{todayStats.rejected}</div>
                  <div style={c.statLbl}>Отклонено</div>
                </div>
              </div>
              <div style={c.label}>Всего в базе</div>
              <div style={{ ...c.statsContainer, marginBottom: 12 }}>
                <div style={c.statCard}>
                  <div style={c.statVal}>{directorStats.total}</div>
                  <div style={c.statLbl}>Все события</div>
                </div>
                <div style={{ ...c.statCard, borderLeft: '3px solid #16a34a' }}>
                  <div style={{ ...c.statVal, color: '#16a34a' }}>{directorStats.confirmed}</div>
                  <div style={c.statLbl}>Подтверждено</div>
                </div>
                <div style={{ ...c.statCard, borderLeft: '3px solid #d97706' }}>
                  <div style={{ ...c.statVal, color: '#d97706' }}>{directorStats.pending}</div>
                  <div style={c.statLbl}>Ожидает</div>
                </div>
                <div style={{ ...c.statCard, borderLeft: '3px solid #dc2626' }}>
                  <div style={{ ...c.statVal, color: '#dc2626' }}>{directorStats.rejected}</div>
                  <div style={c.statLbl}>Отклонено</div>
                </div>
              </div>

              {/* Director Map */}
              {leafletLoaded && (
                <>
                  <div style={c.label}>Карта активности филиалов</div>
                  <DirectorMap 
                    branches={branches} 
                    factory={factory} 
                    deliveries={directorDeliveries} 
                  />
                </>
              )}

              {/* All Deliveries History */}
              <div style={c.label}>Последние 100 событий</div>
              {directorDeliveries.length === 0 ? (
                <div style={c.empty}>Нет событий сегодня</div>
              ) : (
                <div style={c.histList}>
                  {directorDeliveries.map(d => {
                    const status = statusStyles[d.status] || statusStyles.pending;
                    return (
                      <div key={d.id} style={c.histCard}>
                        <div style={c.histTop}>
                          <span style={c.histTypeIcon}>
                            {d.type === 'pickup' ? <PackageIcon size={14} /> : <TruckIcon size={14} />}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>
                              👤 {d.driver_name}
                            </span>
                            <span style={{ 
                              ...c.histStatusContainer, 
                              color: status.color,
                              background: status.bg,
                              border: `1px solid ${status.border}`
                            }}>
                              {status.icon(12)}
                              <span>{status.label}</span>
                            </span>
                          </div>
                        </div>
                        <div style={c.histBr}>{d.branch_name}</div>
                        <div style={c.histMeta}>
                          <div style={c.histMetaItem}>
                            <ClockIcon size={12} />
                            <span>{d.created_at}</span>
                          </div>
                          <div style={c.histMetaItem}>
                            <NavigationIcon size={12} />
                            <span>{d.distance} м</span>
                          </div>
                          {d.confirmed_by_name && (
                            <div style={c.histMetaItem}>
                              <span>🧑‍💼 {d.confirmed_by_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Access management */}
              <div style={c.label}>Выдать доступ</div>
              <form onSubmit={handleGrantAccess} style={c.accessForm}>
                <div style={c.formRow}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>Telegram User ID (только цифры)</label>
                  <input 
                    type="number"
                    required
                    placeholder="Пример: 123456789"
                    value={formTgId}
                    onChange={(e) => setFormTgId(e.target.value)}
                    style={c.formInput}
                  />
                </div>
                <div style={c.formRow}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>Telegram Username (опционально)</label>
                  <input 
                    type="text"
                    placeholder="Пример: ivan_delivery"
                    value={formTgUsername}
                    onChange={(e) => setFormTgUsername(e.target.value)}
                    style={c.formInput}
                  />
                </div>
                <div style={c.formRow}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>Роль доступа</label>
                  <select 
                    value={formRole} 
                    onChange={(e) => setFormRole(e.target.value)} 
                    style={c.formSelect}
                  >
                    <option value="manager">🏢 Управляющий (Manager)</option>
                    <option value="director">👑 Директор (Director)</option>
                    <option value="driver">🚚 Развозчик (Driver)</option>
                  </select>
                </div>
                {formRole === 'manager' && (
                  <div style={c.formRow}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>Управляемый филиал</label>
                    <select 
                      value={formBranchId} 
                      onChange={(e) => setFormBranchId(Number(e.target.value))} 
                      style={c.formSelect}
                    >
                      {factory && <option value={factory.id}>🏭 {factory.name}</option>}
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>🏢 {b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="submit" style={c.formBtn}>Выдать права доступа</button>
              </form>

              <div style={c.label}>Пользователи с настроенным доступом</div>
              {accessList.length === 0 ? (
                <div style={c.empty}>Список пуст</div>
              ) : (
                <div style={c.accessList}>
                  {accessList.map(item => {
                    const br = branches.find(b => b.id === item.branch_id) || (factory?.id === item.branch_id ? factory : null);
                    return (
                      <div key={item.telegram_id} style={c.accessCard}>
                        <div style={c.accessDetails}>
                          <span style={c.accessTg}>
                            🆔 {item.telegram_id} {item.telegram_username ? `(@${item.telegram_username})` : ''}
                          </span>
                          <span style={c.accessRole}>
                            Роль: {item.role === 'director' ? '👑 Директор' : item.role === 'manager' ? `🏢 Управляющий (${br?.name || 'Филиал'})` : '🚚 Развозчик'}
                          </span>
                        </div>
                        <button style={c.btnRevoke} onClick={() => handleRevokeAccess(item.telegram_id)}>Удалить</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────────── MANAGER ROLE ─────────────────── */}
      {activeRole === 'manager' && (
        <div style={c.content}>
          {/* List Pending */}
          {(() => {
            const pending = managerDeliveries.filter(d => d.status === 'pending');
            return pending.length > 0 ? (
              <div style={c.pendingSection}>
                <div style={c.label}>Ожидает подтверждения:</div>
                {pending.map(d => (
                  <div key={d.id} style={c.pendingCard}>
                    <div style={c.pendingHeader}>
                      <span style={c.pendingDriver}>
                        <TruckIcon size={14} /> {d.driver_name}
                      </span>
                      <span style={c.pendingType}>
                        {d.type === 'pickup' ? 'Забор' : 'Доставка'}
                      </span>
                    </div>
                    <div style={c.pendingTime}>Отправлено: {d.created_at}</div>

                    {/* Verification Map */}
                    {leafletLoaded && d.driver_lat && d.driver_lng && managerActiveBranch && (
                      <LocationMap 
                        driverLat={d.driver_lat}
                        driverLng={d.driver_lng}
                        branchLat={managerActiveBranch.lat}
                        branchLng={managerActiveBranch.lng}
                        branchName={managerActiveBranch.name}
                        height={180}
                      />
                    )}

                    <div style={c.pendingDistance}>
                      📍 Дистанция: <strong>{d.distance} м</strong> от точки 
                      {d.distance > 300 && (
                        <span style={{ color: '#dc2626', marginLeft: 6, fontWeight: 700 }}>(Вне радиуса 300м!)</span>
                      )}
                    </div>

                    {actionLoading === d.id ? (
                      <div style={c.actionLoading}>Обработка...</div>
                    ) : (
                      <div style={c.pendingActions}>
                        <button style={c.btnConfirm} onClick={() => handleConfirm(d.id, 'confirmed')}>
                          <CheckIcon size={16} /> Принять
                        </button>
                        <button style={c.btnReject} onClick={() => handleConfirm(d.id, 'rejected')}>
                          <CloseIcon size={16} /> Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={c.noPendingCard}>
                <CheckIcon size={24} color="#16a34a" />
                <span>Нет ожидающих доставок для вашего филиала</span>
              </div>
            );
          })()}

          {/* History */}
          <div style={c.label}>История филиала</div>
          {managerDeliveries.filter(d => d.status !== 'pending').length === 0 ? (
            <div style={c.empty}>История пуста</div>
          ) : (
            <div style={c.histList}>
              {managerDeliveries.filter(d => d.status !== 'pending').map(d => {
                const status = statusStyles[d.status] || statusStyles.pending;
                return (
                  <div key={d.id} style={c.histCard}>
                    <div style={c.histTop}>
                      <span style={c.histTypeIcon}>
                        {d.type === 'pickup' ? <PackageIcon size={14} /> : <TruckIcon size={14} />}
                      </span>
                      <span style={{ 
                        ...c.histStatusContainer, 
                        color: status.color,
                        background: status.bg,
                        border: `1px solid ${status.border}`
                      }}>
                        {status.icon(12)}
                        <span>{status.label}</span>
                      </span>
                    </div>
                    <div style={c.histBr}>{d.driver_name}</div>
                    <div style={c.histMeta}>
                      <div style={c.histMetaItem}>
                        <ClockIcon size={12} />
                        <span>{d.created_at}</span>
                      </div>
                      <div style={c.histMetaItem}>
                        <NavigationIcon size={12} />
                        <span>{d.distance} м</span>
                      </div>
                      {d.confirmed_by_name && (
                        <div style={c.histMetaItem}>
                          <span>🧑‍💼 {d.confirmed_by_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── DRIVER ROLE ─────────────────── */}
      {activeRole === 'driver' && (
        <>
          <div style={c.tabsContainer}>
            <div style={c.tabs}>
              <button style={tab === 'deliver' ? c.tabActive : c.tab} onClick={() => { setTab('deliver'); reset(); }}>
                <PackageIcon size={16} />
                <span>Доставка</span>
              </button>
              <button style={tab === 'history' ? c.tabActive : c.tab} onClick={() => setTab('history')}>
                <HistoryIcon size={16} />
                <span>История</span>
              </button>
            </div>
          </div>

          {tab === 'deliver' ? (
            <div style={c.content}>
              <div style={location ? c.locOk : c.locBad}>
                <PinIcon size={15} />
                <span>{location ? 'Геолокация активна' : (locError || 'Определяем геопозицию...')}</span>
              </div>

              {step === 'choose' && (
                <>
                  <div style={c.label}>Выберите действие</div>
                  <div style={c.btnStack}>
                    <button style={location ? c.bigBtn : c.bigOff} disabled={!location} onClick={() => submit('pickup', 0)}>
                      <div style={location ? c.bigIconContainer : c.bigIconContainerOff}>
                        <PackageIcon size={20} />
                      </div>
                      <span style={c.bigBtnTitle}>Забрал с фабрики</span>
                      <span style={c.bigSub}>{factory?.name} · {factory?.address}</span>
                    </button>
                    <button style={location ? c.bigBtn : c.bigOff} disabled={!location} onClick={() => setStep('deliver')}>
                      <div style={location ? c.bigIconContainer : c.bigIconContainerOff}>
                        <TruckIcon size={20} />
                      </div>
                      <span style={c.bigBtnTitle}>Доставка на филиал</span>
                      <span style={c.bigSub}>Выберите филиал назначения</span>
                    </button>
                  </div>
                </>
              )}

              {step === 'deliver' && (
                <>
                  <div style={c.label}>Выберите филиал</div>
                  <div style={c.branchList}>
                    {branches.map(b => (
                      <button key={b.id} style={selectedBranch === b.id ? c.brA : c.br}
                        onClick={() => setSelectedBranch(b.id)}>
                        <div style={c.brName}>{b.name}</div>
                        <div style={c.brAddr}>{b.address}</div>
                      </button>
                    ))}
                  </div>

                  {/* Driver Visual Map to guide positioning */}
                  {leafletLoaded && location && selectedBranch && (
                    (() => {
                      const b = branches.find(x => x.id === selectedBranch);
                      if (!b) return null;
                      return (
                        <div style={{ marginBottom: 20 }}>
                          <div style={c.label}>Карта филиала и вашего положения:</div>
                          <LocationMap 
                            driverLat={location.lat}
                            driverLng={location.lng}
                            branchLat={b.lat}
                            branchLng={b.lng}
                            branchName={b.name}
                            height={180}
                          />
                        </div>
                      );
                    })()
                  )}

                  <button style={selectedBranch && !loading ? c.submit : c.submitOff}
                    disabled={!selectedBranch || loading}
                    onClick={() => selectedBranch && submit('delivery', selectedBranch)}>
                    {loading ? 'Отправка...' : (
                      <>
                        <CheckIcon size={16} />
                        <span>Подтвердить доставку</span>
                      </>
                    )}
                  </button>
                  <button style={c.back} onClick={reset}>
                    <ArrowLeftIcon size={16} />
                    <span>Назад</span>
                  </button>
                </>
              )}

              {step === 'done' && result && (
                <div style={c.resOk}>
                  <div style={c.resOkIcon}>
                    <CheckIcon size={22} color="#16a34a" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>Отправлено!</div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{result.branch_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 1 }}>{result.distance} м от точки</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 12, lineHeight: 1.4 }}>Ожидайте подтверждения управляющего</div>
                  <button style={c.again} onClick={reset}>Новая доставка</button>
                </div>
              )}

              {error && (
                <div style={c.resErr}>
                  <div style={c.resErrIcon}>
                    <CloseIcon size={22} color="#dc2626" />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{error}</div>
                  <button style={c.againR} onClick={() => setError('')}>Понятно</button>
                </div>
              )}
            </div>
          ) : (
            <div style={c.content}>
              {deliveries.length === 0 ? (
                <div style={c.empty}>
                  <ClipboardIcon size={28} style={{ marginBottom: 4 }} />
                  <div>Нет доставок</div>
                </div>
              ) : (
                <div style={c.histList}>
                  {deliveries.map(d => {
                    const status = statusStyles[d.status] || statusStyles.pending;
                    return (
                      <div key={d.id} style={c.histCard}>
                        <div style={c.histTop}>
                          <span style={c.histTypeIcon}>
                            {d.type === 'pickup' ? <PackageIcon size={15} /> : <TruckIcon size={15} />}
                          </span>
                          <span style={{ 
                            ...c.histStatusContainer, 
                            color: status.color,
                            background: status.bg,
                            border: `1px solid ${status.border}`
                          }}>
                            {status.icon(12)}
                            <span>{status.label}</span>
                          </span>
                        </div>
                        <div style={c.histBr}>{d.branch_name}</div>
                        <div style={c.histMeta}>
                          <div style={c.histMetaItem}>
                            <ClockIcon size={12} />
                            <span>{d.created_at}</span>
                          </div>
                          <div style={c.histMetaItem}>
                            <NavigationIcon size={12} />
                            <span>{d.distance} м</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

const c = {
  container: { 
    minHeight: '100vh', 
    background: '#ffffff', 
    color: '#18181b', 
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
    paddingBottom: 40 
  },
  debugBar: {
    background: '#f4f4f5',
    borderBottom: '1px solid #e4e4e7',
    padding: '8px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  debugSelect: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #d4d4d8',
    background: '#ffffff',
    fontSize: 12,
    fontWeight: 500,
    outline: 'none',
  },
  switcherContainer: {
    padding: '12px 20px',
    background: '#ffffff',
    borderBottom: '1px solid #f4f4f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switcherLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#71717a',
  },
  switcherSelect: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #e4e4e7',
    background: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
    color: '#18181b',
  },
  header: { 
    padding: '24px 20px 16px', 
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4
  },
  headerTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  headerTitleIcon: {
    color: '#18181b'
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 700, 
    color: '#18181b', 
    letterSpacing: '-0.5px' 
  },
  headerSub: { 
    fontSize: 13, 
    color: '#71717a', 
    marginTop: 2,
    fontWeight: 500
  },
  tabsContainer: {
    padding: '0 20px 20px'
  },
  tabs: { 
    display: 'flex', 
    background: '#f4f4f5',
    padding: 4,
    borderRadius: 12,
    gap: 4
  },
  tab: { 
    flex: 1, 
    padding: '8px 0', 
    border: 'none', 
    borderRadius: 8, 
    background: 'transparent', 
    color: '#71717a', 
    fontSize: 13, 
    fontWeight: 600, 
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s ease'
  },
  tabActive: { 
    flex: 1, 
    padding: '8px 0', 
    border: 'none', 
    borderRadius: 8, 
    background: '#ffffff', 
    color: '#18181b', 
    fontSize: 13, 
    fontWeight: 600, 
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.04)',
    transition: 'all 0.2s ease'
  },
  content: { 
    padding: '0 20px' 
  },
  locOk: { 
    padding: '10px 14px', 
    borderRadius: 10, 
    background: '#f0fdf4', 
    border: '1px solid #bbf7d0', 
    color: '#16a34a', 
    fontSize: 13, 
    fontWeight: 500,
    marginBottom: 20, 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  locBad: { 
    padding: '10px 14px', 
    borderRadius: 10, 
    background: '#fef2f2', 
    border: '1px solid #fecaca', 
    color: '#dc2626', 
    fontSize: 13, 
    fontWeight: 500,
    marginBottom: 20, 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  label: { 
    fontSize: 11, 
    color: '#71717a', 
    marginBottom: 10, 
    fontWeight: 700, 
    textTransform: 'uppercase', 
    letterSpacing: '1px' 
  },
  btnStack: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 12 
  },
  bigBtn: { 
    padding: '18px 16px', 
    borderRadius: 14, 
    border: '1px solid #e4e4e7', 
    background: '#ffffff', 
    color: '#18181b', 
    cursor: 'pointer', 
    textAlign: 'left', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 4,
    transition: 'all 0.2s ease',
    alignItems: 'flex-start'
  },
  bigIconContainer: {
    background: '#f4f4f5',
    color: '#18181b',
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  bigBtnTitle: {
    fontSize: 15,
    fontWeight: 600
  },
  bigSub: { 
    fontSize: 12, 
    color: '#71717a', 
    marginTop: 2,
    lineHeight: 1.4
  },
  bigOff: { 
    padding: '18px 16px', 
    borderRadius: 14, 
    border: '1px solid #e4e4e7', 
    background: '#fafafa', 
    color: '#a1a1aa', 
    cursor: 'not-allowed', 
    textAlign: 'left', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 4,
    opacity: 0.65
  },
  bigIconContainerOff: {
    background: '#f4f4f5',
    color: '#a1a1aa',
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  branchList: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 8, 
    marginBottom: 20 
  },
  br: { 
    padding: '14px 16px', 
    borderRadius: 10, 
    border: '1px solid #e4e4e7', 
    background: '#ffffff', 
    color: '#18181b', 
    cursor: 'pointer', 
    textAlign: 'left',
    transition: 'all 0.2s ease'
  },
  brA: { 
    padding: '14px 16px', 
    borderRadius: 10, 
    border: '2px solid #18181b', 
    background: '#ffffff', 
    color: '#18181b', 
    cursor: 'pointer', 
    textAlign: 'left', 
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
    transition: 'all 0.2s ease'
  },
  brName: { 
    fontSize: 14, 
    fontWeight: 600 
  },
  brAddr: { 
    fontSize: 12, 
    color: '#71717a', 
    marginTop: 3 
  },
  submit: { 
    width: '100%', 
    padding: 16, 
    borderRadius: 12, 
    border: 'none', 
    background: '#18181b', 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: 600, 
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.2s ease'
  },
  submitOff: { 
    width: '100%', 
    padding: 16, 
    borderRadius: 12, 
    border: 'none', 
    background: '#f4f4f5', 
    color: '#a1a1aa', 
    fontSize: 15, 
    fontWeight: 600, 
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  back: { 
    width: '100%', 
    padding: 12, 
    borderRadius: 10, 
    border: 'none', 
    background: 'transparent', 
    color: '#71717a', 
    fontSize: 14, 
    fontWeight: 500,
    cursor: 'pointer', 
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  resOk: { 
    padding: '24px 20px', 
    borderRadius: 14, 
    background: '#f0fdf4', 
    border: '1px solid #bbf7d0', 
    color: '#166534', 
    fontSize: 14, 
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6
  },
  resOkIcon: {
    color: '#16a34a',
    background: '#ffffff',
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.1)',
    marginBottom: 6
  },
  resErr: { 
    padding: 20, 
    borderRadius: 14, 
    background: '#fef2f2', 
    border: '1px solid #fecaca', 
    color: '#991b1b', 
    fontSize: 14, 
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6
  },
  resErrIcon: {
    color: '#dc2626',
    background: '#ffffff',
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.1)',
    marginBottom: 6
  },
  again: { 
    marginTop: 16, 
    padding: '10px 20px', 
    borderRadius: 10, 
    border: '1px solid #bbf7d0', 
    background: '#ffffff', 
    color: '#166534', 
    fontSize: 14, 
    fontWeight: 600, 
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  againR: { 
    marginTop: 12, 
    padding: '8px 16px', 
    borderRadius: 10, 
    border: '1px solid #fecaca', 
    background: '#ffffff', 
    color: '#991b1b', 
    fontSize: 14, 
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  empty: { 
    textAlign: 'center', 
    color: '#71717a', 
    padding: '40px 20px', 
    fontSize: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8
  },
  histList: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 10 
  },
  histCard: { 
    padding: '14px 16px', 
    borderRadius: 12, 
    border: '1px solid #e4e4e7', 
    background: '#ffffff'
  },
  histTop: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 8 
  },
  histTypeIcon: {
    color: '#71717a',
    background: '#f4f4f5',
    padding: 6,
    borderRadius: 8,
    display: 'inline-flex'
  },
  histStatusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600
  },
  histBr: { 
    fontSize: 14, 
    fontWeight: 600, 
    color: '#18181b', 
    marginBottom: 8 
  },
  histMeta: { 
    display: 'flex', 
    flexWrap: 'wrap',
    gap: 12,
    fontSize: 12, 
    color: '#71717a',
    borderTop: '1px solid #f4f4f5',
    paddingTop: 8,
    marginTop: 4
  },
  histMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  // Manager-specific confirmation styling
  pendingSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  pendingCard: {
    padding: '18px 16px',
    borderRadius: 14,
    border: '1px solid #e4e4e7',
    background: '#ffffff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
  },
  pendingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pendingDriver: {
    fontSize: 14,
    fontWeight: 600,
    color: '#18181b',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pendingType: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#71717a',
    letterSpacing: '0.5px',
    background: '#f4f4f5',
    padding: '3px 8px',
    borderRadius: 6,
  },
  pendingTime: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 10,
  },
  pendingDistance: {
    fontSize: 13,
    color: '#18181b',
    marginTop: 10,
    marginBottom: 14,
  },
  pendingActions: {
    display: 'flex',
    gap: 10,
  },
  btnConfirm: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#16a34a',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'background 0.2s ease',
  },
  btnReject: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    background: '#ffffff',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'background 0.2s ease',
  },
  noPendingCard: {
    padding: '24px',
    borderRadius: 14,
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    color: '#475569',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 20,
  },
  // Director-specific styling
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #e4e4e7',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statVal: {
    fontSize: 22,
    fontWeight: 700,
    color: '#18181b',
  },
  statLbl: {
    fontSize: 12,
    color: '#71717a',
    fontWeight: 500,
  },
  actionLoading: {
    fontSize: 13,
    color: '#71717a',
    textAlign: 'center',
    padding: 10,
  },

  // PIN verification modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20
  },
  modal: {
    background: '#ffffff',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
    textAlign: 'center'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#18181b'
  },
  modalSub: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 1.4
  },
  pinInput: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 700,
    outline: 'none',
    margin: '10px 0 4px',
    background: '#fafafa'
  },
  pinError: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: 600
  },
  modalActions: {
    width: '100%',
    display: 'flex',
    gap: 8,
    marginTop: 8
  },
  btnCancel: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    background: '#ffffff',
    color: '#71717a',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  },

  // Access management tab styles
  dirTabs: {
    display: 'flex',
    borderBottom: '1px solid #e4e4e7',
    marginBottom: 20,
    gap: 16
  },
  dirTab: {
    padding: '10px 4px',
    background: 'none',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    color: '#71717a',
    cursor: 'pointer',
    position: 'relative'
  },
  dirTabActive: {
    padding: '10px 4px',
    background: 'none',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    color: '#18181b',
    cursor: 'pointer',
    position: 'relative'
  },
  dirTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    background: '#18181b'
  },
  accessForm: {
    background: '#fafafa',
    border: '1px solid #e4e4e7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    textAlign: 'left'
  },
  formInput: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #e4e4e7',
    fontSize: 13,
    outline: 'none',
    background: '#ffffff'
  },
  formSelect: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #e4e4e7',
    fontSize: 13,
    outline: 'none',
    background: '#ffffff',
    cursor: 'pointer'
  },
  formBtn: {
    padding: '10px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#18181b',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 6
  },
  accessList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  accessCard: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    background: '#ffffff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  accessDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    textAlign: 'left'
  },
  accessTg: {
    fontSize: 13,
    fontWeight: 600,
    color: '#18181b'
  },
  accessRole: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: 500
  },
  btnRevoke: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  },

  // Phone auto-role UI
  phoneBanner: {
    margin: '0 16px 12px',
    padding: 16,
    borderRadius: 14,
    border: '1px solid #e4e4e7',
    background: '#fafafa',
    textAlign: 'left',
  },
  phoneBtn: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: 'none',
    background: '#18181b',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  phoneBtnSecondary: {
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    background: '#18181b',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  phoneInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #e4e4e7',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  linkBtn: {
    marginTop: 8,
    background: 'transparent',
    border: 'none',
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};
