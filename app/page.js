'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PRODUCTS, CLASSIFICACAO_COLORS, MONTH_NAMES, DUPLAS, getMonthBusinessDays, getMonthBusinessDaysMTD } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Target, Search, Eye, ArrowLeft, Filter, Calendar, History, LayoutGrid, LogOut, Shield, UserCheck, AlertCircle, Check, Building2, Upload, Plus, Save } from 'lucide-react';
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
  const [filterClass, setFilterClass] = useState([]);
  const [filterEstado, setFilterEstado] = useState([]);
  const [filterBDR, setFilterBDR] = useState([]);
  const [filterPDV, setFilterPDV] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [detailTab, setDetailTab] = useState('info');
  const [brandHistory, setBrandHistory] = useState([]);
  const [showClosed, setShowClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  // Editable fields (local state for pending changes)
  const [editLojas, setEditLojas] = useState('');
  const [editPDV, setEditPDV] = useState('');
  const [editBaseElegivel, setEditBaseElegivel] = useState([]);
  const [editFUP, setEditFUP] = useState('');
  const [infoChanged, setInfoChanged] = useState(false);
  const [pipelinesChanged, setPipelinesChanged] = useState(false);
  // Track pending responsavel changes
  const [pendingResp, setPendingResp] = useState({});
  // ── Init edit fields when selecting a brand ──
  const openBrandDetail = (brand, tab) => {
    setSelectedBrand(brand);
    setDetailTab(tab || 'info');
    setEditLojas(brand.qtd_lojas_fisicas || '');
    setEditPDV(brand.pdv_atual || '');
    const be = brand.base_elegivel || '';
    setEditBaseElegivel(be ? be.split(',').map(s => s.trim()).filter(Boolean) : []);
    setEditFUP(brand.proximo_passo || '');
    setInfoChanged(false);
    setPipelinesChanged(false);
    setPendingResp({});
    loadHistory(brand.id, brand._oldIds);
  };
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
    const res = await fetch('/api/brands?limit=999');
    const data = await res.json();
    if (data.brands) setBrands(data.brands);
  }, []);
  useEffect(() => {
    if (user) loadBrands();
  }, [user, loadBrands]);
  // ── Role-based filtering ──
  const filtered = useMemo(() => {
    let d = brands;
    if (profile?.role === 'executivo') {
      d = d.filter(b => b.responsavel_bdr === profile.name || b.responsavel_closer === profile.name || Object.values(b.pipelines || {}).some(p => p.responsavel && p.responsavel.includes(profile.name)));
    }
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(b => (b.marca||'').toLowerCase().includes(q) || (b.responsavel_bdr||'').toLowerCase().includes(q) || (b.responsavel_closer||'').toLowerCase().includes(q));
    }
    if (filterClass.length > 0) d = d.filter(b => filterClass.includes(b.classificacao));
    if (filterEstado.length > 0) d = d.filter(b => filterEstado.includes(b.estado));
    if (filterBDR.length > 0) d = d.filter(b => filterBDR.includes(b.responsavel_bdr));
    if (filterPDV.length > 0) d = d.filter(b => filterPDV.includes(b.pdv_atual));
    return d;
  }, [brands, profile, search, filterClass, filterEstado, filterBDR, filterPDV]);
  // ── Change stage ──
  const changeStage = async (brandId, productKey, newStage) => {
    setSaving(true);
    setSelectedBrand(prev => prev && prev.id === brandId ? { ...prev, pipelines: { ...prev.pipelines, [productKey]: { ...prev.pipelines?.[productKey], stage: newStage } } } : prev);
    setBrands(prev => prev.map(b => b.id === brandId ? { ...b, pipelines: { ...b.pipelines, [productKey]: { ...b.pipelines?.[productKey], stage: newStage } } } : b));
    try {
      await fetch('/api/pipelines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, product: productKey, new_stage: newStage, user_id: user?.id, user_name: profile?.name }),
      });
      const freshRes = await fetch('/api/brands?limit=999');
      const freshData = await freshRes.json();
      if (freshData.brands) {
        setBrands(freshData.brands);
        setSelectedBrand(prev => prev ? freshData.brands.find(b => b.id === prev.id) || prev : prev);
      }
    } catch (err) { console.error('Error changing stage:', err); }
    setSaving(false);
  };
  // ── Save pending responsavel changes (batch) ──
  const savePendingResponsaveis = async (brandId) => {
    for (const [prodKey, newResp] of Object.entries(pendingResp)) {
      await fetch('/api/pipelines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, product: prodKey, responsavel: newResp, user_id: user?.id, user_name: profile?.name }),
      });
    }
  };
  // ── Enable product ──
  const enableProduct = async (brandId, productKey) => {
    setSaving(true);
    setSelectedBrand(prev => prev && prev.id === brandId ? { ...prev, pipelines: { ...prev.pipelines, [productKey]: { stage: '0. Nao Iniciado', active: true, responsavel: '' } } } : prev);
    await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: brandId, product: productKey, user_id: user?.id, user_name: profile?.name }),
    });
    const freshRes = await fetch('/api/brands?limit=999');
    const freshData = await freshRes.json();
    if (freshData.brands) {
      setBrands(freshData.brands);
      setSelectedBrand(prev => prev ? freshData.brands.find(b => b.id === prev.id) || prev : prev);
    }
    setSaving(false);
  };
  // ── Load history ──
  const loadHistory = async (brandId, oldIds) => {
    let url = `/api/history?brand_id=${brandId}`;
    if (oldIds && oldIds.length > 0) url += `&old_ids=${oldIds.join(',')}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.history) setBrandHistory(data.history);
  };
  // ── Save info changes (button click) ──
  const saveInfoChanges = async () => {
    if (!selectedBrand) return;
    setSaving(true);
    try {
      const updates = {};
      if (String(editLojas) !== String(selectedBrand.qtd_lojas_fisicas || '')) updates.qtd_lojas_fisicas = editLojas === '' ? 0 : Number(editLojas);
      if (editPDV !== (selectedBrand.pdv_atual || '')) updates.pdv_atual = editPDV;
      const newBE = editBaseElegivel.join(', ');
      if (newBE !== (selectedBrand.base_elegivel || '')) updates.base_elegivel = newBE;
      if (editFUP !== (selectedBrand.proximo_passo || '')) updates.proximo_passo = editFUP;
      if (Object.keys(updates).length > 0) {
        await fetch('/api/brands', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedBrand.id, ...updates, user_id: user?.id, user_name: profile?.name }),
        });
      }
      const freshRes = await fetch('/api/brands?limit=999');
      const freshData = await freshRes.json();
      if (freshData.brands) {
        setBrands(freshData.brands);
        const updated = freshData.brands.find(b => b.id === selectedBrand.id);
        if (updated) {
          setSelectedBrand(updated);
          setEditLojas(updated.qtd_lojas_fisicas || '');
          setEditPDV(updated.pdv_atual || '');
          const be = updated.base_elegivel || '';
          setEditBaseElegivel(be ? be.split(',').map(s => s.trim()).filter(Boolean) : []);
          setEditFUP(updated.proximo_passo || '');
        }
      }
      setInfoChanged(false);
    } catch (err) { console.error('Save error:', err); }
    setSaving(false);
  };
  // ── Save pipelines changes (responsavel batch) ──
  const savePipelinesChanges = async () => {
    if (!selectedBrand) return;
    setSaving(true);
    try {
      await savePendingResponsaveis(selectedBrand.id);
      const freshRes = await fetch('/api/brands?limit=999');
      const freshData = await freshRes.json();
      if (freshData.brands) {
        setBrands(freshData.brands);
        const updated = freshData.brands.find(b => b.id === selectedBrand.id);
        if (updated) setSelectedBrand(updated);
      }
      setPendingResp({});
      setPipelinesChanged(false);
    } catch (err) { console.error('Save pipelines error:', err); }
    setSaving(false);
  };
  // ── Export data ──
  const exportData = async () => {
    setSaving(true);
    try {
      const histRes = await fetch('/api/history?limit=9999');
      const histData = await histRes.json();
      const allHistory = histData.history || [];
      const prodKeys = Object.keys(PRODUCTS);
      const headers = ['Marca', 'Classificacao', 'Estado', 'Lojas', 'PDV Atual', 'BDR', 'Closer'];
      prodKeys.forEach(pk => { headers.push(`Status ${PRODUCTS[pk].name}`); headers.push(`Resp. ${PRODUCTS[pk].name}`); });
      headers.push('Historico');
      const csvRows = [headers.join(';')];
      filtered.forEach(b => {
        const row = [b.marca || '', b.classificacao || '', b.estado || '', b.qtd_lojas_fisicas || 0, b.pdv_atual || '', b.responsavel_bdr || '', b.responsavel_closer || ''];
        prodKeys.forEach(pk => { row.push(b.pipelines?.[pk]?.stage || ''); row.push(b.pipelines?.[pk]?.responsavel || ''); });
        const brandHist = allHistory.filter(h => h.brand_id === b.id || (b._oldIds && b._oldIds.includes(h.brand_id)));
        const histStr = brandHist.map(h => `${new Date(h.created_at).toLocaleDateString('pt-BR')} ${PRODUCTS[h.product]?.name || h.product}: ${h.from_stage} > ${h.to_stage}`).join(' | ');
        row.push(histStr);
        csvRows.push(row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'));
      });
      const bom = '﻿';
      const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRM_Export_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('Export error:', err); }
    setSaving(false);
  };
  // ── Pipeline helpers ──
  const product = PRODUCTS[activeProduct];
  const pipelineStages = useMemo(() => {
    if (!product) return [];
    if (showClosed) return product.stages;
    return product.activeStages || product.stages;
  }, [activeProduct, showClosed, product]);
  const getBrandsInStage = useCallback((stage) => {
    return filtered.filter(b => { const p = b.pipelines?.[activeProduct]; return p && p.stage === stage; });
  }, [filtered, activeProduct]);
  const estados = useMemo(() => {
    const s = new Set(brands.map(b => b.estado).filter(e => e && e.length === 2));
    return ['Todos', ...Array.from(s).sort()];
  }, [brands]);
  const bdrs = useMemo(() => {
    const s = new Set(brands.map(b => b.responsavel_bdr).filter(Boolean));
    return Array.from(s).sort();
  }, [brands]);
  const pdvs = useMemo(() => {
    const s = new Set(brands.map(b => b.pdv_atual).filter(Boolean));
    return Array.from(s).sort();
  }, [brands]);
  const metrics = useMemo(() => {
    const f = filtered;
    const won3s = f.filter(b => b.pipelines?.['3s']?.stage === '9. Contrato assinado').length;
    const lost3s = f.filter(b => b.pipelines?.['3s']?.stage === '10. Perdido').length;
    const byClass = {}; f.forEach(b => { if (b.classificacao) byClass[b.classificacao] = (byClass[b.classificacao] || 0) + 1; });
    const byEstado = {}; f.forEach(b => { if (b.estado && b.estado.length === 2) byEstado[b.estado] = (byEstado[b.estado] || 0) + 1; });
    const activeByProduct = {};
    Object.keys(PRODUCTS).forEach(pk => {
      activeByProduct[pk] = f.filter(b => { const s = b.pipelines?.[pk]?.stage; return s && !['10. Perdido','11. Stand by','8. Perdido','9. Stand by'].includes(s); }).length;
    });
    return { total: f.length, won3s, lost3s, byClass, byEstado, activeByProduct };
  }, [filtered]);
  const shortStage = (s) => (s || '').replace(/^\d+\.\s*/, '');
  // Base elegivel options
  const BASE_ELEGIVEL_OPTIONS = ['FY26', 'FY27', 'Organico 3S'];
  const toggleBaseElegivel = (opt) => {
    setInfoChanged(true);
    if (editBaseElegivel.includes(opt)) setEditBaseElegivel(editBaseElegivel.filter(v => v !== opt));
    else setEditBaseElegivel([...editBaseElegivel, opt]);
  };
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
  const MultiFilter = ({ label, selected, onChange, options }) => {
    const [open, setOpen] = useState(false);
    const toggle = (val) => {
      if (selected.includes(val)) onChange(selected.filter(v => v !== val));
      else onChange([...selected, val]);
    };
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: selected.length > 0 ? '#fef2f2' : '#fff', border: selected.length > 0 ? '1px solid #EA1D2C' : '1px solid #e2e8f0', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: selected.length > 0 ? '#EA1D2C' : '#64748b', fontWeight: 500 }}>
          <Filter size={12} />
          {label}{selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 50, padding: 6, minWidth: 160, maxHeight: 220, overflowY: 'auto' }}>
            {selected.length > 0 && <button onClick={() => { onChange([]); setOpen(false); }} style={{ width: '100%', padding: '6px 10px', border: 'none', background: 'none', fontSize: 11, color: '#EA1D2C', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}>Limpar filtro</button>}
            {options.map(o => (
              <button key={o} onClick={() => toggle(o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 10px', border: 'none', background: selected.includes(o) ? '#fef2f2' : 'transparent', borderRadius: 6, fontSize: 12, color: '#1e293b', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: selected.includes(o) ? '2px solid #EA1D2C' : '1px solid #cbd5e1', background: selected.includes(o) ? '#EA1D2C' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected.includes(o) && <Check size={10} color="#fff" />}
                </div>
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };
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
          <a href="/input" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
            <Plus size={16} /> Nova Marca
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
          <MultiFilter label="Classificacao" selected={filterClass} onChange={setFilterClass} options={['P','M','G']} />
          <MultiFilter label="Estado" selected={filterEstado} onChange={setFilterEstado} options={estados.filter(e => e !== 'Todos')} />
          {profile?.role !== 'executivo' && <MultiFilter label="Responsavel" selected={filterBDR} onChange={setFilterBDR} options={bdrs} />}
          {pdvs.length > 0 && <MultiFilter label="PDV" selected={filterPDV} onChange={setFilterPDV} options={pdvs} />}
          {product?.closedStages && (
            <button onClick={() => setShowClosed(!showClosed)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: showClosed ? '#fef2f2' : '#fff', color: showClosed ? '#ef4444' : '#64748b', cursor: 'pointer' }}>
              {showClosed ? 'Ocultar Perdidos' : 'Mostrar Perdidos'}
            </button>
          )}
          <button onClick={exportData} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Upload size={12} style={{ transform: 'rotate(180deg)' }} /> Exportar
          </button>
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
                      <div key={b.id} onClick={() => openBrandDetail(b, 'info')} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'all .12s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = product.color; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{b.marca}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Resp: {b.pipelines?.[activeProduct]?.responsavel || (activeProduct === '3s' ? `${b.responsavel_bdr || '—'} / ${b.responsavel_closer || '—'}` : '—')}</div>
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
                    {['Marca','Responsavel',`Status ${product.name}`,'Class.','Estado','Lojas',''].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map(b => (
                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => openBrandDetail(b, 'info')}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 13 }}>{b.marca}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.pipelines?.[activeProduct]?.responsavel || (activeProduct === '3s' ? `${b.responsavel_bdr || ''} / ${b.responsavel_closer || ''}` : '—')}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 11, background: product.color + '15', color: product.color, padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{shortStage(b.pipelines?.[activeProduct]?.stage || '—')}</span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8' }}>{b.classificacao || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.estado || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.qtd_lojas_fisicas || '—'}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <button onClick={e => { e.stopPropagation(); openBrandDetail(b, 'pipelines'); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}><Eye size={13} color="#EA1D2C" /></button>
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
            {/* INFO TAB */}
            {detailTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['Resp. 3S', selectedBrand.pipelines?.['3s']?.responsavel || `${selectedBrand.responsavel_bdr || '—'} / ${selectedBrand.responsavel_closer || '—'}`], ['Coord. Delivery', selectedBrand.coordenador_delivery], ['Exec. Delivery', selectedBrand.executivo_delivery]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span style={{ color: '#64748b' }}>{l}</span>
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{v || '—'}</span>
                  </div>
                ))}
                {/* Editable: Lojas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Lojas</span>
                  <input type="number" value={editLojas} onChange={e => { setEditLojas(e.target.value); setInfoChanged(true); }} style={{ width: 80, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'right', outline: 'none' }} />
                </div>
                {/* Editable: PDV Atual */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>PDV Atual</span>
                  <input type="text" value={editPDV} onChange={e => { setEditPDV(e.target.value); setInfoChanged(true); }} placeholder="Ex: iFood, Rappi..." style={{ width: 160, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'right', outline: 'none' }} />
                </div>
                {/* Editable: Base Elegivel (multi-select) */}
                <div style={{ fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: 6 }}>Base Elegivel</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {BASE_ELEGIVEL_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => toggleBaseElegivel(opt)} style={{ padding: '4px 12px', borderRadius: 20, border: editBaseElegivel.includes(opt) ? '2px solid #EA1D2C' : '1px solid #e2e8f0', background: editBaseElegivel.includes(opt) ? '#fef2f2' : '#fff', color: editBaseElegivel.includes(opt) ? '#EA1D2C' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {editBaseElegivel.includes(opt) && <Check size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Editable: FUP */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Proximo Passo / FUP</div>
                  <textarea value={editFUP} onChange={e => { setEditFUP(e.target.value); setInfoChanged(true); }} placeholder="Descreva o proximo passo, data do FUP..." rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', color: '#475569', boxSizing: 'border-box' }} />
                </div>
                {/* SAVE BUTTON */}
                {infoChanged && (
                  <button onClick={saveInfoChanges} disabled={saving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #EA1D2C, #DA5D69)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', marginTop: 8 }}>
                    <Save size={16} />
                    {saving ? 'Salvando...' : 'Salvar Alteracoes'}
                  </button>
                )}
              </div>
            )}
            {/* PIPELINES TAB */}
            {detailTab === 'pipelines' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(PRODUCTS).map(([key, prod]) => {
                  const pipeline = selectedBrand.pipelines?.[key];
                  const isActive = pipeline?.stage;
                  const currentResp = pendingResp[key] !== undefined ? pendingResp[key] : (pipeline?.responsavel || '');
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
                        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <select value={pipeline.stage} onChange={e => changeStage(selectedBrand.id, key, e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                            {prod.stages.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Responsavel:</span>
                            <select value={currentResp} onChange={e => { setPendingResp({ ...pendingResp, [key]: e.target.value }); setPipelinesChanged(true); }} style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff' }}>
                              <option value="">Selecione...</option>
                              {(prod.responsaveis || []).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* SAVE BUTTON for pipelines */}
                {pipelinesChanged && (
                  <button onClick={savePipelinesChanges} disabled={saving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #EA1D2C, #DA5D69)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', marginTop: 8 }}>
                    <Save size={16} />
                    {saving ? 'Salvando...' : 'Salvar Alteracoes'}
                  </button>
                )}
              </div>
            )}
            {/* HISTORY TAB */}
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
                      <span style={{ marginLeft: 8, fontSize: 10, background: (h.product === 'fup' ? '#8b5cf6' : PRODUCTS[h.product]?.color || '#EA1D2C') + '20', color: h.product === 'fup' ? '#8b5cf6' : PRODUCTS[h.product]?.color || '#EA1D2C', padding: '1px 6px', borderRadius: 4 }}>{h.product === 'fup' ? 'FUP' : (PRODUCTS[h.product]?.name || h.product)}</span>
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
