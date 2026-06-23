'use client';
import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// ⚠️ Após publicar o Google Apps Script, substitua a URL abaixo:
const GAS_URL = 'https://script.google.com/a/macros/ifood.com.br/s/AKfycbxFKSeRcz-noPEYQxW75VAWAcTp2F93h5KnyZgT9UJTjs3YvuiKGtGRsH6DmeUhwRn-RA/exec';

const COLORS = ['#EA1D2C', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#64748b'];

const MES_ORDER = ['janeiro-26','fevereiro-26','março-26','abril-26','maio-26','junho-26','julho-26','agosto-26','setembro-26','outubro-26','novembro-26','dezembro-26','janeiro-27','fevereiro-27','março-27'];
const MES_LABEL = { 'janeiro-26':'Jan/26','fevereiro-26':'Fev/26','março-26':'Mar/26','abril-26':'Abr/26','maio-26':'Mai/26','junho-26':'Jun/26','julho-26':'Jul/26','agosto-26':'Ago/26','setembro-26':'Set/26','outubro-26':'Out/26','novembro-26':'Nov/26','dezembro-26':'Dez/26','janeiro-27':'Jan/27','fevereiro-27':'Fev/27','março-27':'Mar/27' };

export default function ImplantacaoPage() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMes, setFilterMes] = useState('');
  const [filterEtapa, setFilterEtapa] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (!GAS_URL || GAS_URL === 'COLE_AQUI_A_URL_DO_APPS_SCRIPT') {
      setError('URL do Apps Script não configurada. Edite app/implantacao/page.js e substitua GAS_URL.');
      setLoading(false);
      return;
    }
    fetch(GAS_URL)
      .then(r => r.json())
      .then(d => { setRawData(d.data || []); setLoading(false); })
      .catch(err => { setError('Erro ao carregar dados: ' + err.message); setLoading(false); });
  }, []);

  // Filtered data
  const data = useMemo(() => {
    let d = rawData;
    if (filterMes) d = d.filter(r => (r['Mês go-live'] || '').toLowerCase() === filterMes.toLowerCase());
    if (filterEtapa) d = d.filter(r => (r['Etapa projeto'] || '') === filterEtapa);
    if (filterStatus) d = d.filter(r => (r['Status'] || '') === filterStatus);
    return d;
  }, [rawData, filterMes, filterEtapa, filterStatus]);

  // Options for filters
  const meses = useMemo(() => [...new Set(rawData.map(r => r['Mês go-live']).filter(Boolean))].sort((a,b) => {
    const ai = MES_ORDER.indexOf(a.toLowerCase()), bi = MES_ORDER.indexOf(b.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  }), [rawData]);
  const etapas = useMemo(() => [...new Set(rawData.map(r => r['Etapa projeto']).filter(Boolean))].sort(), [rawData]);
  const statuses = useMemo(() => [...new Set(rawData.map(r => r['Status']).filter(Boolean))].sort(), [rawData]);

  // Chart 1: Distribuição mensal
  const chartMensal = useMemo(() => {
    const counts = {};
    data.forEach(r => {
      const m = (r['Mês go-live'] || 'Sem data').toLowerCase();
      counts[m] = (counts[m] || 0) + 1;
    });
    return MES_ORDER.filter(m => counts[m]).map(m => ({ mes: MES_LABEL[m] || m, total: counts[m] }))
      .concat(Object.entries(counts).filter(([m]) => !MES_ORDER.includes(m)).map(([m, total]) => ({ mes: m, total })));
  }, [data]);

  // Chart 2: Por etapa do projeto
  const chartEtapa = useMemo(() => {
    const counts = {};
    data.forEach(r => { const e = r['Etapa projeto'] || 'Não informado'; counts[e] = (counts[e] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [data]);

  // Chart 3: Top 10 marcas
  const chartMarcas = useMemo(() => {
    const counts = {};
    data.forEach(r => { const m = r['Marca'] || 'Sem marca'; counts[m] = (counts[m] || 0) + 1; });
    return Object.entries(counts).map(([marca, total]) => ({ marca, total })).sort((a,b) => b.total - a.total).slice(0, 10);
  }, [data]);

  // KPIs
  const totalImplant = data.length;
  const ativadas = data.filter(r => (r['Status'] || '').toLowerCase().includes('ativad')).length;
  const executivos = [...new Set(data.map(r => r['Executivo responsável']).filter(Boolean))].length;

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#EA1D2C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#64748b', fontSize: 13 }}>Carregando dados de implantação...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Voltar ao CRM
        </a>
        <div style={{ height: 20, width: 1, background: '#e2e8f0' }} />
        <Package size={18} color="#EA1D2C" />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Implantações 3S</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{totalImplant} registros</span>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px' }}>

        {/* Error state */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 20, marginBottom: 24, color: '#991b1b', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Filtros */}
        {!error && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Filtros:</span>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#334155', outline: 'none' }}>
              <option value="">Todos os meses</option>
              {meses.map(m => <option key={m} value={m}>{MES_LABEL[m.toLowerCase()] || m}</option>)}
            </select>
            <select value={filterEtapa} onChange={e => setFilterEtapa(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#334155', outline: 'none' }}>
              <option value="">Todas as etapas</option>
              {etapas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#334155', outline: 'none' }}>
              <option value="">Todos os status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(filterMes || filterEtapa || filterStatus) && (
              <button onClick={() => { setFilterMes(''); setFilterEtapa(''); setFilterStatus(''); }} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#64748b', background: '#f8fafc', cursor: 'pointer' }}>
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* KPIs */}
        {!error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total implantações', value: totalImplant, color: '#EA1D2C' },
              { label: 'Ativadas', value: ativadas, color: '#22c55e' },
              { label: 'Executivos envolvidos', value: executivos, color: '#3b82f6' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Gráficos */}
        {!error && data.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

            {/* Chart 1: Mensal */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, gridColumn: '1 / -1' }}>
              <h3 style={{ margin: 0, marginBottom: 20, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Distribuição Mensal (go-live)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartMensal} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  <Bar dataKey="total" fill="#EA1D2C" radius={[4,4,0,0]} name="Implantações" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Por etapa */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
              <h3 style={{ margin: 0, marginBottom: 20, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Por Etapa do Projeto</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={chartEtapa} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {chartEtapa.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v, n) => [v, n]} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Top 10 marcas */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
              <h3 style={{ margin: 0, marginBottom: 20, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Top 10 Marcas</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartMarcas} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="marca" tick={{ fontSize: 11, fill: '#64748b' }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0,4,4,0]} name="Implantações" />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        )}

        {!error && data.length === 0 && !loading && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 40, textAlign: 'center', color: '#64748b' }}>
            Nenhum dado encontrado para os filtros selecionados.
          </div>
        )}
      </div>
    </div>
  );
}
