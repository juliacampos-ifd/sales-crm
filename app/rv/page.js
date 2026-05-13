'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Target, ArrowLeft, Send, Check, X, Clock, TrendingUp, Settings, FileText, ChevronDown, Award, AlertCircle, ExternalLink } from 'lucide-react';

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const EXEC_OPTIONS = ['Joao','Lidia','Diego','Gabi','Marcos','Lucas'];
const ROLE_OPTIONS = [
  { value: 'bdr', label: 'BDR (3S)' },
  { value: 'closer', label: 'Closer (3S)' },
  { value: 'coord_3s', label: 'Coordenador 3S' },
  { value: 'saipos_totem', label: 'Saipos / Totem' },
];

export default function RVPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  // Dashboard
  const [dashData, setDashData] = useState(null);
  // Evidencias
  const [evidencias, setEvidencias] = useState([]);
  const [formExec, setFormExec] = useState('');
  const [formPilar, setFormPilar] = useState('');
  const [formMarca, setFormMarca] = useState('');
  const [formData, setFormData] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  // Config
  const [configData, setConfigData] = useState([]);
  const [configExec, setConfigExec] = useState('Joao');
  const [configRole, setConfigRole] = useState('bdr');
  const [newPilar, setNewPilar] = useState('');
  const [newMeta, setNewMeta] = useState('');
  const [newPeso, setNewPeso] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id); }
      setLoading(false);
    });
  }, []);
  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      // Auto-select executivo based on profile name
      const match = EXEC_OPTIONS.find(e => data.name && data.name.toLowerCase().includes(e.toLowerCase()));
      if (match) setFormExec(match);
    }
  };
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gestor';

  // Load dashboard data
  const loadDashboard = async () => {
    const url = isAdmin ? `/api/rv/dashboard?year=${year}&month=${month}` : `/api/rv/dashboard?year=${year}&month=${month}&executivo=${formExec}`;
    const res = await fetch(url);
    const data = await res.json();
    setDashData(data);
  };
  // Load evidencias
  const loadEvidencias = async () => {
    let url = `/api/rv/evidencias?year=${year}&month=${month}`;
    if (!isAdmin && formExec) url += `&executivo=${formExec}`;
    const res = await fetch(url);
    const data = await res.json();
    setEvidencias(data.evidencias || []);
  };
  // Load config
  const loadConfig = async () => {
    const res = await fetch(`/api/rv/config?year=${year}&month=${month}`);
    const data = await res.json();
    setConfigData(data.config || []);
  };

  useEffect(() => {
    if (user && profile) {
      loadDashboard();
      loadEvidencias();
      if (isAdmin) loadConfig();
    }
  }, [user, profile, year, month]);

  // Get pilares for current executivo (from config)
  const execPilares = useMemo(() => {
    if (!formExec) return [];
    return configData.filter(c => c.executivo === formExec).map(c => c.pilar);
  }, [configData, formExec]);

  // Submit evidence
  const submitEvidence = async () => {
    if (!formExec || !formPilar || !formData) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch('/api/rv/evidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executivo: formExec, pilar: formPilar, marca: formMarca,
          data_atividade: formData, link_evidencia: formLink, descricao: formDesc,
        }),
      });
      const data = await res.json();
      if (data.error) { setSubmitMsg('Erro: ' + data.error); }
      else {
        setSubmitMsg('Evidencia enviada com sucesso!');
        setFormPilar(''); setFormMarca(''); setFormLink(''); setFormDesc('');
        loadEvidencias();
        loadDashboard();
      }
    } catch (err) { setSubmitMsg('Erro: ' + err.message); }
    setSubmitting(false);
  };

  // Approve/reject evidence
  const handleApprove = async (id, newStatus, motivo) => {
    await fetch('/api/rv/evidencias', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus, aprovado_por: profile?.name, motivo_reprovacao: motivo }),
    });
    loadEvidencias();
    loadDashboard();
  };

  // Save config entry
  const saveConfigEntry = async () => {
    if (!newPilar || !newMeta || !newPeso) return;
    setSavingConfig(true);
    await fetch('/api/rv/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year, month,
        entries: [{ executivo: configExec, role: configRole, pilar: newPilar, meta: parseInt(newMeta), peso: parseFloat(newPeso) }],
      }),
    });
    setNewPilar(''); setNewMeta(''); setNewPeso('');
    loadConfig();
    loadDashboard();
    setSavingConfig(false);
  };

  const deleteConfig = async (id) => {
    await fetch(`/api/rv/config?id=${id}`, { method: 'DELETE' });
    loadConfig();
    loadDashboard();
  };

  // Acelerador color
  const getAcelColor = (pct) => {
    if (pct >= 120) return '#22c55e';
    if (pct >= 100) return '#22c55e';
    if (pct >= 80) return '#f59e0b';
    return '#ef4444';
  };

  // ══════════ LOADING / AUTH ══════════
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#EA1D2C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <p>Voce precisa estar logado para acessar a RV.</p>
        <a href="/" style={{ color: '#EA1D2C', fontWeight: 600 }}>Ir para o CRM</a>
      </div>
    </div>
  );

  const TabBtn = ({ id, icon: Icon, label, badge }) => (
    <button onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', background: tab === id ? '#EA1D2C' : '#f1f5f9', color: tab === id ? '#fff' : '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer', position: 'relative' }}>
      <Icon size={16} /> {label}
      {badge > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>{badge}</span>}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13 }}>
            <ArrowLeft size={16} /> CRM
          </a>
          <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#EA1D2C' }}>Remuneracao Variavel</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{profile?.name}</div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ padding: '16px 28px 0', display: 'flex', gap: 8 }}>
        <TabBtn id="dashboard" icon={TrendingUp} label="Dashboard" />
        <TabBtn id="evidencia" icon={FileText} label="Enviar Evidencia" />
        {isAdmin && <TabBtn id="aprovar" icon={Check} label="Aprovar" badge={dashData?.pendingCount || 0} />}
        {isAdmin && <TabBtn id="config" icon={Settings} label="Configurar" />}
      </div>

      <div style={{ padding: '20px 28px 40px', maxWidth: 1100, margin: '0 auto' }}>
        {/* ══════════ DASHBOARD ══════════ */}
        {tab === 'dashboard' && dashData && (
          <div>
            {(dashData.dashboards || []).map(exec => (
              <div key={exec.executivo} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{exec.executivo}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{ROLE_OPTIONS.find(r => r.value === exec.role)?.label || exec.role}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Atingimento</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: getAcelColor(exec.atingimentoSemAcel) }}>{exec.atingimentoSemAcel.toFixed(1)}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>c/ Acelerador</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{exec.atingimentoComAcel.toFixed(1)}%</div>
                    </div>
                    {exec.mediaCoord !== undefined && (
                      <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: 16 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>Media Coord.</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#8b5cf6' }}>{exec.mediaCoord.toFixed(1)}%</div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ height: '100%', width: `${Math.min(exec.atingimentoSemAcel, 100)}%`, background: `linear-gradient(90deg, ${getAcelColor(exec.atingimentoSemAcel)}, ${getAcelColor(exec.atingimentoSemAcel)}aa)`, borderRadius: 99, transition: 'width .4s' }} />
                </div>
                {/* Pilares table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Pilar', 'Meta', 'Realizado', 'Peso', 'Atingimento'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exec.pilares.map(p => (
                      <tr key={p.pilar} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.pilar}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: '#64748b' }}>{p.meta}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: p.realizado >= p.meta ? '#22c55e' : '#EA1D2C' }}>{p.realizado}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: '#64748b' }}>{p.peso}%</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: getAcelColor(p.pctAtingimento), background: getAcelColor(p.pctAtingimento) + '15', padding: '2px 10px', borderRadius: 20 }}>
                            {p.pctAtingimento.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {(!dashData.dashboards || dashData.dashboards.length === 0) && (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                <TrendingUp size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p>Nenhuma configuracao de RV para {MONTH_NAMES[month-1]}/{year}</p>
                {isAdmin && <p style={{ fontSize: 13, marginTop: 8 }}>Configure os pilares e metas na aba "Configurar"</p>}
              </div>
            )}
          </div>
        )}

        {/* ══════════ ENVIAR EVIDENCIA ══════════ */}
        {tab === 'evidencia' && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 28 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>Nova Evidencia</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Executivo</label>
                  <select value={formExec} onChange={e => { setFormExec(e.target.value); setFormPilar(''); }} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }}>
                    <option value="">Selecione...</option>
                    {(isAdmin ? EXEC_OPTIONS : EXEC_OPTIONS.filter(e => profile?.name?.toLowerCase().includes(e.toLowerCase()))).map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Pilar</label>
                  <select value={formPilar} onChange={e => setFormPilar(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none' }}>
                    <option value="">Selecione o pilar...</option>
                    {execPilares.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {execPilares.length === 0 && formExec && <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Nenhum pilar configurado para {formExec} em {MONTH_NAMES[month-1]}/{year}</p>}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Marca</label>
                  <input value={formMarca} onChange={e => setFormMarca(e.target.value)} placeholder="Nome da marca" style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Data da atividade</label>
                  <input type="date" value={formData} onChange={e => setFormData(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Link da evidencia</label>
                  <input value={formLink} onChange={e => setFormLink(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Descricao (opcional)</label>
                  <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Detalhes adicionais..." rows={2} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <button onClick={submitEvidence} disabled={submitting || !formExec || !formPilar || !formData}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #EA1D2C, #DA5D69)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: submitting ? 'default' : 'pointer' }}>
                  <Send size={16} /> {submitting ? 'Enviando...' : 'Enviar Evidencia'}
                </button>
                {submitMsg && <p style={{ fontSize: 13, color: submitMsg.includes('sucesso') ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{submitMsg}</p>}
              </div>
            </div>
            {/* Recent submissions */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Minhas evidencias - {MONTH_NAMES[month-1]}/{year}</h4>
              {evidencias.filter(e => !isAdmin ? e.executivo === formExec : true).map(ev => (
                <div key={ev.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ev.status === 'aprovado' ? '#22c55e' : ev.status === 'reprovado' ? '#ef4444' : '#f59e0b' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.pilar}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{ev.marca || '—'} | {new Date(ev.data_atividade).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: ev.status === 'aprovado' ? '#dcfce7' : ev.status === 'reprovado' ? '#fef2f2' : '#fef3c7', color: ev.status === 'aprovado' ? '#15803d' : ev.status === 'reprovado' ? '#dc2626' : '#b45309' }}>
                    {ev.status === 'aprovado' ? 'Aprovado' : ev.status === 'reprovado' ? 'Reprovado' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════ APROVAR ══════════ */}
        {tab === 'aprovar' && isAdmin && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Evidencias Pendentes</h3>
            {evidencias.filter(e => e.status === 'pendente').length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <Check size={40} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p>Nenhuma evidencia pendente!</p>
              </div>
            )}
            {evidencias.filter(e => e.status === 'pendente').map(ev => (
              <div key={ev.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 20, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{ev.executivo} — {ev.pilar}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Marca: {ev.marca || '—'}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Data da atividade: {new Date(ev.data_atividade).toLocaleDateString('pt-BR')}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Enviado em: {new Date(ev.created_at).toLocaleDateString('pt-BR')}</div>
                    {ev.descricao && <div style={{ fontSize: 13, color: '#475569', marginTop: 6, background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>{ev.descricao}</div>}
                  </div>
                  {ev.link_evidencia && (
                    <a href={ev.link_evidencia} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#EA1D2C', textDecoration: 'none', fontWeight: 600, background: '#fef2f2', padding: '6px 12px', borderRadius: 8 }}>
                      <ExternalLink size={12} /> Ver evidencia
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleApprove(ev.id, 'aprovado')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <Check size={14} /> Aprovar
                  </button>
                  <button onClick={() => { const motivo = prompt('Motivo da reprovacao:'); if (motivo) handleApprove(ev.id, 'reprovado', motivo); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <X size={14} /> Reprovar
                  </button>
                </div>
              </div>
            ))}
            {/* Already reviewed */}
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 32, marginBottom: 12 }}>Ja avaliadas - {MONTH_NAMES[month-1]}/{year}</h4>
            {evidencias.filter(e => e.status !== 'pendente').map(ev => (
              <div key={ev.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 16px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.status === 'aprovado' ? '#22c55e' : '#ef4444' }} />
                <span style={{ fontWeight: 600, minWidth: 70 }}>{ev.executivo}</span>
                <span style={{ flex: 1, color: '#64748b' }}>{ev.pilar} — {ev.marca || '—'}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(ev.data_atividade).toLocaleDateString('pt-BR')}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: ev.status === 'aprovado' ? '#15803d' : '#dc2626' }}>{ev.status === 'aprovado' ? 'Aprovado' : 'Reprovado'}</span>
              </div>
            ))}
          </div>
        )}

        {/* ══════════ CONFIG ══════════ */}
        {tab === 'config' && isAdmin && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Configurar Pilares e Metas — {MONTH_NAMES[month-1]}/{year}</h3>
            {/* Add new pilar */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24, marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Adicionar Pilar</h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Executivo</label>
                  <select value={configExec} onChange={e => setConfigExec(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                    {EXEC_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Perfil</label>
                  <select value={configRole} onChange={e => setConfigRole(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Pilar</label>
                  <input value={newPilar} onChange={e => setNewPilar(e.target.value)} placeholder="Ex: Marcar e realizar demo" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 220 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Meta</label>
                  <input type="number" value={newMeta} onChange={e => setNewMeta(e.target.value)} placeholder="6" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 60 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Peso (%)</label>
                  <input type="number" value={newPeso} onChange={e => setNewPeso(e.target.value)} placeholder="70" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 60 }} />
                </div>
                <button onClick={saveConfigEntry} disabled={savingConfig} style={{ padding: '8px 16px', background: '#EA1D2C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Adicionar
                </button>
              </div>
            </div>
            {/* Current config by exec */}
            {EXEC_OPTIONS.map(exec => {
              const items = configData.filter(c => c.executivo === exec);
              if (items.length === 0) return null;
              const totalPeso = items.reduce((sum, c) => sum + parseFloat(c.peso), 0);
              return (
                <div key={exec} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{exec} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>({items[0]?.role})</span></div>
                    <div style={{ fontSize: 12, color: totalPeso === 100 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>Peso total: {totalPeso}%</div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {['Pilar', 'Meta', 'Peso', ''].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>{c.pilar}</td>
                          <td style={{ padding: '8px 10px', fontSize: 13, color: '#64748b' }}>{c.meta}</td>
                          <td style={{ padding: '8px 10px', fontSize: 13, color: '#64748b' }}>{c.peso}%</td>
                          <td style={{ padding: '8px 10px' }}>
                            <button onClick={() => deleteConfig(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
