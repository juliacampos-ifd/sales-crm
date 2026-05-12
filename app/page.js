'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PRODUCTS, CLASSIFICACAO_COLORS, MONTH_NAMES, DUPLAS, getMonthBusinessDays, getMonthBusinessDaysMTD } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Target, Search, Eye, ArrowLeft, Filter, Calendar, History, LayoutGrid, LogOut, Shield, UserCheck, AlertCircle, Check, Building2, Upload } from 'lucide-react';

// ====================================================================
// MAIN CRM PAGE
// ====================================================================

export default function CRMPage() {
  // Auth
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(true);

  // Data
  const [brands, setBrands] = useState([]);
  const [view, setView] = useState('pipeline');
  const [activeProduct, setActiveProduct] = useState('3s');
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('Todos');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterBDR, setFilterBDR] = useState('Todos');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [detailTab, setDetailTab] = useState('info');
  const [brandHistory, setBrandHistory] = useState([]);
  const [showClosed, setShowClosed] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Auth check ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  // ── Login ──
  const handleLogin = async () => {
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    if (error) setLoginError('Email ou senha incorretos');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  // ── Load brands ──
  const loadBrands = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterClass !== 'Todos') params.set('classificacao', filterClass);
    if (filterEstado !== 'Todos') params.set('estado', filterEstado);
    if (filterBDR !== 'Todos') params.set('bdr', filterBDR);
    params.set('limit', '500');

    const res = await fetch(`/api/brands?${params}`);
    const data = await res.json();
    if (data.brands) setBrands(data.brands);
  }, [search, filterClass, filterEstado, filterBDR]);

  useEffect(() => {
    if (user) loadBrands();
  }, [user, loadBrands]);

  // ── Role-based filtering ──
  const filtered = useMemo(() => {
    let d = brands;
    if (profile?.role === 'executivo') {
      d = d.filter(b => b.responsavel_bdr === profile.name || b.responsavel_closer === profile.name);
    }
    return d;
  }, [brands, profile]);

  // ── Change stage ──
  const changeStage = async (brandId, product, newStage) => {
    setSaving(true);
    try {
      await fetch('/api/pipelines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          product,
          new_stage: newStage,
          user_id: user?.id,
          user_name: profile?.name,
        }),
      });
      await loadBrands();
    } catch (err) {
      console.error('Error changing stage:', err);
    }
    setSaving(false);
  };

  // ── Enable product ──
  const enableProduct = async (brandId, product) => {
    await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        product,
        user_id: user?.id,
        user_name: profile?.name,
      }),
    });
    await loadBrands();
  };

  // ── Load history (includes old reactivated entries) ──
  const loadHistory = async (brandId, oldIds) => {
    let url = `/api/history?brand_id=${brandId}`;
    if (oldIds && oldIds.length > 0) url += `&old_ids=${oldIds.join(',')}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.history) setBrandHistory(data.history);
  };

  // ── Pipeline stages for current product ──
  const product = PRODUCTS[activeProduct];
  const pipelineStages = useMemo(() => {
    if (!product) return [];
    if (showClosed) return product.stages;
    return product.activeStages || product.stages;
  }, [activeProduct, showClosed, product]);

  const getBrandsInStage = useCallback((stage) => {
    return filtered.filter(b => {
      const p = b.pipelines?.[activeProduct];
      return p && p.stage === stage;
    });
  }, [filtered, activeProduct]);

  // ── Estados list ──
  const estados = useMemo(() => {
    const s = new Set(brands.map(b => b.estado).filter(e => e && e.length === 2));
    return ['Todos', ...Array.from(s).sort()];
  }, [brands]);

  const bdrs = useMemo(() => {
    const s = new Set(brands.map(b => b.responsavel_bdr).filter(Boolean));
    return ['Todos', ...Array.from(s).sort()];
  }, [brands]);

  // ── Metrics ──
  const metrics = useMemo(() => {
    const f = filtered;
    const won3s = f.filter(b => b.pipelines?.['3s']?.stage === '9. Contrato assinado').length;
    const lost3s = f.filter(b => b.pipelines?.['3s']?.stage === '10. Perdido').length;

    const byClass = {};
    f.forEach(b => { if (b.classificacao) byClass[b.classificacao] = (byClass[b.classificacao] || 0) + 1; });

    const byEstado = {};
    f.forEach(b => { if (b.estado && b.estado.length === 2) byEstado[b.estado] = (byEstado[b.estado] || 0) + 1; });

    const activeByProduct = {};
    Object.keys(PRODUCTS).forEach(pk => {
      activeByProduct[pk] = f.filter(b => {
        const s = b.pipelines?.[pk]?.stage;
        return s && !['10. Perdido','11. Stand by','8. Perdido','9. Stand by'].includes(s);
      }).length;
    });

    return { total: f.length, won3s, lost3s, byClass, byEstado, activeByProduct };
  }, [filtered]);

  const shortStage = (s) => (s || '').replace(/^\d+\.\s*/, '');

  // ══════════════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#EA1D2C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#64748b' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: 48, width: 400, boxShadow: '0 25px 60px rgba(0,0,0,.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Target size={28} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#EA1D2C' }}>SalesCRM</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94a3b8' }}>3S | Saipos | Comer Fora | GetIn | Emilia Vision</p>
          </div>
          {loginError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>{loginError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email" onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Senha" onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Entrar</button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════
  const NavBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => setView(id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: view === id ? '#EA1D2C' : 'transparent', color: view === id ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
      <Icon size={16} /> {label}
    </button>
  );

  const KPI = ({ icon: Icon, label, value, sub, color }) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', flex: 1, minWidth: 180, boxShadow: '0 1px 3px rgba(0,0,0,.05)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ background: color + '15', borderRadius: 8, padding: 6 }}><Icon size={16} color={color} /></div>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const ProductTab = ({ pkey }) => {
    const p = PRODUCTS[pkey];
    const count = filtered.filter(b => b.pipelines?.[pkey]?.stage).length;
    return (
      <button onClick={() => setActiveProduct(pkey)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: activeProduct === pkey ? `2px solid ${p.color}` : '1px solid #e2e8f0', background: activeProduct === pkey ? p.color + '10' : '#fff', color: activeProduct === pkey ? p.color : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
        {p.name}
        <span style={{ background: p.color + '20', color: p.color, fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10 }}>{count}</span>
      </button>
    );
  };

  const FilterSelect = ({ label, value, onChange, options }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 12px' }}>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1e293b', background: 'transparent', fontWeight: 500 }}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={18} color="#fff" /></div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#EA1D2C' }}>SalesCRM</span>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
          <NavBtn id="pipeline" icon={LayoutGrid} label="Pipeline" />
          <NavBtn id="contacts" icon={Users} label="Marcas" />
          <NavBtn id="dashboard" icon={TrendingUp} label="Dashboard" />
          <a href="/scorecard" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
            <Target size={16} /> Scorecard
          </a>
          <a href="/import" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
            <Upload size={16} /> Import CSV
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: profile?.role === 'admin' ? '#ef4444' : profile?.role === 'gestor' ? '#f59e0b' : '#EA1D2C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.role === 'admin' ? <Shield size={14} color="#fff" /> : profile?.role === 'gestor' ? <UserCheck size={14} color="#fff" /> : <Users size={14} color="#fff" />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{profile?.name}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>{profile?.role}</div>
            </div>
          </div>
          {saving && <div style={{ fontSize: 11, color: '#EA1D2C', fontWeight: 600 }}>Salvando...</div>}
          <button onClick={handleLogout} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer' }}><LogOut size={16} color="#94a3b8" /></button>
        </div>
      </div>

      {/* PRODUCT TABS */}
      {(view === 'pipeline' || view === 'contacts') && (
        <div style={{ padding: '14px 28px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.keys(PRODUCTS).map(pk => <ProductTab key={pk} pkey={pk} />)}
        </div>
      )}

      {/* FILTERS */}
      {(view === 'pipeline' || view === 'contacts') && (
        <div style={{ padding: '12px 28px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 14px', flex: 1, maxWidth: 320 }}>
            <Search size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar marca..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, color: '#1e293b' }} />
          </div>
          <FilterSelect label="Classificacao" value={filterClass} onChange={setFilterClass} options={['Todos','P','M','G']} />
          <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado} options={estados} />
          {profile?.role !== 'executivo' && <FilterSelect label="BDR" value={filterBDR} onChange={setFilterBDR} options={bdrs} />}
          {product?.closedStages && (
            <button onClick={() => setShowClosed(!showClosed)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: showClosed ? '#fef2f2' : '#fff', color: showClosed ? '#ef4444' : '#64748b', cursor: 'pointer' }}>
              {showClosed ? 'Ocultar Perdidos' : 'Mostrar Perdidos'}
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{filtered.length} marcas</div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ padding: '16px 28px 40px' }}>

        {/* PIPELINE */}
        {view === 'pipeline' && (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {pipelineStages.map(stage => {
              const stageB = getBrandsInStage(stage);
              const isClosed = product?.closedStages?.includes(stage);
              return (
                <div key={stage} style={{ flex: '0 0 220px', background: isClosed ? '#fef2f2' : '#fff', borderRadius: 14, border: `1px solid ${isClosed ? '#fecaca' : '#e2e8f0'}`, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>
                  <div style={{ padding: '12px 14px 8px', borderBottom: `2px solid ${product.color}`, position: 'sticky', top: 0, background: isClosed ? '#fef2f2' : '#fff', borderRadius: '14px 14px 0 0', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{shortStage(stage)}</span>
                      <span style={{ background: product.color + '18', color: product.color, fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10 }}>{stageB.length}</span>
                    </div>
                  </div>
                  <div style={{ padding: 6, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 50 }}>
                    {stageB.map(b => (
                      <div key={b.id} onClick={() => { setSelectedBrand(b); setDetailTab('info'); loadHistory(b.id, b._oldIds); }} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'all .12s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = product.color; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{b.marca}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{b.responsavel_closer}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {b.classificacao && <span style={{ fontSize: 10, background: (CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8') + '18', color: CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{b.classificacao}</span>}
                          {b.estado && <span style={{ fontSize: 10, background: '#dbeafe', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{b.estado}</span>}
                          {Object.entries(b.pipelines || {}).filter(([k, v]) => k !== activeProduct && v.stage).map(([k]) => (
                            <div key={k} title={PRODUCTS[k]?.name} style={{ width: 6, height: 6, borderRadius: '50%', background: PRODUCTS[k]?.color, marginTop: 3 }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CONTACTS TABLE */}
        {view === 'contacts' && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Marca','BDR','Closer',`Status ${product.name}`,'Class.','Estado','Lojas',''].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map(b => (
                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedBrand(b); setDetailTab('info'); loadHistory(b.id, b._oldIds); }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 13 }}>{b.marca}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.responsavel_bdr}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.responsavel_closer}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 11, background: product.color + '15', color: product.color, padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{shortStage(b.pipelines?.[activeProduct]?.stage || '—')}</span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8' }}>{b.classificacao || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.estado || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.qtd_lojas_fisicas || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <button onClick={e => { e.stopPropagation(); setSelectedBrand(b); setDetailTab('pipelines'); loadHistory(b.id, b._oldIds); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}><Eye size={13} color="#EA1D2C" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {view === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <KPI icon={Building2} label="Total Marcas" value={metrics.total} color="#EA1D2C" />
              <KPI icon={Check} label="Contratos 3S" value={metrics.won3s} sub="Contrato assinado" color="#22c55e" />
              <KPI icon={AlertCircle} label="Perdidos 3S" value={metrics.lost3s} color="#ef4444" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Marcas Ativas por Produto</h4>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={Object.entries(metrics.activeByProduct).map(([k, v]) => ({ name: PRODUCTS[k]?.name || k, count: v, fill: PRODUCTS[k]?.color || '#EA1D2C' }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {Object.keys(metrics.activeByProduct).map((k, i) => <Cell key={i} fill={PRODUCTS[k]?.color || '#EA1D2C'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Top 10 Estados</h4>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={Object.entries(metrics.byEstado).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis dataKey="name" type="category" width={30} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#DA5D69" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL PANEL */}
      {selectedBrand && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', boxShadow: '-4px 0 30px rgba(0,0,0,.12)', zIndex: 50, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
            <button onClick={() => setSelectedBrand(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><ArrowLeft size={16} /> Voltar</button>
            <div style={{ display: 'flex', gap: 6 }}>
              {['info', 'pipelines', 'historico'].map(t => (
                <button key={t} onClick={() => setDetailTab(t)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: detailTab === t ? '#EA1D2C' : '#f1f5f9', color: detailTab === t ? '#fff' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {t === 'info' ? 'Info' : t === 'pipelines' ? 'Produtos' : 'Historico'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{selectedBrand.marca}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {selectedBrand.classificacao && <span style={{ fontSize: 11, background: (CLASSIFICACAO_COLORS[selectedBrand.classificacao] || '#94a3b8') + '20', color: CLASSIFICACAO_COLORS[selectedBrand.classificacao], padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{selectedBrand.classificacao}</span>}
              {selectedBrand.estado && <span style={{ fontSize: 11, background: '#dbeafe', color: '#2563eb', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{selectedBrand.estado}</span>}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
            {/* INFO */}
            {detailTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['BDR', selectedBrand.responsavel_bdr], ['Closer', selectedBrand.responsavel_closer], ['Coord. Delivery', selectedBrand.coordenador_delivery], ['Exec. Delivery', selectedBrand.executivo_delivery], ['Lojas', selectedBrand.qtd_lojas_fisicas], ['PDV Atual', selectedBrand.pdv_atual], ['Base Elegivel', selectedBrand.base_elegivel]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span style={{ color: '#64748b' }}>{l}</span>
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{v || '—'}</span>
                  </div>
                ))}
                {selectedBrand.proximo_passo && <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 13, color: '#475569', marginTop: 8 }}><strong>Proximo Passo:</strong> {selectedBrand.proximo_passo}</div>}
              </div>
            )}

            {/* PIPELINES */}
            {detailTab === 'pipelines' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(PRODUCTS).map(([key, prod]) => {
                  const pipeline = selectedBrand.pipelines?.[key];
                  const isActive = pipeline?.stage;
                  return (
                    <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', background: isActive ? prod.color + '10' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? prod.color : '#cbd5e1' }} />
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{prod.name}</span>
                        </div>
                        {!isActive ? (
                          <button onClick={() => enableProduct(selectedBrand.id, key)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: `1px solid ${prod.color}`, background: 'transparent', color: prod.color, fontWeight: 600, cursor: 'pointer' }}>Ativar</button>
                        ) : (
                          <span style={{ fontSize: 12, background: prod.color + '20', color: prod.color, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{shortStage(pipeline.stage)}</span>
                        )}
                      </div>
                      {isActive && (
                        <div style={{ padding: '12px 18px' }}>
                          <select value={pipeline.stage} onChange={e => changeStage(selectedBrand.id, key, e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                            {prod.stages.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* HISTORY */}
            {detailTab === 'historico' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {brandHistory.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>Nenhuma movimentacao registrada</p>}
                {brandHistory.map(h => (
                  <div key={h.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 12 }}>
                    <div style={{ flex: '0 0 80px', color: '#94a3b8' }}>{new Date(h.created_at).toLocaleDateString('pt-BR')}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#94a3b8' }}>{shortStage(h.from_stage)}</span>
                      <span style={{ margin: '0 6px', color: '#cbd5e1' }}>&rarr;</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{shortStage(h.to_stage)}</span>
                      <span style={{ marginLeft: 8, fontSize: 10, background: (PRODUCTS[h.product]?.color || '#EA1D2C') + '20', color: PRODUCTS[h.product]?.color || '#EA1D2C', padding: '1px 6px', borderRadius: 4 }}>{PRODUCTS[h.product]?.name || h.product}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>{h.changed_by_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
                      