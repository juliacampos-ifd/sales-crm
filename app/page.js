'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PRODUCTS, CLASSIFICACAO_COLORS, MONTH_NAMES, DUPLAS, getMonthBusinessDays, getMonthBusinessDaysMTD } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Target, Search, Eye, ArrowLeft, Filter, Calendar, History, LayoutGrid, LogOut, Shield, UserCheck, AlertCircle, Check, Building2, Upload, Plus, Save, Sparkles, Award, FlaskConical, X, Package } from 'lucide-react';

// Helper que adiciona Authorization header em todas as chamadas de API
async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
    },
  });
}
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
  const [filterTimeCarteira, setFilterTimeCarteira] = useState([]);
  const [filterPDV, setFilterPDV] = useState([]);
  const [filterStage, setFilterStage] = useState([]);
  const [filterCulinaria, setFilterCulinaria] = useState([]);
  const [filterTag, setFilterTag] = useState(false);
  const [filterTopDown, setFilterTopDown] = useState('');
  const [filterBaseElegivel, setFilterBaseElegivel] = useState([]);
  const [filterHaas, setFilterHaas] = useState([]);
  const [filterExecDelivery, setFilterExecDelivery] = useState([]);
  const [filterCFEstrategia, setFilterCFEstrategia] = useState([]);
  const [filterCFSolucao, setFilterCFSolucao] = useState([]);
  const [filterCFProvider, setFilterCFProvider] = useState([]);
  const [filterCFCidade, setFilterCFCidade] = useState([]);
  const [filterCFTrade, setFilterCFTrade] = useState([]);
  const [filterCFPrioridade, setFilterCFPrioridade] = useState([]);
  const [filterCFPrioMes, setFilterCFPrioMes] = useState([]);
  const [cfDetails, setCfDetails] = useState({});
  const [cfQualifModal, setCfQualifModal] = useState(null);
  const [cfQualifData, setCfQualifData] = useState({
    possui_fidelizacao: false,
    mecanica_fidelizacao: '',
    experiencia_salao: [],
    objetivos: [],
    mecanicas_interesse: [],
    mecanica_outro_detalhe: '',
    solicitou_dados: false,
    dados_solicitados: '',
    uso_dados: ''
  });
  const [cfChanged, setCfChanged] = useState(false);
  const [evDetails, setEvDetails] = useState({});
  const [evChanged, setEvChanged] = useState(false);
  const [np3sDetails, setNp3sDetails] = useState({});
  const [np3sChanged, setNp3sChanged] = useState(false);
  // Novos Produtos 3S filters
  const [filterNP3SAddon, setFilterNP3SAddon] = useState([]);
  const [filterNP3SMensalidade, setFilterNP3SMensalidade] = useState([]);
  // Emilia Vision filters
  const [filterEVSinergia, setFilterEVSinergia] = useState([]);
  const [filterEVBaseAndres, setFilterEVBaseAndres] = useState('');
  const [filterEVTipo, setFilterEVTipo] = useState([]);
  // Forecast
  const [forecastMetas, setForecastMetas] = useState([]);
  const [forecastEntries, setForecastEntries] = useState([]);
  const [forecastSection, setForecastSection] = useState('3s_pm');
  const [newForecastMarca, setNewForecastMarca] = useState('');
  const [newForecastLojas, setNewForecastLojas] = useState('');
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
  // ── SCORECARD ──
  const [scData, setScData] = useState(null);
  const [scMonth, setScMonth] = useState(new Date().getMonth() + 1);
  const [scYear, setScYear] = useState(new Date().getFullYear());
  const [scDupla, setScDupla] = useState('total');
  const [scClassFilter, setScClassFilter] = useState('pm');
  const [scModal, setScModal] = useState(null);
  const [scModalBrands, setScModalBrands] = useState([]);
  const [scModalLoading, setScModalLoading] = useState(false);
  const [scStagesOpen, setScStagesOpen] = useState(false);
  // ── DASHBOARD WoW ──
  const [wowData, setWowData] = useState(null);
  const [wowDates, setWowDates] = useState(null);
  // ── ATIVIDADE DO TIME (admin only) ──
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  // ── DELIVERY EDIT ──
  const [editCoordDelivery, setEditCoordDelivery] = useState('');
  const [editExecDelivery, setEditExecDelivery] = useState('');
  const [editTimeCarteira, setEditTimeCarteira] = useState('');
  // ── MOTIVO PERDA/STAND BY MODAL ──
  const [lossModal, setLossModal] = useState(null);
  const [lossReason, setLossReason] = useState('');
  // ── ADMIN: Renomear / Merge / Excluir ──
  const [renameModal, setRenameModal] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [mergeModal, setMergeModal] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeTarget, setMergeTarget] = useState(null);
  const [mergeName, setMergeName] = useState('');
  // ── ÚLTIMAS ATUALIZAÇÕES ──
  const [updatesData, setUpdatesData] = useState([]);
  const [updatesProduct, setUpdatesProduct] = useState('todos');
  const [updatesLoading, setUpdatesLoading] = useState(false);
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
    setEditFUP(brand.pipelines?.[activeProduct]?.proximo_passo || '');
    setCfDetails(brand.comer_fora_details || {});
    setCfChanged(false);
    setEvDetails(brand.emilia_vision_details || {});
    setEvChanged(false);
    setNp3sDetails(brand.novos_produtos_3s_details || {});
    setNp3sChanged(false);
    setEditCulinaria(brand.culinaria || '');
    setEditCoordDelivery(brand.coordenador_delivery || '');
    setEditExecDelivery(brand.executivo_delivery || '');
    setEditTimeCarteira(brand.time_carteira || '');
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
    if (data) {
      setProfile(data);
      // Auto-select product for restricted team users
      if (data.team === 'emilia_vision') setActiveProduct('emilia_vision');
      if (data.team === 'comer_fora') setActiveProduct('comer_fora');
      if (data.role === 'admin') {
        try {
          const res = await apiFetch('/api/activity?_t=' + Date.now(), { cache: 'no-store' });
          const d = await res.json();
          setActivityData(d);
        } catch (err) { console.error('Activity fetch error:', err); }
      }
    }
  };
  // ── Login ──
  const handleLogin = async () => {
    setLoginError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    if (error) { setLoginError('Email ou senha incorretos'); return; }
    // Log login
    if (data?.user) {
      supabase.from('login_logs').insert({ user_id: data.user.id, email: data.user.email, name: data.user.email }).then(() => {});
    }
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
    const res = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
    const data = await res.json();
    if (data.brands) setBrands(data.brands);
  }, []);
  useEffect(() => {
    if (user) {
      loadBrands();
      apiFetch('/api/forecast', { cache: 'no-store' }).then(r => r.json()).then(d => {
        if (d.metas) setForecastMetas(d.metas);
        if (d.entries) setForecastEntries(d.entries);
      }).catch(console.error);
      apiFetch('/api/wow?_t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => {
        if (d.wow) setWowData(d.wow);
        if (d.refDate && d.prevDate) setWowDates({ ref: d.refDate, prev: d.prevDate });
      }).catch(console.error);
    }
  }, [user, loadBrands]);
  // Viewer = read-only (vê tudo, não edita nada)
  const canEdit = profile?.role !== 'viewer';
  // Restricted = viewer locked to a specific product
  const isRestricted = profile?.team === 'emilia_vision' || profile?.team === 'comer_fora';
  // ── Role-based filtering ──
  const filtered = useMemo(() => {
    let d = brands;
    if (profile?.team === 'emilia_vision') {
      d = d.filter(b => b.pipelines?.emilia_vision);
    } else if (profile?.team === 'comer_fora') {
      d = d.filter(b => b.pipelines?.comer_fora);
    } else if (profile?.role === 'executivo') {
      if (profile.team === 'saipos') {
        // Marcos/Lucas: veem todas as marcas que têm pipeline saipos ou totem
        d = d.filter(b => b.pipelines?.saipos || b.pipelines?.totem || b.pipelines?.comer_fora);
      } else {
        d = d.filter(b => b.responsavel_bdr === profile.name || b.responsavel_closer === profile.name || Object.values(b.pipelines || {}).some(p => p.responsavel && p.responsavel.includes(profile.name)));
      }
    }
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(b => (b.marca||'').toLowerCase().includes(q) || (b.pipelines?.[activeProduct]?.responsavel||'').toLowerCase().includes(q));
    }
    if (filterClass.length > 0) d = d.filter(b => {
      if (filterClass.includes('(Vazio)') && !b.classificacao) return true;
      return filterClass.filter(v => v !== '(Vazio)').includes(b.classificacao);
    });
    if (filterEstado.length > 0) d = d.filter(b => {
      if (filterEstado.includes('(Vazio)') && !b.estado) return true;
      return filterEstado.filter(v => v !== '(Vazio)').includes(b.estado);
    });
    if (filterBDR.length > 0) d = d.filter(b => {
      const resp = b.pipelines?.[activeProduct]?.responsavel || '';
      if (filterBDR.includes('(Vazio)') && !resp) return true;
      return filterBDR.filter(v => v !== '(Vazio)').some(f => resp.includes(f));
    });
    if (filterTimeCarteira.length > 0) d = d.filter(b => {
      if (filterTimeCarteira.includes('(Vazio)') && !b.time_carteira) return true;
      return filterTimeCarteira.filter(v => v !== '(Vazio)').includes(b.time_carteira);
    });
    if (filterPDV.length > 0) d = d.filter(b => {
      if (filterPDV.includes('(Vazio)') && !b.pdv_atual) return true;
      return filterPDV.filter(v => v !== '(Vazio)').includes(b.pdv_atual);
    });
    if (filterStage.length > 0) d = d.filter(b => {
      if (filterStage.includes('(Vazio)') && !b.pipelines?.[activeProduct]?.stage) return true;
      return filterStage.filter(v => v !== '(Vazio)').includes(b.pipelines?.[activeProduct]?.stage);
    });
    if (filterCulinaria.length > 0) d = d.filter(b => {
      if (filterCulinaria.includes('(Vazio)') && !b.culinaria) return true;
      return filterCulinaria.filter(v => v !== '(Vazio)').includes(b.culinaria);
    });
    if (filterTag) d = d.filter(b => b.analise_teste_pdv === true);
    if (filterTopDown) d = d.filter(b => b.top_down === filterTopDown);
    if (filterBaseElegivel.length > 0) d = d.filter(b => {
      if (filterBaseElegivel.includes('(Vazio)') && !b.base_elegivel) return true;
      const be = (b.base_elegivel || "").split(",").map(s => s.trim());
      return filterBaseElegivel.filter(v => v !== '(Vazio)').some(f => be.includes(f));
    });
    if (filterHaas.length > 0) d = d.filter(b => {
      if (filterHaas.includes('(Vazio)') && !b.produto_totem) return true;
      const pt = (b.produto_totem || "").split(",").map(s => s.trim());
      return filterHaas.filter(v => v !== '(Vazio)').some(f => pt.includes(f));
    });
    if (filterExecDelivery.length > 0) d = d.filter(b => {
      if (filterExecDelivery.includes('(Vazio)') && !b.executivo_delivery) return true;
      return filterExecDelivery.filter(v => v !== '(Vazio)').includes(b.executivo_delivery);
    });
    if (filterEVSinergia.length > 0) d = d.filter(b => filterEVSinergia.includes(b.emilia_vision_details?.sinergia));
    if (filterEVBaseAndres === 'sim') d = d.filter(b => b.emilia_vision_details?.base_andres === true);
    if (filterEVBaseAndres === 'nao') d = d.filter(b => !b.emilia_vision_details?.base_andres);
    if (filterEVTipo.length > 0) d = d.filter(b => filterEVTipo.includes(b.emilia_vision_details?.tipo || 'Hunting'));
    // Comer Fora filters
    if (filterCFEstrategia.length > 0) d = d.filter(b => filterCFEstrategia.includes(b.comer_fora_details?.estrategia));
    if (filterCFSolucao.length > 0) d = d.filter(b => filterCFSolucao.includes(b.comer_fora_details?.solucao));
    if (filterCFProvider.length > 0) d = d.filter(b => filterCFProvider.includes(b.comer_fora_details?.provider));
    if (filterCFCidade.length > 0) d = d.filter(b => { const c = b.comer_fora_details?.cidade || ''; return filterCFCidade.some(f => c.includes(f)); });
    if (filterCFTrade.length > 0) d = d.filter(b => { const t = b.comer_fora_details?.trade ? 'Sim' : 'Não'; return filterCFTrade.includes(t); });
    if (filterCFPrioridade.length > 0) d = d.filter(b => filterCFPrioridade.includes(String(b.comer_fora_details?.prioridade)));
    if (filterCFPrioMes.length > 0) d = d.filter(b => filterCFPrioMes.includes(String(b.comer_fora_details?.prioridade_mes)));
    // Novos Produtos 3S filters
    if (filterNP3SAddon.length > 0) d = d.filter(b => { const det = b.novos_produtos_3s_details || {}; return filterNP3SAddon.some(a => a === '3S Eats' ? det.eats : a === '3S Go' ? det.go : a === 'Pagamento na Mesa' ? det.pagamento_mesa : false); });
    if (filterNP3SMensalidade.length > 0) d = d.filter(b => { const det = b.novos_produtos_3s_details || {}; return filterNP3SMensalidade.some(a => a === '3S Eats' ? det.eats_incluso : a === '3S Go' ? det.go_incluso : a === 'Pagamento na Mesa' ? det.pagamento_mesa_incluso : false); });
    return d;
  }, [brands, profile, search, filterClass, filterEstado, filterBDR, filterTimeCarteira, filterPDV, filterBaseElegivel, filterHaas, filterStage, filterCulinaria, filterTag, filterTopDown, activeProduct, filterEVSinergia, filterEVBaseAndres, filterEVTipo, filterCFEstrategia, filterCFSolucao, filterCFProvider, filterCFCidade, filterCFTrade, filterCFPrioridade, filterCFPrioMes, filterNP3SAddon, filterNP3SMensalidade, filterExecDelivery]);
  // ── Loss/StandBy reasons ──
  const LOSS_REASONS = ['Sistema proprio','Sem interesse em mudar de PDV','Desistencia na mudanca de PDV','Desenvolvimento Solucao','Em negociacao com outro PDV','Fechou com concorrente ha pouco tempo','Proposta declinada','Sem perfil LA','Sem perfil 3S - Perfil Saipos','Atrito Negociacao','Trava por projetos internos da marca','Interesse apenas em Comer Fora','Falencia','Outros'];
  // ── Change stage (respects testMode) ──
  const changeStage = async (brandId, productKey, newStage) => {
    // Detectar transição para "Reuniao Realizada" no Comer Fora (sem acento, como está no banco)
    const normalizeStage = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (productKey === 'comer_fora' && normalizeStage(newStage) === 'reuniao realizada') {
      const brand = brands.find(b => b.id === brandId);
      const currentStage = brand?.pipelines?.comer_fora?.stage || '';
      const normCurrent = normalizeStage(currentStage);
      
      // Se vem de "Reuniao Agendada" ou "Buscando Reuniao"
      if (normCurrent.includes('reuniao agendada') || normCurrent.includes('buscando')) {
        setCfQualifModal({ brandId, productKey, newStage });
        const existing = brand?.comer_fora_details || {};
        setCfQualifData({
          possui_fidelizacao: existing.possui_fidelizacao || false,
          mecanica_fidelizacao: existing.mecanica_fidelizacao || '',
          experiencia_salao: existing.experiencia_salao || [],
          objetivos: existing.objetivos || [],
          mecanicas_interesse: existing.mecanicas_interesse || [],
          mecanica_outro_detalhe: existing.mecanica_outro_detalhe || '',
          solicitou_dados: existing.solicitou_dados || false,
          dados_solicitados: existing.dados_solicitados || '',
          uso_dados: existing.uso_dados || ''
        });
        return;
      }
    }
    
    const isLossOrStandby = newStage.startsWith('10.') || newStage.startsWith('11.');
    if (isLossOrStandby) {
      setLossModal({ brandId, productKey, newStage });
      setLossReason('');
      return;
    }
    await executeStageChange(brandId, productKey, newStage, null);
  };
  const confirmLossReason = async () => {
    if (!lossReason) return;
    const { brandId, productKey, newStage } = lossModal;
    setLossModal(null);
    await executeStageChange(brandId, productKey, newStage, lossReason);
  };
  const confirmCfQualif = async () => {
    if (!cfQualifModal) return;
    const { brandId, productKey, newStage } = cfQualifModal;
    setSaving(true);
    try {
      await apiFetch('/api/comer-fora', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, ...cfQualifData })
      });
    } catch (err) {
      console.error('Error saving CF qualif:', err);
    }
    setCfQualifModal(null);
    await executeStageChange(brandId, productKey, newStage, null);
    setSaving(false);
  };
  const executeStageChange = async (brandId, productKey, newStage, reason) => {
    setSaving(true);
    setSelectedBrand(prev => prev && prev.id === brandId ? { ...prev, pipelines: { ...prev.pipelines, [productKey]: { ...prev.pipelines?.[productKey], stage: newStage } } } : prev);
    setBrands(prev => prev.map(b => b.id === brandId ? { ...b, pipelines: { ...b.pipelines, [productKey]: { ...b.pipelines?.[productKey], stage: newStage } } } : b));
    if (!testMode) {
      try {
        await apiFetch('/api/pipelines', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_id: brandId, product: productKey, new_stage: newStage, user_id: user?.id, user_name: profile?.name }),
        });
        if (reason) {
          await apiFetch('/api/brands', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: brandId, motivo_perda_standby: reason }),
          });
        }
        // Auto-ativar Novos Produtos 3S quando contrato assinado em 3S
        if (productKey === '3s' && newStage === '9. Contrato assinado') {
          const brand = brands.find(b => b.id === brandId);
          if (brand && !brand.pipelines?.novos_produtos_3s) {
            await apiFetch('/api/pipelines', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ brand_id: brandId, product: 'novos_produtos_3s', user_id: user?.id, user_name: profile?.name }),
            });
          }
        }
        const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
        const freshData = await freshRes.json();
        if (freshData.brands) {
          setBrands(freshData.brands);
          setSelectedBrand(prev => prev ? freshData.brands.find(b => b.id === prev.id) || prev : prev);
        }
      } catch (err) { console.error('Error changing stage:', err); }
    }
    await loadScorecard();
    setSaving(false);
  };
  // ── Save pending responsavel changes (batch) ──
  const savePendingResponsaveis = async (brandId) => {
    if (testMode) return;
    for (const [prodKey, newResp] of Object.entries(pendingResp)) {
      await apiFetch('/api/pipelines', {
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
      await apiFetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, product: productKey, user_id: user?.id, user_name: profile?.name }),
      });
      const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
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
      await apiFetch('/api/pipelines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, product: productKey, new_stage: '14. Desativado', user_id: user?.id, user_name: profile?.name }),
      });
      const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
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
    const res = await apiFetch(url);
    const data = await res.json();
    if (data.history) setBrandHistory(data.history);
  };
  const deleteHistory = async (histId) => {
    if (!confirm('Excluir esta movimentacao do historico?')) return;
    try {
      await apiFetch('/api/history?id=' + histId, { method: 'DELETE' });
      setBrandHistory(prev => prev.filter(h => h.id !== histId));
      await loadScorecard();
    } catch (err) { console.error('Error deleting history:', err); }
  };
  // ── Últimas Atualizações ──
  const loadUpdates = async (productFilter) => {
    setUpdatesLoading(true);
    try {
      const p = productFilter || updatesProduct;
      const res = await apiFetch(`/api/updates?product=${p}&limit=100`);
      const data = await res.json();
      if (data.updates) setUpdatesData(data.updates);
    } catch (err) { console.error('Error loading updates:', err); }
    setUpdatesLoading(false);
  };
  // ── Save info changes (button click) — respects testMode ──
  // ── Admin: Rename brand ──
  const renameBrand = async () => {
    if (!renameName.trim() || !selectedBrand) return;
    setSaving(true);
    await apiFetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedBrand.id, marca: renameName.trim() }) });
    setRenameModal(false);
    const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
    const freshData = await freshRes.json();
    if (freshData.brands) { setBrands(freshData.brands); const u = freshData.brands.find(b => b.id === selectedBrand.id); if (u) setSelectedBrand(u); }
    setSaving(false);
  };
  // ── Admin: Delete brand ──
  const deleteBrand = async () => {
    if (!selectedBrand) return;
    if (!confirm(`Tem certeza que deseja excluir "${selectedBrand.marca}"? Esta acao nao pode ser desfeita.`)) return;
    setSaving(true);
    await apiFetch('/api/brands', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedBrand.id }) });
    setSelectedBrand(null);
    const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
    const freshData = await freshRes.json();
    if (freshData.brands) setBrands(freshData.brands);
    setSaving(false);
  };
  // ── Admin: Merge brands ──
  const mergeBrands = async () => {
    if (!mergeTarget || !selectedBrand) return;
    if (!confirm(`Merge: transferir pipelines e historico de "${selectedBrand.marca}" para "${mergeTarget.marca}"${mergeName ? ` e renomear para "${mergeName}"` : ''}?`)) return;
    setSaving(true);
    await apiFetch('/api/brands/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: selectedBrand.id, targetId: mergeTarget.id, newName: mergeName.trim() || null }) });
    setMergeModal(false); setMergeTarget(null); setMergeName(''); setSelectedBrand(null);
    const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
    const freshData = await freshRes.json();
    if (freshData.brands) setBrands(freshData.brands);
    setSaving(false);
  };
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
      if (editFUP !== (selectedBrand.pipelines?.[activeProduct]?.proximo_passo || '')) updates.proximo_passo = editFUP;
      if (editCulinaria !== (selectedBrand.culinaria || '' )) updates.culinaria = editCulinaria;
      if (editCoordDelivery !== (selectedBrand.coordenador_delivery || '')) updates.coordenador_delivery = editCoordDelivery;
      if (editExecDelivery !== (selectedBrand.executivo_delivery || '')) updates.executivo_delivery = editExecDelivery;
      if (editTimeCarteira !== (selectedBrand.time_carteira || '')) updates.time_carteira = editTimeCarteira;
      if (Object.keys(updates).length > 0) {
        await apiFetch('/api/brands', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedBrand.id, ...updates, product: activeProduct, user_id: user?.id, user_name: profile?.name }),
        });
      }
      const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
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
          setEditFUP(updated.pipelines?.[activeProduct]?.proximo_passo || '');
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
      const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
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
      let allHistory = [];
      let histOffset = 0;
      const HIST_PAGE = 1000;
      while (true) {
        const histRes = await apiFetch(`/api/history?limit=${HIST_PAGE}&offset=${histOffset}`, { cache: 'no-store' });
        const histData = await histRes.json();
        const page = histData.history || [];
        allHistory = allHistory.concat(page);
        if (page.length < HIST_PAGE) break;
        histOffset += HIST_PAGE;
      }
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
    const s = new Set(brands.flatMap(b => (b.pipelines?.[activeProduct]?.responsavel || '').split('/').map(n => n.trim())).filter(Boolean));
    return Array.from(s).sort();
  }, [brands, activeProduct]);
  const pdvs = useMemo(() => {
    const s = new Set(brands.map(b => b.pdv_atual).filter(Boolean));
    return Array.from(s).sort();
  }, [brands]);
  const metrics = useMemo(() => {
    const f = filtered;
    const won3s = f.filter(b => b.pipelines?.['3s']?.stage === '9. Contrato assinado').length;
    const lostBrands = f.filter(b => b.pipelines?.['3s']?.stage === '10. Perdido');
    const standbyBrands = f.filter(b => b.pipelines?.['3s']?.stage === '11. Stand by');
    const lost3s = lostBrands.length;
    const standby3s = standbyBrands.length;
    const lostByReason = {};
    const standbyByReason = {};
    lostBrands.forEach(b => { const r = b.motivo_perda_standby || 'Sem motivo'; lostByReason[r] = (lostByReason[r] || { count: 0, lojas: 0 }); lostByReason[r].count++; lostByReason[r].lojas += (b.qtd_lojas_fisicas || 0); });
    standbyBrands.forEach(b => { const r = b.motivo_perda_standby || 'Sem motivo'; standbyByReason[r] = (standbyByReason[r] || { count: 0, lojas: 0 }); standbyByReason[r].count++; standbyByReason[r].lojas += (b.qtd_lojas_fisicas || 0); });
    const lostLojas = lostBrands.reduce((s, b) => s + (b.qtd_lojas_fisicas || 0), 0);
    const standbyLojas = standbyBrands.reduce((s, b) => s + (b.qtd_lojas_fisicas || 0), 0);
    const byClass = {}; f.forEach(b => { if (b.classificacao) byClass[b.classificacao] = (byClass[b.classificacao] || 0) + 1; });
    const byEstado = {}; f.forEach(b => { if (b.estado && b.estado.length === 2) byEstado[b.estado] = (byEstado[b.estado] || 0) + 1; });
    const activeByProduct = {};
    Object.keys(PRODUCTS).forEach(pk => {
      activeByProduct[pk] = f.filter(b => { const s = b.pipelines?.[pk]?.stage; return s && !['10. Perdido','11. Stand by','8. Perdido','9. Stand by','14. Desativado'].includes(s); }).length;
    });
    return { total: f.length, won3s, lost3s, standby3s, lostLojas, standbyLojas, lostByReason, standbyByReason, byClass, byEstado, activeByProduct };
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
  // ── Forecast ──
  const FORECAST_SECTIONS = [
    { key: '3s_pm', label: '3S Checkout P/M', subtitle: 'Contrato assinado', color: '#EA1D2C' },
    { key: '3s_g', label: '3S Checkout G', subtitle: 'Contrato assinado', color: '#b91c1c' },
    { key: 'saipos', label: 'Saipos', subtitle: 'Lojas enviando forms', color: '#2563eb' },
    { key: 'totem', label: 'Totem', subtitle: 'Novos totens', color: '#7c3aed' },
    { key: 'comer_fora_pm', label: 'Comer Fora P/M', subtitle: 'Aceites P/M', color: '#9C050B' },
    { key: 'comer_fora_g', label: 'Comer Fora G', subtitle: 'Aceites G', color: '#7f1d1d' },
  ];
  const FISCAL_MONTHS = [
    { year: 2026, month: 4 }, { year: 2026, month: 5 }, { year: 2026, month: 6 },
    { year: 2026, month: 7 }, { year: 2026, month: 8 }, { year: 2026, month: 9 },
    { year: 2026, month: 10 }, { year: 2026, month: 11 }, { year: 2026, month: 12 },
    { year: 2027, month: 1 }, { year: 2027, month: 2 }, { year: 2027, month: 3 },
  ];
  const MONTH_LABELS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const canEditForecast = profile?.role === 'gestor' || profile?.role === 'admin' || profile?.role === 'executivo';

  const loadForecast = async () => {
    try {
      const res = await apiFetch('/api/forecast', { cache: 'no-store' });
      const data = await res.json();
      if (data.metas) setForecastMetas(data.metas);
      if (data.entries) setForecastEntries(data.entries);
    } catch (err) { console.error('Forecast fetch error:', err); }
  };

  const addForecastEntry = async (section, year, month) => {
    if (!newForecastMarca.trim()) return;
    try {
      const res = await apiFetch('/api/forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_entry', section, year, month, marca: newForecastMarca.trim(), lojas: Number(newForecastLojas) || 0, user_id: user?.id, user_name: profile?.name }),
      });
      const entry = await res.json();
      if (entry.id) { setForecastEntries(prev => [...prev, entry]); setNewForecastMarca(''); setNewForecastLojas(''); }
    } catch (err) { console.error(err); }
  };

  const toggleForecastCheck = async (entryId, checked) => {
    try {
      await apiFetch('/api/forecast', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entryId, checked: !checked }) });
      setForecastEntries(prev => prev.map(e => e.id === entryId ? { ...e, checked: !checked } : e));
    } catch (err) { console.error(err); }
  };

  const deleteForecastEntry = async (entryId) => {
    try {
      await apiFetch('/api/forecast?id=' + entryId, { method: 'DELETE' });
      setForecastEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (err) { console.error(err); }
  };

  const updateForecastMeta = async (section, year, month, val) => {
    try {
      await apiFetch('/api/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_meta', section, year, month, meta_lojas: Number(val) || 0 }) });
      setForecastMetas(prev => { const idx = prev.findIndex(m => m.section === section && m.year === year && m.month === month); if (idx >= 0) { const c = [...prev]; c[idx] = { ...c[idx], meta_lojas: Number(val) || 0 }; return c; } return [...prev, { section, year, month, meta_lojas: Number(val) || 0 }]; });
    } catch (err) { console.error(err); }
  };

  const updateForecastLojasLocal = (entryId, val) => {
    setForecastEntries(prev => prev.map(e => e.id === entryId ? { ...e, lojas: Number(val) || 0, _dirty: true } : e));
  };
  const saveForecastChanges = async () => {
    setSaving(true);
    try {
      const dirty = forecastEntries.filter(e => e._dirty);
      for (const e of dirty) {
        await apiFetch('/api/forecast', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, lojas: e.lojas }) });
      }
      setForecastEntries(prev => prev.map(e => ({ ...e, _dirty: false })));
      // Reload scorecard so Forecast Marcas/Lojas lines update
      try { const r2 = await apiFetch('/api/scorecard?_t=' + Date.now() + '&class=' + scClassFilter, { cache: 'no-store' }); const d2 = await r2.json(); setScData(d2); } catch (_) {}
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const loadScorecard = async (classOverride) => {
    try {
      const cf = classOverride || scClassFilter;
      const res = await apiFetch('/api/scorecard?_t=' + Date.now() + '&class=' + cf, { cache: 'no-store' });
      const d = await res.json();
      setScData(d);
    } catch (err) { console.error('Scorecard fetch error:', err); }
  };
  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await apiFetch('/api/activity?_t=' + Date.now(), { cache: 'no-store' });
      const d = await res.json();
      setActivityData(d);
    } catch (err) { console.error('Activity fetch error:', err); }
    setActivityLoading(false);
  };
  const NavBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => { setView(id); if (id === 'scorecard') { setScData(null); loadScorecard(); } if (id === 'updates') { loadUpdates(); } }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: view === id ? '#EA1D2C' : 'transparent', color: view === id ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
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
                <button key={o} onClick={() => toggle(o)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '6px 10px', border: 'none',
                  background: selected.includes(o) ? '#fef2f2' : 'transparent',
                  borderRadius: 6, fontSize: 12,
                  color: o === '(Vazio)' ? '#94a3b8' : '#1e293b',
                  cursor: 'pointer', textAlign: 'left',
                  fontStyle: o === '(Vazio)' ? 'italic' : 'normal',
                  borderTop: o === '(Vazio)' ? '1px solid #f1f5f9' : 'none',
                  marginTop: o === '(Vazio)' ? 4 : 0,
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3,
                    border: selected.includes(o) ? '2px solid #EA1D2C' : (o === '(Vazio)' ? '1px dashed #cbd5e1' : '1px solid #cbd5e1'),
                    background: selected.includes(o) ? '#EA1D2C' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
          {canEdit && !isRestricted && <a href="/input" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
            <Plus size={16} /> Nova Marca
          </a>}
          {!isRestricted && <a href="/rv" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
            <Award size={16} /> RV
          </a>}
          {!isRestricted && <a href="/implantacao" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}><Package size={16} /> Implantação</a>}
          {(!isRestricted || profile?.team === 'comer_fora') && <NavBtn id="forecast" icon={Calendar} label="Forecast" />}
          <NavBtn id="dashboard" icon={TrendingUp} label="Dashboard" />
          {!isRestricted && <NavBtn id="scorecard" icon={Target} label="Scorecard" />}
          <NavBtn id="updates" icon={History} label="Atualizações" />
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
      {/* ATIVIDADE DO TIME (admin only) */}
      {profile?.role === 'admin' && view === 'pipeline' && activityData && (
        <div style={{ margin: '16px 28px 0', background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden' }}>
          <div onClick={() => setActivityOpen(!activityOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#dbeafe', borderRadius: 8, padding: 6 }}><Users size={16} color="#3b82f6" /></div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Atividade do Time</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>(ultimos 30 dias)</span>
              <span style={{ fontSize: 12, color: '#94a3b8', transition: 'transform .2s', display: 'inline-block', transform: activityOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </div>
            <button onClick={e => { e.stopPropagation(); loadActivity(); }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}>
              Atualizar
            </button>
          </div>
          {activityOpen && <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: '#64748b', fontWeight: 600 }}>Pessoa</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>Logins (7d)</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>Logins (30d)</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>Ultimo Login</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>Movimentacoes (7d)</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>Movimentacoes (30d)</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>Ultima Movimentacao</th>
                </tr>
              </thead>
              <tbody>
                {(activityData.users || []).filter(u => u.role !== 'admin').map(u => {
                  const noLogin = u.logins_total === 0;
                  const noMov = u.movements_total === 0;
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{u.role} • {u.team}</div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px', color: u.logins_week > 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{u.logins_week}</td>
                      <td style={{ textAlign: 'center', padding: '10px 12px', color: '#1e293b' }}>{u.logins_total}</td>
                      <td style={{ textAlign: 'center', padding: '10px 12px', color: noLogin ? '#ef4444' : '#64748b', fontWeight: noLogin ? 600 : 400 }}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString('pt-BR') + ' ' + new Date(u.last_login).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px', color: u.movements_week > 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{u.movements_week}</td>
                      <td style={{ textAlign: 'center', padding: '10px 12px', color: '#1e293b' }}>{u.movements_total}</td>
                      <td style={{ textAlign: 'center', padding: '10px 12px', color: noMov ? '#ef4444' : '#64748b', fontWeight: noMov ? 600 : 400 }}>
                        {u.last_movement ? new Date(u.last_movement).toLocaleDateString('pt-BR') + ' ' + new Date(u.last_movement).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
        </div>
      )}
      {/* PRODUCT TABS */}
      {(view === 'pipeline' || view === 'contacts') && (
        <div style={{ padding: '14px 28px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.keys(PRODUCTS).filter(pk => {
            if (profile?.team === 'emilia_vision') return pk === 'emilia_vision';
            if (profile?.team === 'comer_fora') return pk === 'comer_fora';
            return true;
          }).map(pk => <ProductTab key={pk} pkey={pk} />)}
        </div>
      )}
      {/* FILTERS */}
      {(view === 'pipeline' || view === 'contacts') && (
        <div style={{ padding: '12px 28px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 14px', flex: 1, maxWidth: 320 }}>
            <Search size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar marca..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, color: '#1e293b' }} />
          </div>
          <MultiFilter label="Classificacao" selected={filterClass} onChange={setFilterClass} options={['P','M','G','(Vazio)']} filterId="class" />
          <MultiFilter label="Estado" selected={filterEstado} onChange={setFilterEstado} options={[...estados.filter(e => e !== 'Todos'), '(Vazio)']} filterId="estado" />
          {profile?.role !== 'executivo' && <MultiFilter label="Responsavel" selected={filterBDR} onChange={setFilterBDR} options={[...bdrs, '(Vazio)']} filterId="bdr" />}
          <MultiFilter label="Time Carteira" selected={filterTimeCarteira} onChange={setFilterTimeCarteira} options={['KA', 'CE', 'Não encarteirado','(Vazio)']} filterId="timeCarteira" />
          {pdvs.length > 0 && <MultiFilter label="PDV" selected={filterPDV} onChange={setFilterPDV} options={pdvs} filterId="pdv" />}
          <MultiFilter label="Etapa" selected={filterStage} onChange={setFilterStage} options={[...(PRODUCTS[activeProduct]?.stages || []), '(Vazio)']} filterId="stage" />
          {brands.some(b => b.culinaria) && <MultiFilter label="Culinaria" selected={filterCulinaria} onChange={setFilterCulinaria} options={[...new Set(brands.map(b => b.culinaria).filter(Boolean))].sort()} filterId="culinaria" />}
          <MultiFilter label="Exec. Delivery" selected={filterExecDelivery} onChange={setFilterExecDelivery} options={[...new Set(brands.map(b => b.executivo_delivery).filter(Boolean))].sort()} filterId="exec_delivery" />
          <button onClick={() => setFilterTag(p => !p)} style={{ padding: '6px 14px', borderRadius: 8, border: filterTag ? '2px solid #7c3aed' : '1px solid #e2e8f0', background: filterTag ? '#f3e8ff' : '#fff', color: filterTag ? '#7c3aed' : '#64748b', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>AT</button>
          {activeProduct === 'saipos' && (
            <select value={filterTopDown} onChange={e => setFilterTopDown(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: filterTopDown ? '2px solid #b45309' : '1px solid #e2e8f0', background: filterTopDown ? '#fef3c7' : '#fff', color: filterTopDown ? '#b45309' : '#64748b', fontWeight: 600, fontSize: 12, cursor: 'pointer', outline: 'none' }}>
              <option value="">Top Down</option>
              <option value="Top Down">Top Down</option>
              <option value="Não Top Down">Não Top Down</option>
            </select>
          )}
          <MultiFilter label="Base Elegivel" selected={filterBaseElegivel} onChange={setFilterBaseElegivel} options={["FY26","FY27","Organico 3S",'(Vazio)']} filterId="base" />
          {activeProduct === 'totem' && <MultiFilter label="HAAS/SAAS" selected={filterHaas} onChange={setFilterHaas} options={["HAAS","SAAS",'(Vazio)']} filterId="haas" />}
          {activeProduct === 'comer_fora' && (<>
            <MultiFilter label="Estrategia" selected={filterCFEstrategia} onChange={setFilterCFEstrategia} options={[...new Set(brands.filter(b=>b.comer_fora_details?.estrategia).map(b=>b.comer_fora_details.estrategia))].sort()} filterId="cf_estrategia" />
            <MultiFilter label="Solucao" selected={filterCFSolucao} onChange={setFilterCFSolucao} options={[...new Set(brands.filter(b=>b.comer_fora_details?.solucao).map(b=>b.comer_fora_details.solucao))].sort()} filterId="cf_solucao" />
            <MultiFilter label="Provider" selected={filterCFProvider} onChange={setFilterCFProvider} options={[...new Set(brands.filter(b=>b.comer_fora_details?.provider).map(b=>b.comer_fora_details.provider))].sort()} filterId="cf_provider" />
            <MultiFilter label="Cidade" selected={filterCFCidade} onChange={setFilterCFCidade} options={[...new Set(brands.filter(b=>b.comer_fora_details?.cidade).flatMap(b=>(b.comer_fora_details.cidade||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort()} filterId="cf_cidade" />
            <MultiFilter label="Trade" selected={filterCFTrade} onChange={setFilterCFTrade} options={['Sim','Não']} filterId="cf_trade" />
            <MultiFilter label="Prioridade" selected={filterCFPrioridade} onChange={setFilterCFPrioridade} options={['1','2','3']} filterId="cf_prioridade" />
            <MultiFilter label="Prioridade Mes" selected={filterCFPrioMes} onChange={setFilterCFPrioMes} options={['1','2']} filterId="cf_prio_mes" />
          </>)}
          {activeProduct === 'emilia_vision' && (<>
            <MultiFilter label="Tipo" selected={filterEVTipo} onChange={setFilterEVTipo} options={['Hunting','Farming']} filterId="ev_tipo" />
            <MultiFilter label="Sinergia" selected={filterEVSinergia} onChange={setFilterEVSinergia} options={['Emilia ajudou','3S ajudou','Sinergia']} filterId="ev_sinergia" />
            {(() => { const cur = filterEVBaseAndres; return (
              <select value={cur} onChange={e => setFilterEVBaseAndres(e.target.value)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 10, border: cur ? '1px solid #fa8072' : '1px solid #e2e8f0', background: cur ? '#fff5f5' : '#fff', color: cur ? '#fa8072' : '#64748b', cursor: 'pointer', fontWeight: 500 }}>
                <option value="">Base Andres</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            ); })()}
          </>)}
          {activeProduct === 'novos_produtos_3s' && (<>
            <MultiFilter label="Add-on" selected={filterNP3SAddon} onChange={setFilterNP3SAddon} options={['3S Eats','3S Go','Pagamento na Mesa']} filterId="np3s_addon" />
            <MultiFilter label="Mensalidade" selected={filterNP3SMensalidade} onChange={setFilterNP3SMensalidade} options={['3S Eats','3S Go','Pagamento na Mesa']} filterId="np3s_mens" />
          </>)}
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
                        {activeProduct === 'novos_produtos_3s' ? (
                          <>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{b.qtd_lojas_fisicas || 0} lojas</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {b.classificacao && <span style={{ fontSize: 10, background: (CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8') + '18', color: CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{b.classificacao}</span>}
                              {b.novos_produtos_3s_details?.eats && <span style={{ fontSize: 10, background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Eats</span>}
                              {b.novos_produtos_3s_details?.go && <span style={{ fontSize: 10, background: '#dbeafe', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Go</span>}
                              {b.novos_produtos_3s_details?.pagamento_mesa && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Pgto Mesa</span>}
                              {Object.entries(b.pipelines || {}).filter(([k, v]) => k !== activeProduct && v.stage).map(([k]) => (
                                <div key={k} title={PRODUCTS[k]?.name} style={{ width: 6, height: 6, borderRadius: '50%', background: PRODUCTS[k]?.color, marginTop: 3 }} />
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Resp: {b.pipelines?.[activeProduct]?.responsavel || '—'}</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {b.classificacao && <span style={{ fontSize: 10, background: (CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8') + '18', color: CLASSIFICACAO_COLORS[b.classificacao] || '#94a3b8', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{b.classificacao}</span>}
                              {b.analise_teste_pdv && <span style={{ fontSize: 10, background: '#f3e8ff', color: '#7c3aed', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>AT</span>}
                              {b.top_down === 'Top Down' && <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>TD</span>}
                              {b.top_down === 'Não Top Down' && <span style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>NTD</span>}
                              {b.estado && <span style={{ fontSize: 10, background: '#dbeafe', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{b.estado}</span>}
                              {b.culinaria && <span style={{ fontSize: 10, background: "#faf5ff", color: "#7c3aed", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{b.culinaria}</span>}
                              {activeProduct === 'totem' && b.produto_totem && <span style={{ fontSize: 10, background: "#fefce8", color: "#a16207", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{b.produto_totem}</span>}
                              {activeProduct === 'totem' && b.base_totem && <span style={{ fontSize: 10, background: "#f0f9ff", color: "#0369a1", padding: "1px 6px", borderRadius: 4, fontWeight: 600, marginLeft: 2 }}>{b.base_totem}</span>}
                              {activeProduct === 'emilia_vision' && <span style={{ fontSize: 10, background: (b.emilia_vision_details?.tipo || 'Hunting') === 'Hunting' ? '#fef3c7' : '#d1fae5', color: (b.emilia_vision_details?.tipo || 'Hunting') === 'Hunting' ? '#92400e' : '#065f46', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{b.emilia_vision_details?.tipo || 'Hunting'}</span>}
                              {Object.entries(b.pipelines || {}).filter(([k, v]) => k !== activeProduct && v.stage).map(([k]) => (
                                <div key={k} title={PRODUCTS[k]?.name} style={{ width: 6, height: 6, borderRadius: '50%', background: PRODUCTS[k]?.color, marginTop: 3 }} />
                              ))}
                            </div>
                          </>
                        )}
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
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>{b.pipelines?.[activeProduct]?.responsavel || '—'}</td>
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

            {/* PIPELINE PDVs POR PRODUTO */}
            {(() => {
              const getPdvBrands = (pk, stages, classFilter) => brands.filter(b => {
                const st = b.pipelines?.[pk]?.stage;
                if (!st || st === '0. Nao Iniciado' || st === '14. Desativado') return false;
                if (classFilter && !classFilter.includes(b.classificacao)) return false;
                return stages.includes(st);
              });
              const sumLojas = (list) => list.reduce((s, b) => s + (parseInt(b.qtd_lojas_fisicas) || 0), 0);

              const pdvRows = [
                {
                  label: '3S P/M', color: '#EA1D2C', pk: '3s', classFilter: ['P','M'],
                  topo: ['1. Iniciado','2. Primeiro Contato Marca','3. Apresentacao'],
                  topoLabel: 'Iniciado · Contato · Apresentação',
                  meio: ['4. Diagnostico','5. Demo/Showroom'],
                  meioLabel: 'Diagnóstico · Demo/Showroom',
                  avanc: ['6. Negociacao','7. Piloto','8. Contrato enviado'],
                  avancLabel: 'Negociação · Piloto · Contrato env.',
                  fechadas: ['9. Contrato assinado'],
                  fechadasLabel: 'Contrato assinado',
                  perdidas: ['10. Perdido','11. Stand by'],
                  perdidasLabel: 'Perdido · Stand by',
                },
                {
                  label: '3S G', color: '#EA1D2C', pk: '3s', classFilter: ['G'],
                  topo: ['1. Iniciado','2. Primeiro Contato Marca','3. Apresentacao'],
                  topoLabel: 'Iniciado · Contato · Apresentação',
                  meio: ['4. Diagnostico','5. Demo/Showroom'],
                  meioLabel: 'Diagnóstico · Demo/Showroom',
                  avanc: ['6. Negociacao','7. Piloto','8. Contrato enviado'],
                  avancLabel: 'Negociação · Piloto · Contrato env.',
                  fechadas: ['9. Contrato assinado'],
                  fechadasLabel: 'Contrato assinado',
                  perdidas: ['10. Perdido','11. Stand by'],
                  perdidasLabel: 'Perdido · Stand by',
                },
                {
                  label: 'Saipos', color: '#3b82f6', pk: 'saipos', classFilter: null,
                  topo: ['1. Tentativa de contato','2. Contato inicial','3. Apresentacao'],
                  topoLabel: 'Tentativa · Contato · Apresentação',
                  meio: ['4. Negociacao','5. Piloto'],
                  meioLabel: 'Negociação · Piloto',
                  avanc: ['6. Contrato enviado'],
                  avancLabel: 'Contrato enviado',
                  fechadas: ['7. Contrato assinado'],
                  fechadasLabel: 'Contrato assinado',
                  perdidas: ['8. Perdido','9. Stand by'],
                  perdidasLabel: 'Perdido · Stand by',
                },
                {
                  label: 'Totem', color: '#eab308', pk: 'totem', classFilter: null,
                  topo: ['1. Contato inicial'],
                  topoLabel: 'Contato inicial',
                  meio: ['2. Negociacao'],
                  meioLabel: 'Negociação',
                  avanc: ['3. Contrato Enviado','4. Primeiro Contrato Assinado'],
                  avancLabel: 'Contrato env. · 1º Contrato',
                  fechadas: ['5. Rollout Finalizado'],
                  fechadasLabel: 'Rollout finalizado',
                  perdidas: ['6. Perdido'],
                  perdidasLabel: 'Perdido',
                },
                {
                  label: 'Comer Fora', color: '#9C050B', pk: 'comer_fora', classFilter: null,
                  topo: ['Buscando Reuniao','Reuniao Agendada'],
                  topoLabel: 'Buscando · Reunião ag.',
                  meio: ['Reuniao Realizada'],
                  meioLabel: 'Reunião realizada',
                  avanc: ['Em negociacao'],
                  avancLabel: 'Em negociação',
                  fechadas: ['Aceite'],
                  fechadasLabel: 'Aceite',
                  perdidas: [],
                  perdidasLabel: null,
                },
                {
                  label: 'Emilia Vision', color: '#fa8072', pk: 'emilia_vision', classFilter: null,
                  topo: ['Buscando Reuniao','Reuniao Agendada'],
                  topoLabel: 'Buscando · Reunião ag.',
                  meio: ['Reuniao Realizada'],
                  meioLabel: 'Reunião realizada',
                  avanc: ['Em negociacao'],
                  avancLabel: 'Em negociação',
                  fechadas: ['Aceite'],
                  fechadasLabel: 'Aceite',
                  perdidas: [],
                  perdidasLabel: null,
                },
              ];

              const PdvCard = ({ label, stageLabel, marcas, lojas, color, wow }) => (
                <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 120, boxShadow: '0 1px 3px rgba(0,0,0,.05)', border: '1px solid #f1f5f9' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                  {stageLabel && <div style={{ color: '#cbd5e1', fontSize: 10, marginBottom: 6, marginTop: 2 }}>{stageLabel}</div>}
                  {!stageLabel && <div style={{ marginBottom: 6 }} />}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: color || '#1e293b' }}>{marcas}</span>
                    {wow !== undefined && wow !== null && <span style={{ fontSize: 11, fontWeight: 600, color: wow > 0 ? '#22c55e' : wow < 0 ? '#ef4444' : '#94a3b8' }}>{wow > 0 ? '+'+wow : wow} vs LW</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{lojas} lojas</div>
                </div>
              );

              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 14px' }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Pipeline PDVs</h4>
                    {wowDates && <span style={{ fontSize: 11, color: '#94a3b8' }}>WoW: {wowDates.ref.slice(5).replace('-','/')} vs {wowDates.prev.slice(5).replace('-','/')}</span>}
                  </div>
                  {pdvRows.map((row) => {
                    const topoB = getPdvBrands(row.pk, row.topo, row.classFilter);
                    const meioB = getPdvBrands(row.pk, row.meio, row.classFilter);
                    const avancB = getPdvBrands(row.pk, row.avanc, row.classFilter);
                    const fechadasB = getPdvBrands(row.pk, row.fechadas, row.classFilter);
                    const perdidasB = row.perdidas.length > 0 ? getPdvBrands(row.pk, row.perdidas, row.classFilter) : null;
                    const totalM = topoB.length + meioB.length + avancB.length + fechadasB.length + (perdidasB?.length || 0);
                    const totalL = sumLojas(topoB) + sumLojas(meioB) + sumLojas(avancB) + sumLojas(fechadasB) + (perdidasB ? sumLojas(perdidasB) : 0);
                    const wowKey = row.pk === '3s' ? (row.classFilter?.includes('P') ? '3s_pm' : '3s_g') : row.pk;
                    const wk = wowData?.[wowKey];
                    return (
                      <div key={row.label} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: row.color }}>{row.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <PdvCard label="Total Marcas" stageLabel={null} marcas={totalM} lojas={totalL} color="#1e293b" />
                          <PdvCard label="Topo do Funil" stageLabel={row.topoLabel} marcas={topoB.length} lojas={sumLojas(topoB)} wow={wk?.topo} />
                          <PdvCard label="Meio do Funil" stageLabel={row.meioLabel} marcas={meioB.length} lojas={sumLojas(meioB)} wow={wk?.meio} />
                          <PdvCard label="Avançadas" stageLabel={row.avancLabel} marcas={avancB.length} lojas={sumLojas(avancB)} wow={wk?.avanc} />
                          <PdvCard label="Fechadas" stageLabel={row.fechadasLabel} marcas={fechadasB.length} lojas={sumLojas(fechadasB)} color="#22c55e" wow={wk?.fechadas} />
                          {perdidasB !== null ? (
                            <PdvCard label="Perdidas/Stand By" stageLabel={row.perdidasLabel} marcas={perdidasB.length} lojas={sumLojas(perdidasB)} color="#ef4444" wow={wk?.perdidas} />
                          ) : (
                            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 120, border: '1px solid #f1f5f9', opacity: 0.4 }}>
                              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>Perdidas/Stand By</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#94a3b8' }}>—</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {/* PERDIDOS E STAND BY POR MOTIVO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              {[{ title: 'Perdidos por Motivo', badge: '3S', data: metrics.lostByReason, color: '#ef4444', total: metrics.lost3s, totalLojas: metrics.lostLojas },
                { title: 'Stand By por Motivo', badge: '3S', data: metrics.standbyByReason, color: '#f59e0b', total: metrics.standby3s, totalLojas: metrics.standbyLojas }
              ].map(section => (
                <div key={section.title} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center' }}>{section.title}{section.badge && <span style={{ background: '#fef2f2', color: '#EA1D2C', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, marginLeft: 8 }}>{section.badge}</span>}</h4>
                  {Object.keys(section.data).length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum registro</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                          <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Motivo</th>
                          <th style={{ textAlign: 'center', padding: '8px 0', color: '#64748b', fontWeight: 600, width: 70 }}>Marcas</th>
                          <th style={{ textAlign: 'center', padding: '8px 0', color: '#64748b', fontWeight: 600, width: 70 }}>Lojas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(section.data).sort((a, b) => b[1].count - a[1].count).map(([reason, vals]) => (
                          <tr key={reason} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 0', color: '#1e293b' }}>{reason}</td>
                            <td style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600, color: section.color }}>{vals.count}</td>
                            <td style={{ textAlign: 'center', padding: '8px 0', color: '#64748b' }}>{vals.lojas}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 0', fontWeight: 700, color: '#1e293b' }}>Total</td>
                          <td style={{ textAlign: 'center', padding: '8px 0', fontWeight: 700, color: section.color }}>{section.total}</td>
                          <td style={{ textAlign: 'center', padding: '8px 0', fontWeight: 700, color: '#64748b' }}>{section.totalLojas}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}


        {/* FORECAST */}
        {view === 'forecast' && forecastMetas.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Carregando forecast...</p>
          </div>
        )}
        {view === 'forecast' && forecastMetas.length > 0 && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {FORECAST_SECTIONS.map(s => (
                <button key={s.key} onClick={() => setForecastSection(s.key)} style={{ padding: '8px 18px', borderRadius: 10, border: forecastSection === s.key ? '2px solid ' + s.color : '1px solid #e2e8f0', background: forecastSection === s.key ? s.color + '10' : '#fff', color: forecastSection === s.key ? s.color : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{FORECAST_SECTIONS.find(s => s.key === forecastSection)?.label}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>{FORECAST_SECTIONS.find(s => s.key === forecastSection)?.subtitle}</p>
            </div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Meta Anual', value: FISCAL_MONTHS.reduce((s, fm) => s + (forecastMetas.find(x => x.section === forecastSection && x.year === fm.year && x.month === fm.month)?.meta_lojas || 0), 0), color: '#1e293b' },
                { label: 'Atingido', value: forecastEntries.filter(e => e.section === forecastSection && e.checked).reduce((s, e) => s + (e.lojas || 0), 0), color: '#22c55e' },
                { label: 'Forecast', value: forecastEntries.filter(e => e.section === forecastSection).reduce((s, e) => s + (e.lojas || 0), 0), color: FORECAST_SECTIONS.find(s => s.key === forecastSection)?.color || '#EA1D2C' },
              ].map(kpi => (
                <div key={kpi.label} style={{ flex: 1, minWidth: 140, background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{kpi.label} (Lojas)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>
            {canEditForecast && forecastEntries.some(e => e._dirty) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={saveForecastChanges} disabled={saving} style={{ padding: '10px 28px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(34,197,94,.3)' }}><Save size={16} /> {saving ? 'Salvando...' : 'Salvar alteracoes'}</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 20 }}>
              {FISCAL_MONTHS.map(fm => {
                const secColor = FORECAST_SECTIONS.find(s => s.key === forecastSection)?.color || '#EA1D2C';
                const metaLojas = forecastMetas.find(m => m.section === forecastSection && m.year === fm.year && m.month === fm.month)?.meta_lojas || 0;
                const monthEntries = forecastEntries.filter(e => e.section === forecastSection && e.year === fm.year && e.month === fm.month);
                const totalLojas = monthEntries.reduce((s, e) => s + (e.lojas || 0), 0);
                const checkedLojas = monthEntries.filter(e => e.checked).reduce((s, e) => s + (e.lojas || 0), 0);
                const pctMTD = metaLojas > 0 ? Math.round(checkedLojas / metaLojas * 100) : 0;
                const pctFcts = metaLojas > 0 ? Math.round(totalLojas / metaLojas * 100) : 0;
                const isCurrent = fm.year === new Date().getFullYear() && fm.month === new Date().getMonth() + 1;
                return (
                  <div key={fm.year + '-' + fm.month} style={{ flex: '0 0 200px', background: isCurrent ? '#fffbeb' : '#fff', borderRadius: 14, border: '1px solid ' + (isCurrent ? '#fde68a' : '#e2e8f0'), display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 300px)' }}>
                    <div style={{ padding: '10px 14px 8px', borderBottom: '2px solid ' + secColor, background: isCurrent ? '#fffbeb' : '#fff', borderRadius: '14px 14px 0 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{MONTH_LABELS[fm.month]}/{String(fm.year).slice(2)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pctMTD >= 100 ? '#22c55e' : '#64748b' }}>{checkedLojas}/{metaLojas}</span>
                      </div>
                      {canEditForecast ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>Meta:</span>
                          <input type="number" defaultValue={metaLojas} key={forecastSection + '-' + fm.year + '-' + fm.month} onBlur={e => updateForecastMeta(forecastSection, fm.year, fm.month, e.target.value)} style={{ width: 50, padding: '2px 4px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 11, textAlign: 'center', outline: 'none' }} />
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Meta: {metaLojas}</div>
                      )}
                      <div style={{ marginTop: 6, background: '#f1f5f9', borderRadius: 4, height: 6 }}>
                        <div style={{ background: '#22c55e', height: 6, borderRadius: 4, width: Math.min(pctMTD, 100) + '%', transition: 'width .3s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: '#94a3b8' }}>MTD {pctMTD}%</span>
                        <span style={{ fontSize: 9, color: '#94a3b8' }}>Fcts {pctFcts}%</span>
                      </div>
                    </div>
                    <div style={{ padding: 6, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 50 }}>
                      {monthEntries.map(entry => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: entry.checked ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: '1px solid ' + (entry.checked ? '#bbf7d0' : '#f1f5f9'), fontSize: 12 }}>
                          <button onClick={() => canEditForecast && toggleForecastCheck(entry.id, entry.checked)} disabled={!canEditForecast} style={{ width: 20, height: 20, borderRadius: 6, border: entry.checked ? 'none' : '2px solid #d1d5db', background: entry.checked ? '#22c55e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canEditForecast ? 'pointer' : 'default', flexShrink: 0 }}>
                            {entry.checked && <Check size={12} color="#fff" />}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: entry.checked ? '#166534' : '#1e293b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.marca}</div>
                          </div>
                          <input type="number" value={entry.lojas} disabled={!canEditForecast} onChange={e => updateForecastLojasLocal(entry.id, e.target.value)} style={{ width: 40, padding: '2px 4px', border: entry._dirty ? '1px solid #f59e0b' : '1px solid #e2e8f0', borderRadius: 4, fontSize: 11, textAlign: 'center', outline: 'none', opacity: canEditForecast ? 1 : 0.6, background: entry._dirty ? '#fffbeb' : '#fff' }} />
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>lj</span>
                          {canEditForecast && <button onClick={() => deleteForecastEntry(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d1d5db' }}><X size={12} /></button>}
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#64748b', borderTop: '1px solid #e2e8f0', marginTop: 2 }}>
                        <span>Total</span>
                        <span>{totalLojas} lojas</span>
                      </div>
                    </div>
                    {canEditForecast && (
                      <div style={{ padding: '6px 8px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 4 }}>
                        <input placeholder="Marca" value={newForecastMarca} onChange={e => setNewForecastMarca(e.target.value)} style={{ flex: 1, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, outline: 'none', minWidth: 0 }} />
                        <input placeholder="Lj" type="number" value={newForecastLojas} onChange={e => setNewForecastLojas(e.target.value)} style={{ width: 36, padding: '4px 4px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, textAlign: 'center', outline: 'none' }} />
                        <button onClick={() => addForecastEntry(forecastSection, fm.year, fm.month)} style={{ padding: '4px 8px', background: secColor, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}><Plus size={12} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* SCORECARD */}
        {view === 'scorecard' && (() => {
          if (!scData) { return <div style={{ textAlign:'center', padding:40 }}><p style={{ color:'#94a3b8' }}>Carregando scorecard...</p></div>; }
          const SC_DUPLA_LABELS = { total:'FUNIL DE VENDA', lidia_gabi:'Lidia e Gabi', marcos_joao:'Marcos e Joao', michel_emerson:'Michel e Emerson' };
          const SC_DUPLA_COLORS = { total:'#EA1D2C', lidia_gabi:'#DA5D69', marcos_joao:'#9C050B', michel_emerson:'#A02331' };
          const SC_METRIC_LABELS = {
            elegiveis:'Marcas Elegiveis',
            nao_iniciado:'Nao Iniciado', iniciado:'Iniciado',
            primeiro_contato:'Primeiro Contato', apresentacao:'Apresentacao',
            diagnostico:'Diagnostico', demo_showroom:'Demo/Showroom',
            negociacao:'Negociacao', piloto:'Piloto',
            contrato_enviado:'Contrato Enviado', contrato_assinado:'Contrato Assinado',
            perdido:'Perdido', stand_by:'Stand by', organico:'Organico',
            lojas:'Lojas Fechadas',
          };
          const SC_FUNNEL = [
            { key:'elegiveis', label:'MARCAS ELEGIVEIS', isBold:true, isLive:true },
            { key:'taxa_pc', label:'Taxa Conversao - PRIMEIRO CONTATO', isPercent:true, num:'primeiro_contato', den:'elegiveis' },
            { key:'primeiro_contato', label:'PRIMEIRO CONTATO', isBold:true },
            { key:'taxa_apres', label:'Taxa Conversao - APRESENTACAO', isPercent:true, num:'apresentacao', den:'primeiro_contato' },
            { key:'apresentacao', label:'APRESENTACAO', isBold:true },
            { key:'taxa_neg', label:'Taxa Conversao - NEGOCIACAO', isPercent:true, num:'negociacao', den:'apresentacao' },
            { key:'negociacao', label:'NEGOCIACAO', isBold:true },
            { key:'taxa_fechadas', label:'Taxa Conversao - CONTRATO ASSINADO', isPercent:true, num:'contrato_assinado', den:'negociacao' },
            { key:'contrato_assinado', label:'CONTRATO ASSINADO', isBold:true },
            { key:'media_lojas', label:'Media de lojas por marca', isLive:true },
            { key:'lojas', label:'Lojas Fechadas', isBold:true },
          ];
          const SC_ALL_STAGES = [
            { key:'nao_iniciado', label:'Nao Iniciado' },
            { key:'iniciado', label:'Iniciado' },
            { key:'primeiro_contato', label:'Primeiro Contato' },
            { key:'apresentacao', label:'Apresentacao' },
            { key:'diagnostico', label:'Diagnostico' },
            { key:'demo_showroom', label:'Demo/Showroom' },
            { key:'negociacao', label:'Negociacao' },
            { key:'piloto', label:'Piloto' },
            { key:'contrato_enviado', label:'Contrato Enviado' },
            { key:'contrato_assinado', label:'Contrato Assinado' },
            { key:'perdido', label:'Perdido' },
            { key:'stand_by', label:'Stand by' },
            { key:'organico', label:'Organico' },
          ];
          const scPctColor = (p) => { if (!p || p === '—') return '#94a3b8'; const n = parseInt(p); return n >= 100 ? '#22c55e' : n >= 70 ? '#f59e0b' : '#ef4444'; };

          // WoW helpers
          const WOW_ROWS = [
            { key:'primeiro_contato', label:'Primeiro Contato' },
            { key:'apresentacao', label:'Apresentacao' },
            { key:'negociacao', label:'Negociacao' },
            { key:'contrato_assinado', label:'Contrato Assinado' },
            { key:'lojas', label:'Lojas' },
          ];
          const wowColor = (v) => v > 0 ? '#22c55e' : v < 0 ? '#ef4444' : '#94a3b8';
          const wowLabel = (v) => v > 0 ? '+'+v : v < 0 ? ''+v : '0';
          const getWow = (dupla, metric) => scData?.wow?.[dupla]?.[metric] ?? null;
          const today = new Date();
          const scTotalBD = getMonthBusinessDays(scYear, scMonth - 1);
          const scMtdBD = scYear === today.getFullYear() && scMonth === today.getMonth() + 1 ? getMonthBusinessDaysMTD(scYear, scMonth - 1, today) : scTotalBD;
          const scCurKey = scYear + '-' + String(scMonth).padStart(2,'0');
          const DK = ['lidia_gabi','marcos_joao','michel_emerson'];
          const isG = scClassFilter === 'g';

          // Get meta value
          const scGmS = (d,y,m,f) => {
            if (!scData?.metas) return 0;
            const x = scData.metas.find(r => r.dupla === d && r.year === y && r.month === m);
            if (!x) return 0;
            const fieldMap = { contrato_assinado: 'fechadas' };
            return x[fieldMap[f] || f] || 0;
          };
          const scGm = (d,y,m,f) => d === 'total' ? DK.reduce((s,k) => s + scGmS(k,y,m,f), 0) : scGmS(d,y,m,f);
          // Get realized value
          const scGr = (d,ym,f) => d === 'total' ? DK.reduce((s,k) => s + (scData?.realized?.[ym]?.[k]?.[f]||0), 0) : (scData?.realized?.[ym]?.[d]?.[f]||0);
          // Get elegiveis
          const scGe = (d) => d === 'total' ? DK.reduce((s,k) => s + (scData?.elegiveis?.[k]||0), 0) : (scData?.elegiveis?.[d]||0);
          // Get forecast
          const scGf = (d,ym,fl) => d === 'total' ? DK.reduce((s,k) => s + (scData?.forecast?.[ym]?.[k]?.[fl]||0), 0) : (scData?.forecast?.[ym]?.[d]?.[fl]||0);

          // Month columns
          const scMonthCols = (() => { const c = []; for (let y = 2026; y <= scYear; y++) { const ms = y===2026?2:1, mx = y===scYear?scMonth:12; for (let m = ms; m <= mx; m++) c.push({y,m,k:y+'-'+String(m).padStart(2,'0')}); } return c; })();
          const scPastCols = scMonthCols.filter(c => !(c.y===scYear && c.m===scMonth));
          const scHasCur = scMonthCols.some(c => c.y===scYear && c.m===scMonth);

          // Build table rows for a dupla
          const scBuildRows = (dupla) => {
            const cmR={},cmM={},fcst={},mtdM={};
            const metricKeys = ['primeiro_contato','apresentacao','negociacao','contrato_assinado','lojas'];
            metricKeys.forEach(f => {
              cmR[f]=scGr(dupla,scCurKey,f); cmM[f]=scGm(dupla,scYear,scMonth,f);
              fcst[f]=scMtdBD>0?Math.round((cmR[f]/scMtdBD)*scTotalBD):0;
              mtdM[f]=scTotalBD>0?Math.round((cmM[f]/scTotalBD)*scMtdBD):0;
            });
            const eleg=scGe(dupla), elegMeta=scGm(dupla,scYear,scMonth,'elegiveis');
            return SC_FUNNEL.map(def => {
              const row = {...def, cells:[]};
              scMonthCols.forEach(col => {
                const isCur = col.y===scYear && col.m===scMonth;
                if (def.key==='elegiveis') {
                  if (isCur) row.cells.push({isCur:true,meta:elegMeta,fcst:eleg,pctA:elegMeta>0?Math.round((eleg/elegMeta)*100)+'%':'—',real:eleg,mtdMeta:eleg,mtdReal:eleg,mtdPct:'100%',ym:col.k});
                  else row.cells.push({v: isG ? eleg : scGm(dupla,col.y,col.m,'elegiveis'),ym:col.k});
                }
                else if (def.key==='media_lojas') {
                  const fch = isCur ? cmR.contrato_assinado : scGr(dupla,col.k,'contrato_assinado');
                  const loj = isCur ? cmR.lojas : scGr(dupla,col.k,'lojas');
                  const v = fch > 0 ? Math.round((loj/fch)*10)/10 : 0;
                  if (isCur) {
                    const ml = scGm(dupla,scYear,scMonth,'media_lojas');
                    // Para o Fcst, usar os valores de forecast (scGf) em vez dos reais
                    const fcstMarcas = scGf(dupla,col.k,'marcas') || cmR.contrato_assinado;
                    const fcstLojas = scGf(dupla,col.k,'lojas') || cmR.lojas;
                    const fcstMedia = fcstMarcas > 0 ? Math.round((fcstLojas/fcstMarcas)*10)/10 : 0;
                    row.cells.push({isCur:true,meta:ml,fcst:fcstMedia,pctA:ml>0?Math.round((fcstMedia/ml)*100)+'%':'—',real:v,mtdMeta:v,mtdReal:v,mtdPct:'—',isLive:true,ym:col.k});
                  }
                  else row.cells.push({v,ym:col.k});
                }
                else if (def.isForecast) {
                  const ff=def.key==='fcst_marcas'?'marcas':'lojas', v=scGf(dupla,col.k,ff);
                  if (isCur) row.cells.push({isCur:true,isFcstCell:true,v,ym:col.k});
                  else row.cells.push({v,ym:col.k});
                }
                else if (def.isPercent) {
                  let num=0,den=1;
                  if (isCur) {
                    if (def.den==='elegiveis') { num=cmR[def.num]; den=eleg; }
                    else { num=cmR[def.num]; den=cmR[def.den]; }
                  } else {
                    if (def.den==='elegiveis') { num=scGr(dupla,col.k,def.num); den=isG ? eleg : scGm(dupla,col.y,col.m,'elegiveis'); }
                    else { num=scGr(dupla,col.k,def.num); den=scGr(dupla,col.k,def.den); }
                  }
                  const pct=den>0?Math.round((num/den)*100)+'%':'0%';
                  row.cells.push(isCur?{isCur:true,isRate:true,v:pct,ym:col.k}:{v:pct,ym:col.k});
                }
                else {
                  const f=def.key;
                  if (isCur) {
                    const fcstOverride=def.key==='contrato_assinado'?scGf(dupla,col.k,'marcas'):def.key==='lojas'?scGf(dupla,col.k,'lojas'):null;
                    const fcstVal=fcstOverride!==null&&fcstOverride>0?fcstOverride:fcst[f];
                    const pctA=cmM[f]>0?Math.round((fcstVal/cmM[f])*100)+'%':'—';
                    const pctMtd=mtdM[f]>0?Math.round((cmR[f]/mtdM[f])*100)+'%':'—';
                    row.cells.push({isCur:true,meta:cmM[f],fcst:fcstVal,pctA,real:cmR[f],mtdMeta:mtdM[f],mtdReal:cmR[f],mtdPct:pctMtd,ym:col.k});
                  } else row.cells.push({v:scGr(dupla,col.k,def.key),ym:col.k});
                }
              });
              return row;
            });
          };

          // Open modal with brand list
          const scOpenModal = (metric, ym, dp) => {
            if (!metric || metric.startsWith('taxa_') || metric === 'media_lojas') return;
            setScModal({ metric, ym, dupla:dp, label: SC_METRIC_LABELS[metric]||metric });
            setScModalLoading(false);
            if (metric === 'elegiveis') {
              let list = (scData?.eligBrands || []);
              if (dp !== 'total') list = list.filter(b => b.dupla === dp);
              list.sort((a,b) => a.marca.localeCompare(b.marca));
              setScModalBrands(list);
            } else {
              const bk = ym + '|' + metric;
              let list = (scData?.brandLists?.[bk] || []);
              if (dp !== 'total') list = list.filter(b => b.dupla === dp);
              list.sort((a,b) => a.marca.localeCompare(b.marca));
              setScModalBrands(list);
            }
          };

          // Styles
          const scTh = { padding:'8px 10px', fontSize:12, fontWeight:600, color:'#64748b', borderBottom:'1px solid #e2e8f0', textAlign:'center', whiteSpace:'nowrap' };
          const scTd = { padding:'6px 10px', fontSize:14, borderBottom:'1px solid #f1f5f9', whiteSpace:'nowrap' };
          const scClickable = { cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted', textUnderlineOffset:2 };

          const ScVal = ({ v, metric, ym, dupla: dp, bold, color: c }) => {
            const ok = metric && !metric.startsWith('taxa_') && metric !== 'media_lojas' && v > 0;
            return ok ? <span style={{...scClickable,fontWeight:bold?700:400,color:c||'inherit'}} onClick={()=>scOpenModal(metric,ym,dp)}>{v}</span> : <span style={{fontWeight:bold?700:400,color:c||'inherit'}}>{v}</span>;
          };

          return (
            <div>
              {/* Modal */}
              {scModal && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setScModal(null)}>
                  <div style={{background:'#fff',borderRadius:16,width:'90%',maxWidth:600,maxHeight:'80vh',display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
                    <div style={{padding:'16px 20px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div><div style={{fontSize:16,fontWeight:700,color:'#1e293b'}}>{scModal.label}</div><div style={{fontSize:12,color:'#94a3b8'}}>{MONTH_NAMES[parseInt(scModal.ym.split('-')[1])-1]} {scModal.ym.split('-')[0]} — {SC_DUPLA_LABELS[scModal.dupla]}</div></div>
                      <button onClick={()=>setScModal(null)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><X size={20} color="#94a3b8"/></button>
                    </div>
                    <div style={{padding:'12px 20px',overflowY:'auto',flex:1}}>
                      {scModalLoading ? <p style={{textAlign:'center',color:'#94a3b8',padding:20}}>Carregando...</p> : scModalBrands.length === 0 ? <p style={{textAlign:'center',color:'#94a3b8',padding:20}}>Nenhuma marca</p> : (
                        <table style={{width:'100%',borderCollapse:'collapse'}}>
                          <thead><tr style={{background:'#f8fafc'}}><th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>#</th><th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>Marca</th><th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>Closer</th><th style={{padding:'8px 10px',textAlign:'right',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>Lojas</th></tr></thead>
                          <tbody>{scModalBrands.map((b,i) => <tr key={i} style={{background:i%2===0?'#fff':'#fafbfc'}}><td style={{padding:'6px 10px',fontSize:12,color:'#94a3b8',borderBottom:'1px solid #f1f5f9'}}>{i+1}</td><td style={{padding:'6px 10px',fontSize:12,fontWeight:600,color:'#1e293b',borderBottom:'1px solid #f1f5f9'}}>{b.marca}</td><td style={{padding:'6px 10px',fontSize:12,color:'#475569',borderBottom:'1px solid #f1f5f9'}}>{b.closer}</td><td style={{padding:'6px 10px',fontSize:12,color:'#475569',borderBottom:'1px solid #f1f5f9',textAlign:'right'}}>{b.lojas}</td></tr>)}</tbody>
                        </table>
                      )}
                    </div>
                    <div style={{padding:'12px 20px',borderTop:'1px solid #e2e8f0',background:'#f8fafc',fontSize:12,color:'#64748b',textAlign:'center'}}>{scModalBrands.length} marca{scModalBrands.length!==1?'s':''}</div>
                  </div>
                </div>
              )}
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid #e2e8f0'}}>
                    <button onClick={()=>{if(scClassFilter!=='pm'){setScClassFilter('pm');setScData(null);loadScorecard('pm');}}} style={{padding:'6px 14px',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',background:scClassFilter==='pm'?'#EA1D2C':'#fff',color:scClassFilter==='pm'?'#fff':'#64748b'}}>P / M</button>
                    <button onClick={()=>{if(scClassFilter!=='g'){setScClassFilter('g');setScData(null);loadScorecard('g');}}} style={{padding:'6px 14px',fontSize:12,fontWeight:600,border:'none',cursor:'pointer',borderLeft:'1px solid #e2e8f0',background:scClassFilter==='g'?'#EA1D2C':'#fff',color:scClassFilter==='g'?'#fff':'#64748b'}}>G</button>
                  </div>
                  <span style={{fontSize:12,color:'#94a3b8'}}>Marcas {scClassFilter==='g'?'G':'P e M'} | Produto: 3S Checkout</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <button onClick={()=>{setScData(null);loadScorecard();}} style={{padding:'8px 16px',background:'linear-gradient(135deg,#EA1D2C,#DA5D69)',border:'none',borderRadius:8,fontSize:13,fontWeight:700,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 2px 8px rgba(234,29,44,.2)'}}><TrendingUp size={14}/> Atualizar Dados</button>
                  <Calendar size={14} color="#64748b"/>
                  <select value={scMonth} onChange={e=>{setScMonth(+e.target.value);setScData(null);loadScorecard();}} style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'6px 10px',fontSize:13,fontWeight:600}}>
                    {MONTH_NAMES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                  <select value={scYear} onChange={e=>{setScYear(+e.target.value);setScData(null);loadScorecard();}} style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'6px 10px',fontSize:13,fontWeight:600}}>
                    <option value={2026}>2026</option><option value={2027}>2027</option>
                  </select>
                  <div style={{background:'#fef2f2',borderRadius:8,padding:'6px 12px',fontSize:12,color:'#EA1D2C',fontWeight:600}}>{scMtdBD}/{scTotalBD} dias uteis</div>
                </div>
              </div>
              {/* Movimentacoes por Stage (all stages) - collapsible */}
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden',marginBottom:16}}>
                <div onClick={()=>setScStagesOpen(!scStagesOpen)} style={{padding:'14px 20px',borderBottom:scStagesOpen?'2px solid #EA1D2C':'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',background:scStagesOpen?'#EA1D2C08':'#fff'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:'#EA1D2C'}}/>
                    <span style={{fontSize:14,fontWeight:700,color:'#1e293b'}}>Movimentacoes por Stage — {MONTH_NAMES[scMonth-1]} {scYear}</span>
                  </div>
                  <Filter size={18} color="#94a3b8" style={{transform:scStagesOpen?'rotate(180deg)':'none',transition:'.2s'}}/>
                </div>
                {scStagesOpen && <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      <th style={{...scTh,textAlign:'left',width:180}}>Stage</th>
                      <th style={scTh}>Total</th>
                      <th style={scTh}>Lidia e Gabi</th>
                      <th style={scTh}>Marcos e Joao</th>
                      <th style={scTh}>Michel e Emerson</th>
                    </tr></thead>
                    <tbody>
                      {SC_ALL_STAGES.map((stg,i) => {
                        const getV = (d) => scGr(d,scCurKey,stg.key);
                        const tot = getV('total');
                        const isBold = ['primeiro_contato','apresentacao','negociacao','contrato_assinado'].includes(stg.key);
                        return (
                          <tr key={stg.key} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                            <td style={{...scTd,fontWeight:isBold?700:400,color:'#1e293b'}}>{stg.label}</td>
                            <td style={{...scTd,textAlign:'center',fontWeight:isBold?700:400}}><ScVal v={tot} metric={stg.key} ym={scCurKey} dupla="total" bold={isBold}/></td>
                            <td style={{...scTd,textAlign:'center'}}><ScVal v={getV('lidia_gabi')} metric={stg.key} ym={scCurKey} dupla="lidia_gabi"/></td>
                            <td style={{...scTd,textAlign:'center'}}><ScVal v={getV('marcos_joao')} metric={stg.key} ym={scCurKey} dupla="marcos_joao"/></td>
                            <td style={{...scTd,textAlign:'center'}}><ScVal v={getV('michel_emerson')} metric={stg.key} ym={scCurKey} dupla="michel_emerson"/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>}
              </div>
              {/* Funnel tables per dupla */}
              {['total','lidia_gabi','marcos_joao','michel_emerson'].map(dupla => {
                const rows = scBuildRows(dupla);
                const open = scDupla === dupla;
                const clr = SC_DUPLA_COLORS[dupla];
                return (
                  <div key={dupla} style={{marginBottom:16,background:'#fff',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden'}}>
                    <div onClick={()=>setScDupla(open?null:dupla)} style={{padding:'14px 20px',background:clr+'08',borderBottom:open?'2px solid '+clr:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:10,height:10,borderRadius:'50%',background:clr}}/>
                        <span style={{fontSize:16,fontWeight:700}}>{SC_DUPLA_LABELS[dupla]}</span>
                        {dupla!=='total' && <span style={{fontSize:12,color:'#94a3b8'}}>({scGe(dupla)} elegiveis)</span>}
                      </div>
                      <Filter size={18} color="#94a3b8" style={{transform:open?'rotate(180deg)':'none',transition:'.2s'}}/>
                    </div>
                    {open && (
                      <div style={{overflowX:'auto'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
                          <thead>
                            <tr>
                              <th style={{...scTh,textAlign:'left',position:'sticky',left:0,background:'#f8fafc',zIndex:2}}></th>
                              {scPastCols.map(c=><th key={c.k} style={{...scTh,background:'#980000',color:'#fff',fontSize:10}}>Mês</th>)}
                              {scHasCur && !isG && <>
                                <th colSpan={3} style={{...scTh,background:'#980000',color:'#fff',fontSize:11,textAlign:'center'}}>Mês</th>
                                <th colSpan={3} style={{...scTh,background:'#073763',color:'#fff',fontSize:11,textAlign:'center'}}>MTD</th>
                              </>}
                              {scHasCur && isG && <>
                                <th style={{...scTh,background:'#980000',color:'#fff',fontSize:11,textAlign:'center'}}>Fcst</th>
                                <th style={{...scTh,background:'#073763',color:'#fff',fontSize:11,textAlign:'center'}}>MTD Real</th>
                              </>}
                              {isG && <th style={{...scTh,background:'#065f46',color:'#fff',fontSize:10}}>Acumulado</th>}
                              {scData?.wow && <th style={{...scTh,background:'#7c3aed',color:'#fff',fontSize:10}}>WoW</th>}
                            </tr>
                            <tr style={{background:'#f8fafc'}}>
                              <th style={{...scTh,width:250,textAlign:'left',position:'sticky',left:0,background:'#f8fafc',zIndex:2}}></th>
                              {scPastCols.map(c=><th key={c.k} style={{...scTh,fontSize:10}}>{MONTH_NAMES[c.m-1]} Real</th>)}
                              {scHasCur && !isG && <><th style={{...scTh,background:'#fef2f2',fontSize:10}}>{MONTH_NAMES[scMonth-1]} Meta</th><th style={{...scTh,background:'#fef2f2',fontSize:10}}>Fcst</th><th style={{...scTh,background:'#fef2f2',fontSize:10}}>% Atig</th><th style={{...scTh,background:'#fefce8',fontSize:10}}>MTD Meta</th><th style={{...scTh,background:'#fefce8',fontSize:10}}>MTD Real</th><th style={{...scTh,background:'#fef9c3',fontSize:10}}>MTD %</th></>}
                              {scHasCur && isG && <><th style={{...scTh,background:'#fef2f2',fontSize:10}}>Fcst</th><th style={{...scTh,background:'#fefce8',fontSize:10}}>MTD Real</th></>}
                              {isG && <th style={{...scTh,background:'#ecfdf5',fontSize:10}}>Total</th>}
                              {scData?.wow && <th style={{...scTh,background:'#f5f0ff',fontSize:10}}>Seg vs Seg</th>}
                            </tr></thead>
                          <tbody>
                            {rows.map((row,ri) => {
                              const wowVal = (row.key && !row.isPercent && row.key !== 'media_lojas' && row.key !== 'elegiveis') ? getWow(dupla, row.key) : null;
                              return (
                              <tr key={ri} style={{background:row.isBold?'#fffbfb':'#fff'}}>
                                <td style={{...scTd,fontWeight:row.isBold?700:400,fontSize:row.isPercent?11:12,color:row.isPercent?'#94a3b8':'#1e293b',position:'sticky',left:0,background:row.isBold?'#fffbfb':'#fff',zIndex:1}}>{row.label}</td>
                                {row.cells.map((cell,ci) => {
                                  if (!cell.isCur) return <td key={ci} style={{...scTd,textAlign:'center',fontWeight:row.isBold?600:400,color:row.isPercent?'#94a3b8':'#475569'}}><ScVal v={cell.v} metric={row.key} ym={cell.ym} dupla={dupla} bold={row.isBold}/></td>;
                                  if (cell.isRate) {
                                    if (isG) return [<td key={ci+'f'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>,<td key={ci+'mr'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>];
                                    return [<td key={ci+'m'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>,<td key={ci+'f'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>,<td key={ci+'p'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>,<td key={ci+'mm'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>,<td key={ci+'mr'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>,<td key={ci+'mp'} style={{...scTd,textAlign:'center',color:'#c0c5cc'}}></td>];
                                  }
                                  if (isG) return [<td key={ci+'f'} style={{...scTd,textAlign:'center',fontWeight:600,background:'#fef2f208'}}>{cell.fcst}</td>,<td key={ci+'mr'} style={{...scTd,textAlign:'center',fontWeight:700,background:'#fefce808'}}><ScVal v={cell.mtdReal} metric={row.key} ym={cell.ym} dupla={dupla} bold color={clr}/></td>];
                                  return [<td key={ci+'m'} style={{...scTd,textAlign:'center',background:'#fef2f208'}}>{cell.meta}</td>,<td key={ci+'f'} style={{...scTd,textAlign:'center',fontWeight:600,background:'#fef2f208'}}>{cell.fcst}</td>,<td key={ci+'p'} style={{...scTd,textAlign:'center',fontWeight:600,color:scPctColor(cell.pctA),background:'#fef2f208'}}>{cell.pctA}</td>,<td key={ci+'mm'} style={{...scTd,textAlign:'center',background:'#fefce808'}}>{cell.mtdMeta}</td>,<td key={ci+'mr'} style={{...scTd,textAlign:'center',fontWeight:700,background:'#fefce808'}}><ScVal v={cell.mtdReal} metric={row.key} ym={cell.ym} dupla={dupla} bold color={clr}/></td>,<td key={ci+'mp'} style={{...scTd,textAlign:'center',fontWeight:600,color:scPctColor(cell.mtdPct),background:'#fef9c308'}}>{cell.mtdPct}</td>];
                                })}
                                {isG && (() => {
                                  if (row.isPercent || row.key === 'media_lojas' || row.key === 'elegiveis') return <td style={{...scTd,textAlign:'center',color:'#d4d4d8',background:'#ecfdf508'}}>—</td>;
                                  const accum = row.cells.reduce((s, c) => s + (c.isCur ? (c.mtdReal || 0) : (typeof c.v === 'number' ? c.v : 0)), 0);
                                  return <td style={{...scTd,textAlign:'center',fontWeight:700,fontSize:14,color:'#065f46',background:'#ecfdf508'}}>{accum}</td>;
                                })()}
                                {scData?.wow && <td style={{...scTd,textAlign:'center',fontWeight:700,fontSize:14,color:wowVal!==null?(wowVal>0?'#22c55e':wowVal<0?'#ef4444':'#94a3b8'):'#d4d4d8',background:'#faf5ff'}}>{wowVal!==null?wowLabel(wowVal):'—'}</td>}
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {scData?._ts && <div style={{textAlign:'right',fontSize:10,color:'#cbd5e1',marginTop:8}}>Ultima atualizacao: {new Date(scData._ts).toLocaleString('pt-BR')}</div>}
            </div>
          );
        })()}
      {/* ÚLTIMAS ATUALIZAÇÕES */}
      {view === 'updates' && (
        <div style={{ padding: '20px 28px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Últimas Atualizações</h2>
            <button onClick={() => loadUpdates()} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Atualizar
            </button>
          </div>
          {/* Product filter tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {[{ key: 'todos', label: 'Todos' }, ...Object.entries(PRODUCTS).map(([k, v]) => ({ key: k, label: v.name }))].map(tab => (
              <button key={tab.key} onClick={() => { setUpdatesProduct(tab.key); loadUpdates(tab.key); }} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: updatesProduct === tab.key ? (tab.key === 'todos' ? '#1e293b' : (PRODUCTS[tab.key]?.color || '#1e293b')) : '#f1f5f9',
                color: updatesProduct === tab.key ? '#fff' : '#64748b',
              }}>
                {tab.label}
              </button>
            ))}
          </div>
          {/* Feed */}
          {updatesLoading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Carregando...</div>}
          {!updatesLoading && updatesData.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Nenhuma movimentação encontrada.</div>}
          {!updatesLoading && updatesData.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {updatesData.map(u => {
                const prodConfig = PRODUCTS[u.product] || {};
                const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') + ' ' + new Date(u.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div key={u.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', cursor: 'pointer' }} onClick={() => {
                          const found = brands.find(b => b.id === u.brand_id);
                          if (found) openBrandDetail(found, 'historico');
                        }}>
                          {u.marca}
                        </span>
                        {u.classificacao && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: CLASSIFICACAO_COLORS[u.classificacao] || '#e2e8f0', color: '#fff' }}>{u.classificacao}</span>}
                        {u.chave_agrupamento_name && <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>{u.chave_agrupamento_name}</span>}
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{dateStr}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: prodConfig.color || '#94a3b8', color: '#fff', fontSize: 10, fontWeight: 700 }}>{prodConfig.name || u.product}</span>
                      <span style={{ color: '#64748b' }}>{u.from_stage || '—'}</span>
                      <span style={{ color: '#94a3b8' }}>→</span>
                      <span style={{ color: '#1e293b', fontWeight: 600 }}>{u.to_stage || '—'}</span>
                    </div>
                    {u.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>{u.notes}</div>}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>por {u.changed_by_name || 'Sistema'}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{selectedBrand.marca}</div>
              {profile?.role === 'admin' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { setRenameName(selectedBrand.marca); setRenameModal(true); }} title="Renomear" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>Renomear</button>
                  <button onClick={() => { setMergeSearch(''); setMergeTarget(null); setMergeName(''); setMergeModal(true); }} title="Merge" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#3b82f6', fontSize: 11, cursor: 'pointer' }}>Merge</button>
                  <button onClick={deleteBrand} title="Excluir" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>Excluir</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {selectedBrand.classificacao && <span style={{ fontSize: 11, background: (CLASSIFICACAO_COLORS[selectedBrand.classificacao] || '#94a3b8') + '20', color: CLASSIFICACAO_COLORS[selectedBrand.classificacao], padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{selectedBrand.classificacao}</span>}
              {selectedBrand.estado && <span style={{ fontSize: 11, background: '#dbeafe', color: '#2563eb', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{selectedBrand.estado}</span>}
            </div>
            {(selectedBrand.executivo_delivery || selectedBrand.coordenador_delivery || selectedBrand.chave_agrupamento_name) && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                {selectedBrand.executivo_delivery && <div>Exec. Delivery: <span style={{ color: '#64748b', fontWeight: 500 }}>{selectedBrand.executivo_delivery}</span></div>}
                {selectedBrand.coordenador_delivery && <div>Coord. Delivery: <span style={{ color: '#64748b', fontWeight: 500 }}>{selectedBrand.coordenador_delivery}</span></div>}
                {selectedBrand.chave_agrupamento_name && <div>Chave Agrupamento: <span style={{ color: '#64748b', fontWeight: 500 }}>{selectedBrand.chave_agrupamento_name}</span></div>}
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
            {/* INFO TAB */}
            {detailTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Time Carteira</span>
                  <select value={editTimeCarteira} onChange={e => { setEditTimeCarteira(e.target.value); setInfoChanged(true); }} disabled={!canEdit} style={{ width: 160, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'right', outline: 'none', opacity: canEdit ? 1 : 0.6 }}>
                    <option value="">—</option>
                    <option value="KA">KA</option>
                    <option value="CE">CE</option>
                    <option value="Não encarteirado">Não encarteirado</option>
                  </select>
                </div>
                {/* Comer Fora Details */}
                {selectedBrand?.pipelines?.comer_fora && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9C050B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Comer Fora</div>

                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Estratégia</span>
                      <select disabled={!canEdit} value={cfDetails.estrategia || ''} onChange={e => { setCfDetails(p => ({...p, estrategia: e.target.value})); setCfChanged(true); }}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', outline: 'none', opacity: canEdit ? 1 : 0.6 }}>
                        <option value="">—</option>
                        <option>Hunter</option><option>Hunter CRM Food</option><option>Saipos</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Solução</span>
                      <input disabled={!canEdit} value={cfDetails.solucao || ''} onChange={e => { setCfDetails(p => ({...p, solucao: e.target.value})); setCfChanged(true); }}
                        placeholder="—" style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', opacity: canEdit ? 1 : 0.6 }} />
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Provider</span>
                      <input disabled={!canEdit} value={cfDetails.provider || ''} onChange={e => { setCfDetails(p => ({...p, provider: e.target.value})); setCfChanged(true); }}
                        placeholder="—" style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', opacity: canEdit ? 1 : 0.6 }} />
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Cidade</span>
                      <input disabled={!canEdit} value={cfDetails.cidade || ''} onChange={e => { setCfDetails(p => ({...p, cidade: e.target.value})); setCfChanged(true); }}
                        placeholder="—" style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', opacity: canEdit ? 1 : 0.6 }} />
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Feedback cliente</span>
                      <textarea disabled={!canEdit} value={cfDetails.feedback_cliente || ''} onChange={e => { setCfDetails(p => ({...p, feedback_cliente: e.target.value})); setCfChanged(true); }}
                        rows={2} placeholder="—" style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', opacity: canEdit ? 1 : 0.6 }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12 }}>Trade</span>
                      <button disabled={!canEdit} onClick={() => { if (canEdit) { setCfDetails(p => ({...p, trade: !p.trade})); setCfChanged(true); } }}
                        style={{ padding: '4px 14px', borderRadius: 20, border: cfDetails.trade ? '2px solid #9C050B' : '1px solid #e2e8f0', background: cfDetails.trade ? '#fff0f0' : '#fff', color: cfDetails.trade ? '#9C050B' : '#64748b', fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }}>
                        {cfDetails.trade ? 'Sim' : 'Não'}
                      </button>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Prioridade</span>
                      <select disabled={!canEdit} value={cfDetails.prioridade != null ? String(cfDetails.prioridade) : ''} onChange={e => { setCfDetails(p => ({...p, prioridade: e.target.value || null})); setCfChanged(true); }}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', outline: 'none', opacity: canEdit ? 1 : 0.6 }}>
                        <option value="">—</option>
                        <option value="1">1 — Alta</option><option value="2">2 — Média</option><option value="3">3 — Baixa</option>
                      </select>
                    </div>

                  {/* Qualificação da Reunião */}
                  {cfDetails.possui_fidelizacao !== undefined && (
                    <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: 0, marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#334155' }}>Qualificação da Reunião</h4>
                      
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                        <strong>Possui fidelização:</strong> {cfDetails.possui_fidelizacao ? 'Sim' : 'Não'}
                        {cfDetails.mecanica_fidelizacao && <div style={{ marginLeft: 12, marginTop: 4, fontStyle: 'italic' }}>{cfDetails.mecanica_fidelizacao}</div>}
                      </div>
                      
                      {cfDetails.experiencia_salao?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          <strong>Experiência no salão:</strong> {cfDetails.experiencia_salao.join(', ')}
                        </div>
                      )}
                      
                      {cfDetails.objetivos?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          <strong>Objetivos:</strong> {cfDetails.objetivos.join(', ')}
                        </div>
                      )}
                      
                      {cfDetails.mecanicas_interesse?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          <strong>Mecânicas de interesse:</strong> {cfDetails.mecanicas_interesse.join(', ')}
                          {cfDetails.mecanica_outro_detalhe && <div style={{ marginLeft: 12, marginTop: 4, fontStyle: 'italic' }}>{cfDetails.mecanica_outro_detalhe}</div>}
                        </div>
                      )}
                      
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <strong>Solicitou dados:</strong> {cfDetails.solicitou_dados ? 'Sim' : 'Não'}
                        {cfDetails.dados_solicitados && <div style={{ marginLeft: 12, marginTop: 4 }}><strong>Dados:</strong> {cfDetails.dados_solicitados}</div>}
                        {cfDetails.uso_dados && <div style={{ marginLeft: 12, marginTop: 4 }}><strong>Uso:</strong> {cfDetails.uso_dados}</div>}
                      </div>
                    </div>
                  )}

                    {canEdit && cfChanged && (
                      <button onClick={async () => {
                        await apiFetch('/api/comer-fora', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ brand_id: selectedBrand.id, ...cfDetails }) });
                        setCfChanged(false);
                        const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
                        const freshData = await freshRes.json();
                        if (freshData.brands) { setBrands(freshData.brands); const updated = freshData.brands.find(b => b.id === selectedBrand.id); if (updated) { setSelectedBrand(updated); setCfDetails(updated.comer_fora_details || {}); } }
                      }} style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#9C050B', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                        Salvar Comer Fora
                      </button>
                    )}
                  </div>
                )}
                                {/* Base Totem (origem: Hunting VS, Inbound VS, etc.) */}
                {selectedBrand?.pipelines?.totem && canEdit && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: 6 }}>Base Totem (origem)</span>
                    <select
                      value={selectedBrand.base_totem || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        await apiFetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedBrand.id, base_totem: val }) });
                        setSelectedBrand(prev => ({ ...prev, base_totem: val }));
                        setBrands(prev => prev.map(b => b.id === selectedBrand.id ? { ...b, base_totem: val } : b));
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#1e293b', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="">Selecionar origem...</option>
                      <option value="HUNTING VS">HUNTING VS</option>
                      <option value="Farming 3S">Farming 3S</option>
                      <option value="HUNTING 3S">HUNTING 3S</option>
                      <option value="HUNTING SAIPOS">HUNTING SAIPOS</option>
                      <option value="Inbound VS">Inbound VS</option>
                    </select>
                  </div>
                )}
                {selectedBrand?.pipelines?.totem && !canEdit && selectedBrand.base_totem && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: 4, fontSize: 12 }}>Base Totem</span>
                    <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{selectedBrand.base_totem}</span>
                  </div>
                )}
                {/* Emilia Vision Details */}
                {selectedBrand?.pipelines?.emilia_vision && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fa8072', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Emilia Vision</div>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Tipo</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['Hunting', 'Farming'].map(opt => (
                          <button key={opt} disabled={!canEdit} onClick={() => { if (canEdit) { setEvDetails(p => ({...p, tipo: opt})); setEvChanged(true); } }}
                            style={{ flex: 1, padding: '6px', borderRadius: 8, border: (evDetails.tipo || 'Hunting') === opt ? '2px solid ' + (opt === 'Hunting' ? '#92400e' : '#065f46') : '1px solid #e2e8f0', background: (evDetails.tipo || 'Hunting') === opt ? (opt === 'Hunting' ? '#fef3c7' : '#d1fae5') : '#fff', color: (evDetails.tipo || 'Hunting') === opt ? (opt === 'Hunting' ? '#92400e' : '#065f46') : '#64748b', fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Sinergia</span>
                      <select disabled={!canEdit} value={evDetails.sinergia || ''} onChange={e => { setEvDetails(p => ({...p, sinergia: e.target.value})); setEvChanged(true); }}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', outline: 'none', opacity: canEdit ? 1 : 0.6 }}>
                        <option value="">—</option>
                        <option>Emilia ajudou</option><option>3S ajudou</option><option>Sinergia</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 12 }}>Base Andres</span>
                      <button disabled={!canEdit} onClick={() => { if (canEdit) { setEvDetails(p => ({...p, base_andres: !p.base_andres})); setEvChanged(true); } }}
                        style={{ padding: '4px 14px', borderRadius: 20, border: evDetails.base_andres ? '2px solid #fa8072' : '1px solid #e2e8f0', background: evDetails.base_andres ? '#fff5f5' : '#fff', color: evDetails.base_andres ? '#fa8072' : '#64748b', fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }}>
                        {evDetails.base_andres ? 'Sim' : 'Não'}
                      </button>
                    </div>
                    {canEdit && evChanged && (
                      <button onClick={async () => {
                        await apiFetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selectedBrand.id, emilia_vision_details: evDetails }) });
                        setEvChanged(false);
                        const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
                        const freshData = await freshRes.json();
                        if (freshData.brands) { setBrands(freshData.brands); const updated = freshData.brands.find(b => b.id === selectedBrand.id); if (updated) { setSelectedBrand(updated); setEvDetails(updated.emilia_vision_details || {}); } }
                      }} style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#fa8072', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                        Salvar Emilia Vision
                      </button>
                    )}
                  </div>
                )}
                {/* Novos Produtos 3S Details */}
                {selectedBrand?.pipelines?.novos_produtos_3s && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#EA1D2C', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Novos Produtos 3S</div>
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 6 }}>Add-ons</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[{key:'eats',label:'3S Eats',color:'#7c3aed'},{key:'go',label:'3S Go',color:'#2563eb'},{key:'pagamento_mesa',label:'Pagamento na Mesa',color:'#92400e'}].map(addon => (
                          <div key={addon.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: np3sDetails[addon.key] ? '#f5f3ff' : '#f8fafc', border: np3sDetails[addon.key] ? `1px solid ${addon.color}30` : '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button disabled={!canEdit} onClick={() => { if (canEdit) { setNp3sDetails(p => ({...p, [addon.key]: !p[addon.key]})); setNp3sChanged(true); } }}
                                style={{ width: 20, height: 20, borderRadius: 4, border: np3sDetails[addon.key] ? `2px solid ${addon.color}` : '1px solid #cbd5e1', background: np3sDetails[addon.key] ? addon.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }}>
                                {np3sDetails[addon.key] && <Check size={12} color="#fff" />}
                              </button>
                              <span style={{ fontSize: 12, fontWeight: 600, color: np3sDetails[addon.key] ? addon.color : '#64748b' }}>{addon.label}</span>
                            </div>
                            {np3sDetails[addon.key] && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>Mensalidade</span>
                                <button disabled={!canEdit} onClick={() => { if (canEdit) { setNp3sDetails(p => ({...p, [addon.key+'_incluso']: !p[addon.key+'_incluso']})); setNp3sChanged(true); } }}
                                  style={{ padding: '2px 10px', borderRadius: 12, border: np3sDetails[addon.key+'_incluso'] ? '2px solid #16a34a' : '1px solid #e2e8f0', background: np3sDetails[addon.key+'_incluso'] ? '#f0fdf4' : '#fff', color: np3sDetails[addon.key+'_incluso'] ? '#16a34a' : '#94a3b8', fontSize: 11, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }}>
                                  {np3sDetails[addon.key+'_incluso'] ? 'Sim' : 'Não'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {canEdit && np3sChanged && (
                      <button onClick={async () => {
                        await apiFetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selectedBrand.id, novos_produtos_3s_details: np3sDetails }) });
                        setNp3sChanged(false);
                        const freshRes = await apiFetch('/api/brands?limit=999', { cache: 'no-store' });
                        const freshData = await freshRes.json();
                        if (freshData.brands) { setBrands(freshData.brands); const updated = freshData.brands.find(b => b.id === selectedBrand.id); if (updated) { setSelectedBrand(updated); setNp3sDetails(updated.novos_produtos_3s_details || {}); } }
                      }} style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#EA1D2C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                        Salvar Novos Produtos 3S
                      </button>
                    )}
                  </div>
                )}
                {/* HAAS/SAAS multi-select */}
                <div style={{ fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: 6 }}>Produto Totem (HAAS/SAAS)</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['HAAS', 'SAAS'].map(opt => {
                      const current = (selectedBrand.produto_totem || '').split(',').map(s => s.trim()).filter(Boolean);
                      const isSelected = current.includes(opt);
                      return (
                        <button key={opt} disabled={!canEdit} onClick={async () => {
                          const cur = (selectedBrand.produto_totem || '').split(',').map(s => s.trim()).filter(Boolean);
                          const next = isSelected ? cur.filter(x => x !== opt) : [...cur, opt];
                          const val = next.join(', ') || null;
                          await apiFetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedBrand.id, produto_totem: val }) });
                          setSelectedBrand(prev => ({ ...prev, produto_totem: val }));
                          setBrands(prev => prev.map(b => b.id === selectedBrand.id ? { ...b, produto_totem: val } : b));
                        }} style={{ padding: '4px 12px', borderRadius: 20, border: isSelected ? '2px solid #a16207' : '1px solid #e2e8f0', background: isSelected ? '#fefce8' : '#fff', color: isSelected ? '#a16207' : '#64748b', fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', opacity: canEdit ? 1 : 0.6 }}>
                          {isSelected && <Check size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                    {canEdit && (
                      <button
                        onClick={() => deleteHistory(h.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d1d5db', display: 'flex', alignItems: 'center' }}
                        title="Excluir movimentação"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL: Renomear Marca */}
      {renameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Renomear Marca</div>
            <input value={renameName} onChange={e => setRenameName(e.target.value)} placeholder="Novo nome..." style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setRenameModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={renameBrand} disabled={!renameName.trim()} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: renameName.trim() ? '#EA1D2C' : '#fca5a5', color: '#fff', fontSize: 14, fontWeight: 600, cursor: renameName.trim() ? 'pointer' : 'not-allowed' }}>Renomear</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Merge */}
      {mergeModal && selectedBrand && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 520, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Merge de Marcas</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Transferir pipelines e historico de <strong>{selectedBrand.marca}</strong> para outra marca</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Buscar marca destino:</label>
              <input value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} placeholder="Digite o nome..." style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {mergeSearch.length >= 2 && (
              <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {brands.filter(b => b.id !== selectedBrand.id && (b.marca || '').toLowerCase().includes(mergeSearch.toLowerCase())).slice(0, 10).map(b => (
                  <button key={b.id} onClick={() => { setMergeTarget(b); setMergeName(b.marca); }} style={{ padding: '8px 12px', borderRadius: 8, border: mergeTarget?.id === b.id ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: mergeTarget?.id === b.id ? '#eff6ff' : '#fff', color: '#1e293b', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    {b.marca} <span style={{ color: '#94a3b8', fontSize: 11 }}>({b.classificacao || '-'} | {b.estado || '-'})</span>
                  </button>
                ))}
              </div>
            )}
            {mergeTarget && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nome final (opcional):</label>
                <input value={mergeName} onChange={e => setMergeName(e.target.value)} placeholder={mergeTarget.marca} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setMergeModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={mergeBrands} disabled={!mergeTarget} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: mergeTarget ? '#3b82f6' : '#93c5fd', color: '#fff', fontSize: 14, fontWeight: 600, cursor: mergeTarget ? 'pointer' : 'not-allowed' }}>Fazer Merge</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Motivo Perda/Stand By */}
      {lossModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
              {lossModal.newStage.startsWith('10.') ? 'Motivo da Perda' : 'Motivo do Stand By'}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Selecione o motivo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {LOSS_REASONS.map(reason => (
                <button key={reason} onClick={() => setLossReason(reason)} style={{ padding: '10px 16px', borderRadius: 10, border: lossReason === reason ? '2px solid #EA1D2C' : '1px solid #e2e8f0', background: lossReason === reason ? '#fef2f2' : '#fff', color: lossReason === reason ? '#EA1D2C' : '#1e293b', fontSize: 13, fontWeight: lossReason === reason ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
                  {reason}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setLossModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmLossReason} disabled={!lossReason} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: lossReason ? '#EA1D2C' : '#fca5a5', color: '#fff', fontSize: 14, fontWeight: 600, cursor: lossReason ? 'pointer' : 'not-allowed' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de qualificação Comer Fora */}
      {cfQualifModal && (
        <div onClick={() => setCfQualifModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '32px', maxWidth: 650, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: 0, marginBottom: 24, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Qualificação da Reunião - Comer Fora</h2>
            
            {/* Pergunta 1: Fidelização */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                1. Atualmente a marca já possui algum programa de fidelização?
              </label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <button onClick={() => setCfQualifData(p => ({ ...p, possui_fidelizacao: true }))} 
                  style={{ flex: 1, padding: '8px 16px', border: cfQualifData.possui_fidelizacao ? '2px solid #9C050B' : '1px solid #cbd5e1', background: cfQualifData.possui_fidelizacao ? '#fff0f0' : '#fff', color: cfQualifData.possui_fidelizacao ? '#9C050B' : '#64748b', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Sim
                </button>
                <button onClick={() => setCfQualifData(p => ({ ...p, possui_fidelizacao: false, mecanica_fidelizacao: '' }))} 
                  style={{ flex: 1, padding: '8px 16px', border: !cfQualifData.possui_fidelizacao ? '2px solid #9C050B' : '1px solid #cbd5e1', background: !cfQualifData.possui_fidelizacao ? '#fff0f0' : '#fff', color: !cfQualifData.possui_fidelizacao ? '#9C050B' : '#64748b', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Não
                </button>
              </div>
              {cfQualifData.possui_fidelizacao && (
                <textarea placeholder="Como funciona? Qual mecânica utiliza?" value={cfQualifData.mecanica_fidelizacao} onChange={e => setCfQualifData(p => ({ ...p, mecanica_fidelizacao: e.target.value }))} 
                  style={{ width: '100%', minHeight: 80, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
              )}
            </div>

            {/* Pergunta 2: Experiência no salão */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                2. Como é a experiência no salão? (pode selecionar múltiplas)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { val: 'totem', label: 'Auto-atendimento no totem' },
                  { val: 'tablet', label: 'Tablet na mesa' },
                  { val: 'garcom_mesa', label: 'Pedido com garçom na mesa' },
                  { val: 'caixa', label: 'Pedido no caixa com atendente' }
                ].map(opt => (
                  <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: 8, borderRadius: 6, background: cfQualifData.experiencia_salao.includes(opt.val) ? '#f0fdf4' : 'transparent' }}>
                    <input type="checkbox" checked={cfQualifData.experiencia_salao.includes(opt.val)} onChange={e => {
                      setCfQualifData(p => ({ ...p, experiencia_salao: e.target.checked ? [...p.experiencia_salao, opt.val] : p.experiencia_salao.filter(x => x !== opt.val) }));
                    }} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, color: '#334155' }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 3: Objetivos */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                3. Qual o principal objetivo do parceiro em relação ao Comer Fora? (pode selecionar múltiplas)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { val: 'aquisicao', label: 'Aquisição' },
                  { val: 'identificacao', label: 'Identificação' },
                  { val: 'recorrencia', label: 'Recorrência' },
                  { val: 'avaliacao', label: 'Avaliação' }
                ].map(opt => (
                  <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: 8, borderRadius: 6, background: cfQualifData.objetivos.includes(opt.val) ? '#f0fdf4' : 'transparent' }}>
                    <input type="checkbox" checked={cfQualifData.objetivos.includes(opt.val)} onChange={e => {
                      setCfQualifData(p => ({ ...p, objetivos: e.target.checked ? [...p.objetivos, opt.val] : p.objetivos.filter(x => x !== opt.val) }));
                    }} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, color: '#334155' }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 4: Mecânicas */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                4. Quais as principais mecânicas que o parceiro se interessou? (pode selecionar múltiplas)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { val: 'cupom_valor', label: 'Cupom de valor' },
                  { val: 'cashback', label: 'Cashback' },
                  { val: 'dois_por_um', label: '2x1' },
                  { val: 'desconto_item', label: 'Desconto em item' },
                  { val: 'compre_ganhe', label: 'Compre e ganhe' },
                  { val: 'outro', label: 'Outro' }
                ].map(opt => (
                  <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: 8, borderRadius: 6, background: cfQualifData.mecanicas_interesse.includes(opt.val) ? '#f0fdf4' : 'transparent' }}>
                    <input type="checkbox" checked={cfQualifData.mecanicas_interesse.includes(opt.val)} onChange={e => {
                      setCfQualifData(p => ({ ...p, mecanicas_interesse: e.target.checked ? [...p.mecanicas_interesse, opt.val] : p.mecanicas_interesse.filter(x => x !== opt.val) }));
                    }} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, color: '#334155' }}>{opt.label}</span>
                  </label>
                ))}
              </div>
              {cfQualifData.mecanicas_interesse.includes('outro') && (
                <textarea placeholder="Detalhe a mecânica..." value={cfQualifData.mecanica_outro_detalhe} onChange={e => setCfQualifData(p => ({ ...p, mecanica_outro_detalhe: e.target.value }))} 
                  style={{ width: '100%', minHeight: 60, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', marginTop: 8 }} />
              )}
            </div>

            {/* Pergunta 5: Dados */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                5. Parceiro solicitou acesso aos dados?
              </label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <button onClick={() => setCfQualifData(p => ({ ...p, solicitou_dados: true }))} 
                  style={{ flex: 1, padding: '8px 16px', border: cfQualifData.solicitou_dados ? '2px solid #9C050B' : '1px solid #cbd5e1', background: cfQualifData.solicitou_dados ? '#fff0f0' : '#fff', color: cfQualifData.solicitou_dados ? '#9C050B' : '#64748b', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Sim
                </button>
                <button onClick={() => setCfQualifData(p => ({ ...p, solicitou_dados: false, dados_solicitados: '', uso_dados: '' }))} 
                  style={{ flex: 1, padding: '8px 16px', border: !cfQualifData.solicitou_dados ? '2px solid #9C050B' : '1px solid #cbd5e1', background: !cfQualifData.solicitou_dados ? '#fff0f0' : '#fff', color: !cfQualifData.solicitou_dados ? '#9C050B' : '#64748b', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Não
                </button>
              </div>
              {cfQualifData.solicitou_dados && (<>
                <textarea placeholder="Quais dados foram solicitados?" value={cfQualifData.dados_solicitados} onChange={e => setCfQualifData(p => ({ ...p, dados_solicitados: e.target.value }))} 
                  style={{ width: '100%', minHeight: 60, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }} />
                <textarea placeholder="Como pretende usar esses dados?" value={cfQualifData.uso_dados} onChange={e => setCfQualifData(p => ({ ...p, uso_dados: e.target.value }))} 
                  style={{ width: '100%', minHeight: 60, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
              </>)}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setCfQualifModal(null)} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmCfQualif} disabled={saving} style={{ padding: '10px 20px', border: 'none', background: '#9C050B', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar e Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
