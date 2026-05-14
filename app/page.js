'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PRODUCTS, CLASSIFICACAO_COLORS, MONTH_NAMES, DUPLAS, getMonthBusinessDays, getMonthBusinessDaysMTD } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Target, Search, Eye, ArrowLeft, Filter, Calendar, History, LayoutGrid, LogOut, Shield, UserCheck, AlertCircle, Check, Building2, Upload, Plus, Save, Sparkles, Award, FlaskConical, X } from 'lucide-react';
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
  const [filterBaseElegivel, setFilterBaseElegivel] = useState([]);
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
  const [editCulinaria, setEditCulinaria] = useState('');
  const [infoChanged, setInfoChanged] = useState(false);
  const [pipelinesChanged, setPipelinesChanged] = useState(false);
  // Track pending responsavel changes
  const [pendingResp, setPendingResp] = useState({});
  // ── TEST MODE ──
  const [testMode, setTestMode] = useState(false);
  // ── Open filter tracking ──
  const [openFilter, setOpenFilter] = useState(null);
  // ── Init edit fields when selecting a brand ──
  const openBrandDetail = (brand, tab) => {
    setSelectedBrand(brand);
    setDetailTab(tab || 'info');
    setEditLojas(brand.qtd_lojas_fisicas || '');
    setEditPDV(brand.pdv_atual || '');
    const be = brand.base_elegivel || '';
    setEditBaseElegivel(be ? be.split(',').map(s => s.trim()).filter(Boolean) : []);
    setEditFUP(brand.proximo_passo || '');
    setEditCulinaria(brand.culinaria || '');
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
  const handleResetPassword = async () => {
    if (!loginEmail) { setLoginError('Digite seu email primeiro'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, { redirectTo: window.location.origin });
    if (error) setLoginError('Erro ao enviar email de recuperacao');
    else setLoginError('');
    alert(error ? 'Erro: ' + error.message : 'Email de recuperacao enviado! Verifique sua caixa de entrada.');
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
  // Viewer = read-only (vê tudo, não edita nada)
  const canEdit = profile?.role !== 'viewer';
  // ── Role-based filtering ──
  const filtered = useMemo(() => {
    let d = brands;
    if (profile?.role === 'executivo') {
      if (profile.team === 'saipos') {
        // Marcos/Lucas: veem todas as marcas que têm pipeline saipos ou totem
        d = d.filter(b => b.pipelines?.saipos || b.pipelines?.totem);
      } else {
        d = d.filter(b => b.responsavel_bdr === profile.name || b.responsavel_closer === profile.name || Object.values(b.pipelines || {}).some(p => p.responsavel && p.responsavel.includes(profile.name)));
      }
    }
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(b => (b.marca||'').toLowerCase().includes(q) || (b.responsavel_bdr||'').toLowerCase().includes(q) || (b.responsavel_closer||'').toLowerCase().includes(q));
    }
    if (filterClass.length > 0) d = d.filter(b => filterClass.includes(b.classificacao));
    if (filterEstado.length > 0) d = d.filter(b => filterEstado.includes(b.estado));
    if (filterBDR.length > 0) d = d.filter(b => filterBDR.includes(b.responsavel_bdr));
    if (filterPDV.length > 0) d = d.filter(b => filterPDV.includes(b.pdv_atual));
    if (filterBaseElegivel.length > 0) d = d.filter(b => { const be = (b.base_elegivel || "").split(",").map(s => s.trim()); return filterBaseElegivel.some(f => be.includes(f)); });
    return d;
  }, [brands, profile, search, filterClass, filterEstado, filterBDR, filterPDV, filterBaseElegivel]);
  // ── Change stage (respects testMode) ──
  const changeStage = async (brandId, productKey, newStage) => {
    setSaving(true);
    setSelectedBrand(prev => prev && prev.id === brandId ? { ...prev, pipelines: { ...prev.pipelines, [productKey]: { ...prev.pipelines?.[productKey], stage: newStage } } } : prev);
    setBrands(prev => prev.map(b => b.id === brandId ? { ...b, pipelines: { ...b.pipelines, [productKey]: { ...b.pipelines?.[productKey], stage: newStage } } } : b));
    if (!testMode) {
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
    }
    setSaving(false);
  };
  // ── Save pending responsavel changes (batch) ──
  const savePendingResponsaveis = async (brandId) => {
    if (testMode) return;
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
    if (!testMode) {
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
    }
    setSaving(false);
  };
  // ── Disable product ──
  const disableProduct = async (brandId, productKey) => {
    if (!confirm('Desativar ' + (PRODUCTS[productKey]?.name || productKey) + ' desta marca?')) return;
    setSaving(true);
    setSelectedBrand(prev => {
      if (!prev || prev.id !== brandId) return prev;
      const newPipelines = { ...prev.pipelines };
      delete newPipelines[productKey];
      return { ...prev, pipelines: newPipelines };
    });
    setBrands(prev => prev.map(b => {
      if (b.id !== brandId) return b;
      const newPipelines = { ...b.pipelines };
      delete newPipelines[productKey];
      return { ...b, pipelines: newPipelines };
    }));
    if (!testMode) {
      await fetch('/api/pipelines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, product: productKey, new_stage: '14. Desativado', user_id: user?.id, user_name: profile?.name }),
      });
      const freshRes = await fetch('/api/brands?limit=999');
      const freshData = await freshRes.json();
      if (freshData.brands) {
        setBrands(freshData.brands);
        setSelectedBrand(prev => prev ? freshData.brands.find(b => b.id === prev.id) || prev : prev);
      }
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
  // ── Save info changes (button click) — respects testMode ──
  const saveInfoChanges = async () => {
    if (!selectedBrand) return;
    if (testMode) { setInfoChanged(false); return; }
    setSaving(true);
    try {
      const updates = {};
      if (String(editLojas) !== String(selectedBrand.qtd_lojas_fisicas || '')) updates.qtd_lojas_fisicas = editLojas === '' ? 0 : Number(editLojas);
      if (editPDV !== (selectedBrand.pdv_atual || '')) updates.pdv_atual = editPDV;
      const newBE = editBaseElegivel.join(', ');
      if (newBE !== (selectedBrand.base_elegivel || '')) updates.base_elegivel = newBE;
      if (editFUP !== (selectedBrand.proximo_passo || '')) updates.proximo_passo = editFUP;
      if (editCulinaria !== (selectedBrand.culinaria || '' )) updates.culinaria = editCulinaria;
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
  // ── Save pipelines changes (responsavel batch) — respects testMode ──
  const savePipelinesChanges = async () => {
    if (!selectedBrand) return;
    if (testMode) { setPendingResp({}); setPipelinesChanged(false); return; }
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
  // ── Export data — history as separate rows ──
  const exportData = async () => {
    setSaving(true);
    try {
      const histRes = await fetch('/api/history?limit=9999');
      const histData = await histRes.json();
      const allHistory = histData.history || [];
      const prodKeys = Object.keys(PRODUCTS);
      const headers = ['Marca', 'Classificacao', 'Estado', 'Lojas', 'PDV Atual', 'BDR', 'Closer'];
      prodKeys.forEach(pk => { headers.push(`Status ${PRODUCTS[pk].name}`); headers.push(`Resp. ${PRODUCTS[pk].name}`); });
      headers.push('Data Alteracao', 'Produto Alterado', 'De', 'Para', 'Alterado por');
      const csvRows = [headers.join(';')];
      filtered.forEach(b => {
        const baseRow = [b.marca || '', b.classificacao || '', b.estado || '', b.qtd_lojas_fisicas || 0, b.pdv_atual || '', b.responsavel_bdr || '', b.responsavel_closer || ''];
        prodKeys.forEach(pk => { baseRow.push(b.pipelines?.[pk]?.stage || ''); baseRow.push(b.pipelines?.[pk]?.responsavel || ''); });
        const brandHist = allHistory.filter(h => h.brand_id === b.id || (b._oldIds && b._oldIds.includes(h.brand_id)));
        if (brandHist.length === 0) {
          csvRows.push([...baseRow, '', '', '', '', ''].map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'));
        } else {
          brandHist.forEach(h => {
            const row = [...baseRow, new Date(h.created_at).toLocaleDateString('pt-BR'), PRODUCTS[h.product]?.name || h.product, h.from_stage || '', h.to_stage || '', h.changed_by_name || 'Sistema'];
            csvRows.push(row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'));
          });
        }
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
      activeByProduct[pk] = f.filter(b => { const s = b.pipelines?.[pk]?.stage; return s && !['10. Perdido','11. Stand by','8. Perdido','9. Stand by','14. Desativado'].includes(s); }).length;
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
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94a3b8' }}>3S | Saipos | Totem | Comer Fora | GetIn | Emilia Vision</p>
          </div>
          {loginError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>{loginError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email" onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Senha" onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Entrar</button>
            <button onClick={handleResetPassword} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Esqueci minha senha</button>
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
  const MultiFilter = ({ label, selected, onChange, options, filterId }) => {
    const isOpen = openFilter === filterId;
    const toggle = (val) => {
      if (selected.includes(val)) onChange(selected.filter(v => v !== val));
      else onChange([...selected, val]);
    };
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpenFilter(isOpen ? null : filterId)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: selected.length > 0 ? '#fef2f2' : '#fff', border: selected.length > 0 ? '1px solid #EA1D2C' : '1px solid #e2e8f0', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: selected.length > 0 ? '#EA1D2C' : '#64748b', fontWeight: 500 }}>
          <Filter size={12} />
          {label}{selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
        {isOpen && (
          <>
            <div onClick={() => setOpenFilter(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 50, padding: 6, minWidth: 180, maxHeight: 260, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 10px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{label}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {selected.length > 0 && <button onClick={() => { onChange([]); setOpenFilter(null); }} style={{ border: 'none', background: 'none', fontSize: 11, color: '#EA1D2C', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Limpar</button>}
                  <button onClick={() => setOpenFilter(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} color="#94a3b8" /></button>
                </div>
              </div>
              {options.map(o => (
                <button key={o} onClick={() => toggle(o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 10px', border: 'none', background: selected.includes(o) ? '#fef2f2' : 'transparent', borderRadius: 6, fontSize: 12, color: '#1e293b', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: selected.includes(o) ? '2px solid #EA1D2C' : '1px solid #cbd5e1', background: selected.includes(o) ? '#EA1D2C' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected.includes(o) && <Check size={10} color="#fff" />}
                  </div>
                  {o}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };
  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* TEST MODE BANNER */}
      {testMode && (
        <div style={{ background: '#fef3c7', borderBottom: '2px solid #f59e0b', padding: '8px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: '#92400e' }}>
          <FlaskConical size={16} />
          Modo Teste ativo — alteracoes NAO serao salvas no banco de dados
          <button onClick={() => { setTestMode(false); loadBrands(); }} style={{ marginLeft: 12, padding: '4px 12px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Desativar e recarregar</button>
        </div>
      )}
      {/* HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: testMode ? 42 : 0, zIndex: 40 }}>
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
          {canEdit && <a href="/input" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
            <Plus size={16} /> Nova Marca
          </a>}
          <a href="/rv" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
            <Award size={16} /> RV
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {profile?.role === 'admin' && (
            <button onClick={() => setTestMode(!testMode)} title="Modo Teste" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: testMode ? '2px solid #f59e0b' : '1px solid #e2e8f0', background: testMode ? '#fef3c7' : '#fff', color: testMode ? '#92400e' : '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <FlaskConical size={14} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: profile?.role === 'admin' ? '#ef4444' : profile?.role === 'gestor' ? '#f59e0b' : profile?.role === 'viewer' ? '#6366f1' : '#EA1D2C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.role === 'admin' ? <Shield size={14} color="#fff" /> : profile?.role === 'gestor' ? <UserCheck size={14} color="#fff" /> : profile?.role === 'viewer' ? <Eye size={14} color="#fff" /> : <Users size={14} color="#fff" />}
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
          <MultiFilter label="Classificacao" selected={filterClass} onChange={setFilterClass} options={['P','M','G']} filterId="class" />
          <MultiFilter label="Estado" selected={filterEstado} onChange={setFilterEstado} options={estados.filter(e => e !== 'Todos')} filterId="estado" />
          {profile?.role !== 'executivo' && <MultiFilter label="Responsavel" selected={filterBDR} onChange={setFilterBDR} options={bdrs} filterId="bdr" />}
          {pdvs.length > 0 && <MultiFilter label="PDV" selected={filterPDV} onChange={setFilterPDV} options={pdvs} filterId="pdv" />}
          <MultiFilter label="Base Elegivel" selected={filterBaseElegivel} onChange={setFilterBaseElegivel} options={["FY26","FY27","Organico 3S"]} filterId="base" />
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
                          {b.culinaria && <span style={{ fontSize: 10, background: "#faf5ff", color: "#7c3aed", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{b.culinaria}</span>}
                          {b.produto_totem && <span style={{ fontSize: 10, background: "#fefce8", color: "#a16207", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{b.produto_totem}</span>}
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
                <button key={t} onClick={() => { setDetailTab(t); if (t === 'historico') loadHistory(selectedBrand.id, selectedBrand._oldIds); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: detailTab === t ? '#EA1D2C' : '#f1f5f9', color: detailTab === t ? '#fff' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
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
                {[['Responsavel', selectedBrand.pipelines?.['3s']?.responsavel || `${selectedBrand.responsavel_bdr || '—'} / ${selectedBrand.responsavel_closer || '—'}`], ['Coord. Delivery', selectedBrand.coordenador_delivery], ['Exec. Delivery', selectedBrand.executivo_delivery], ...(selectedBrand.produto_totem ? [['Produto Totem', selectedBrand.produto_totem]] : [])].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span style={{ color: '#64748b' }}>{l}</span>
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>{v || '—'}</span>
                  </div>
                ))}
                {/* Editable: Lojas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Lojas</span>
                  <input type="number" value={editLojas} onChange={e => { setEditLojas(e.target.value); setInfoChanged(true); }} disabled={!canEdit} style={{ width: 80, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'right', outline: 'none', opacity: canEdit ? 1 : 0.6 }} />
                </div>
                {/* Editable: PDV Atual */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>PDV Atual</span>
                  <input type="text" value={editPDV} onChange={e => { setEditPDV(e.target.value); setInfoChanged(true); }} disabled={!canEdit} placeholder="Ex: iFood, Rappi..." style={{ width: 160, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'right', outline: 'none', opacity: canEdit ? 1 : 0.6 }} />
                </div>
                {/* Editable: Base Elegivel (multi-select) */}
                <div style={{ fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: 6 }}>Base Elegivel</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {BASE_ELEGIVEL_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => canEdit && toggleBaseElegivel(opt)} disabled={!canEdit} style={{ padding: '4px 12px', borderRadius: 20, border: editBaseElegivel.includes(opt) ? '2px solid #EA1D2C' : '1px solid #e2e8f0', background: editBaseElegivel.includes(opt) ? '#fef2f2' : '#fff', color: editBaseElegivel.includes(opt) ? '#EA1D2C' : '#64748b', fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }}>
                        {editBaseElegivel.includes(opt) && <Check size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Editable: Culinaria */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0" }}>
                  <span style={{ color: "#64748b" }}>Culinaria</span>
                  <input type="text" value={editCulinaria} onChange={e => { setEditCulinaria(e.target.value); setInfoChanged(true); }} disabled={!canEdit} placeholder="Ex: Japonesa, Pizza..." style={{ width: 160, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, textAlign: "right", outline: "none", opacity: canEdit ? 1 : 0.6 }} />
                </div>
                {/* Editable: FUP */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Proximo Passo / FUP</div>
                  <textarea value={editFUP} onChange={e => { setEditFUP(e.target.value); setInfoChanged(true); }} disabled={!canEdit} placeholder="Descreva o proximo passo, data do FUP..." rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', color: '#475569', boxSizing: 'border-box', opacity: canEdit ? 1 : 0.6 }} />
                </div>
                {/* SAVE BUTTON */}
                {infoChanged && canEdit && (
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
                          canEdit ? <button onClick={() => enableProduct(selectedBrand.id, key)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: `1px solid ${prod.color}`, background: 'transparent', color: prod.color, fontWeight: 600, cursor: 'pointer' }}>Ativar</button> : <span style={{ fontSize: 12, color: '#94a3b8' }}>Inativo</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, background: prod.color + '20', color: prod.color, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{shortStage(pipeline.stage)}</span>
                            {canEdit && <button onClick={() => disableProduct(selectedBrand.id, key)} title="Desativar produto" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', opacity: 0.5 }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                              <X size={14} color="#ef4444" />
                            </button>}
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <select value={pipeline.stage} onChange={e => changeStage(selectedBrand.id, key, e.target.value)} disabled={!canEdit} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', opacity: canEdit ? 1 : 0.6 }}>
                            {prod.stages.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Responsavel:</span>
                            <select value={currentResp} onChange={e => { setPendingResp({ ...pendingResp, [key]: e.target.value }); setPipelinesChanged(true); }} disabled={!canEdit} style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff', opacity: canEdit ? 1 : 0.6 }}>
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
                {pipelinesChanged && canEdit && (
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
                      <span style={{ color: '#64748b', fontWeight: 600 }}> → {shortStage(h.to_stage)}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 4 }}>({PRODUCTS[h.product]?.name || h.product})</span>
                    </div>
                    <div style={{ flex: '0 0 100px', color: '#94a3b8', textAlign: 'right' }}>{h.changed_by_name || '—'}</div>
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
