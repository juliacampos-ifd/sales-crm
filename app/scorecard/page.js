'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { MONTH_NAMES, getMonthBusinessDays, getMonthBusinessDaysMTD } from '@/lib/constants';
import { TrendingUp, Calendar, ArrowLeft, ChevronDown } from 'lucide-react';

const DUPLA_LABELS = {
  total: 'FUNIL DE VENDA',
  lidia_gabi: 'Lidia e Gabi',
  joao_diego: 'Joao e Diego',
  michel_emerson: 'Michel e Emerson',
};

const DUPLA_COLORS = {
  total: '#EA1D2C',
  lidia_gabi: '#DA5D69',
  joao_diego: '#9C050B',
  michel_emerson: '#A02331',
};

const FUNNEL_ROWS = [
  { key: 'elegiveis', label: 'MARCAS ELEGIVEIS', isBold: true, isLive: true },
  { key: 'taxa_pc', label: 'Taxa Conversao - PRIMEIRO CONTATO', isPercent: true },
  { key: 'primeiro_contato', label: 'PRIMEIRO CONTATO', isBold: true },
  { key: 'taxa_apres', label: 'Taxa Conversao - APRESENTACAO', isPercent: true },
  { key: 'apresentacao', label: 'APRESENTACAO', isBold: true },
  { key: 'taxa_neg', label: 'Taxa Conversao - NEGOCIACAO', isPercent: true },
  { key: 'negociacao', label: 'NEGOCIACAO', isBold: true },
  { key: 'taxa_fechadas', label: 'Taxa Conversao - MARCAS FECHADAS', isPercent: true },
  { key: 'fechadas', label: 'MARCAS FECHADAS', isBold: true },
  { key: 'media_lojas', label: 'Media de lojas por marca', isLive: true },
  { key: 'lojas', label: 'Lojas Fechadas', isBold: true },
];

function pctColor(pct) {
  if (!pct || pct === '—') return '#94a3b8';
  const n = parseInt(pct);
  if (n >= 100) return '#22c55e';
  if (n >= 70) return '#f59e0b';
  return '#ef4444';
}

export default function ScorecardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [openDupla, setOpenDupla] = useState('total');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/scorecard?month=${selMonth}&year=${selYear}`)
      .then(r => r.json()).then(d => setData(d)).catch(console.error);
  }, [user, selMonth, selYear]);

  const today = new Date();
  const totalBD = getMonthBusinessDays(selYear, selMonth - 1);
  const mtdBD = selYear === today.getFullYear() && selMonth === today.getMonth() + 1
    ? getMonthBusinessDaysMTD(selYear, selMonth - 1, today) : totalBD;

  const monthCols = useMemo(() => {
    const cols = [];
    for (let y = 2026; y <= selYear; y++) {
      const mMax = y === selYear ? selMonth : 12;
      for (let m = 1; m <= mMax; m++) cols.push({ y, m, k: `${y}-${String(m).padStart(2,'0')}` });
    }
    return cols;
  }, [selMonth, selYear]);

  const curKey = `${selYear}-${String(selMonth).padStart(2,'0')}`;

  // Get meta value for dupla/year/month/field
  const gm = (dupla, y, m, f) => {
    if (!data?.metas) return 0;
    const x = data.metas.find(r => r.dupla === dupla && r.year === y && r.month === m);
    return x ? (x[f] || 0) : 0;
  };

  // Get realized value
  const gr = (dupla, ym, f) => data?.realized?.[ym]?.[dupla]?.[f] || 0;

  // Get live eligible count
  const ge = (dupla) => data?.elegiveis?.[dupla] || 0;

  const buildRows = (dupla) => {
    const cmR = {}, cmM = {}, fcst = {}, mtdM = {};
    ['primeiro_contato','apresentacao','negociacao','fechadas','lojas'].forEach(f => {
      cmR[f] = gr(dupla, curKey, f);
      cmM[f] = gm(dupla, selYear, selMonth, f);
      fcst[f] = mtdBD > 0 ? Math.round((cmR[f] / mtdBD) * totalBD) : 0;
      mtdM[f] = totalBD > 0 ? Math.round((cmM[f] / totalBD) * mtdBD) : 0;
    });
    const eleg = ge(dupla);
    const elegMeta = gm(dupla, selYear, selMonth, 'elegiveis');

    return FUNNEL_ROWS.map(def => {
      const row = { ...def, cells: [] };

      monthCols.forEach(col => {
        const isCur = col.y === selYear && col.m === selMonth;

        if (def.key === 'elegiveis') {
          if (isCur) {
            // Current month: show meta, forecast=meta, real=live count, mtd meta=mtd real=live
            row.cells.push({
              isCur: true,
              meta: elegMeta,
              fcst: eleg,
              pctA: elegMeta > 0 ? Math.round((eleg / elegMeta) * 100) + '%' : '—',
              real: eleg,
              mtdMeta: eleg,
              mtdReal: eleg,
              mtdPct: '100%',
            });
          } else {
            // Past months: show meta as the realized value (we don't have historical snapshots)
            row.cells.push({ v: gm(dupla, col.y, col.m, 'elegiveis') });
          }
        } else if (def.key === 'media_lojas') {
          const fch = isCur ? cmR.fechadas : gr(dupla, col.k, 'fechadas');
          const loj = isCur ? cmR.lojas : gr(dupla, col.k, 'lojas');
          const v = fch > 0 ? Math.round(loj / fch) : 0;
          if (isCur) {
            const metaML = gm(dupla, selYear, selMonth, 'media_lojas');
            row.cells.push({ isCur: true, meta: metaML, fcst: v, pctA: metaML > 0 ? Math.round((v/metaML)*100)+'%' : '—', real: v, mtdMeta: v, mtdReal: v, mtdPct: '—', isLive: true });
          } else {
            row.cells.push({ v });
          }
        } else if (def.isPercent) {
          let num = 0, den = 1;
          const gv = (field) => isCur ? cmR[field] : gr(dupla, col.k, field);
          if (def.key === 'taxa_pc') { num = gv('primeiro_contato'); den = isCur ? eleg : gm(dupla, col.y, col.m, 'elegiveis'); }
          else if (def.key === 'taxa_apres') { num = gv('apresentacao'); den = gv('primeiro_contato'); }
          else if (def.key === 'taxa_neg') { num = gv('negociacao'); den = gv('apresentacao'); }
          else if (def.key === 'taxa_fechadas') { num = gv('fechadas'); den = gv('negociacao'); }
          const pct = den > 0 ? Math.round((num / den) * 100) + '%' : '0%';
          row.cells.push(isCur ? { isCur: true, span: true, v: pct } : { v: pct });
        } else {
          // Regular metric (primeiro_contato, apresentacao, negociacao, fechadas, lojas)
          const f = def.key;
          if (isCur) {
            const pctA = cmM[f] > 0 ? Math.round((fcst[f] / cmM[f]) * 100) + '%' : '—';
            const pctMtd = mtdM[f] > 0 ? Math.round((cmR[f] / mtdM[f]) * 100) + '%' : '—';
            row.cells.push({ isCur: true, meta: cmM[f], fcst: fcst[f], pctA, real: cmR[f], mtdMeta: mtdM[f], mtdReal: cmR[f], mtdPct: pctMtd });
          } else {
            row.cells.push({ v: gr(dupla, col.k, f) });
          }
        }
      });
      return row;
    });
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#64748b' }}>Carregando...</p></div>;
  if (!user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}><p>Faca login primeiro</p><a href="/" style={{ color: '#EA1D2C' }}>Login</a></div>;

  const pastCols = monthCols.filter(c => !(c.y === selYear && c.m === selMonth));
  const hasCur = monthCols.some(c => c.y === selYear && c.m === selMonth);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13 }}><ArrowLeft size={16} /> CRM</a>
          <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={18} color="#fff" /></div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#EA1D2C' }}>Scorecard</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Marcas P e M</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={14} color="#64748b" />
          <select value={selMonth} onChange={e => setSelMonth(+e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600 }}>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(+e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600 }}>
            <option value={2026}>2026</option><option value={2027}>2027</option>
          </select>
          <div style={{ background: '#fef2f2', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#EA1D2C', fontWeight: 600 }}>{mtdBD}/{totalBD} dias uteis</div>
        </div>
      </div>

      <div style={{ padding: '20px 28px 40px' }}>
        {['total','lidia_gabi','joao_diego','michel_emerson'].map(dupla => {
          const rows = buildRows(dupla);
          const open = openDupla === dupla;
          const clr = DUPLA_COLORS[dupla];
          return (
            <div key={dupla} style={{ marginBottom: 16, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div onClick={() => setOpenDupla(open ? null : dupla)} style={{ padding: '14px 20px', background: clr + '08', borderBottom: open ? `2px solid ${clr}` : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: clr }} />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{DUPLA_LABELS[dupla]}</span>
                  {dupla !== 'total' && <span style={{ fontSize: 12, color: '#94a3b8' }}>({ge(dupla)} elegiveis)</span>}
                </div>
                <ChevronDown size={18} color="#94a3b8" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
              </div>
              {open && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ ...th, width: 250, textAlign: 'left', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 2 }}></th>
                        {pastCols.map(c => <th key={c.k} style={{ ...th, fontSize: 10 }}>{MONTH_NAMES[c.m-1]} Real</th>)}
                        {hasCur && <>
                          <th style={{ ...th, background: '#fef2f2', fontSize: 10 }}>{MONTH_NAMES[selMonth-1]} Meta</th>
                          <th style={{ ...th, background: '#fef2f2', fontSize: 10 }}>Fcst</th>
                          <th style={{ ...th, background: '#fef2f2', fontSize: 10 }}>% Atig</th>
                          <th style={{ ...th, background: '#fce4e6', fontSize: 10, color: '#EA1D2C' }}>Real</th>
                          <th style={{ ...th, background: '#fefce8', fontSize: 10 }}>MTD Meta</th>
                          <th style={{ ...th, background: '#fefce8', fontSize: 10 }}>MTD Real</th>
                          <th style={{ ...th, background: '#fef9c3', fontSize: 10 }}>MTD %</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={ri} style={{ background: row.isBold ? '#fffbfb' : '#fff' }}>
                          <td style={{ ...td, fontWeight: row.isBold ? 700 : 400, fontSize: row.isPercent ? 11 : 12, color: row.isPercent ? '#94a3b8' : '#1e293b', position: 'sticky', left: 0, background: row.isBold ? '#fffbfb' : '#fff', zIndex: 1 }}>{row.label}</td>
                          {row.cells.map((cell, ci) => {
                            if (!cell.isCur) {
                              return <td key={ci} style={{ ...td, textAlign: 'center', fontWeight: row.isBold ? 600 : 400, color: row.isPercent ? '#94a3b8' : '#475569' }}>{cell.v}</td>;
                            }
                            if (cell.span) {
                              return <td key={ci} colSpan={7} style={{ ...td, textAlign: 'center', fontWeight: 600, color: '#94a3b8' }}>{cell.v}</td>;
                            }
                            return [
                              <td key={ci+'m'} style={{ ...td, textAlign: 'center', background: '#fef2f208' }}>{cell.meta}</td>,
                              <td key={ci+'f'} style={{ ...td, textAlign: 'center', fontWeight: 600, background: '#fef2f208' }}>{cell.fcst}</td>,
                              <td key={ci+'p'} style={{ ...td, textAlign: 'center', fontWeight: 600, color: pctColor(cell.pctA), background: '#fef2f208' }}>{cell.pctA}</td>,
                              <td key={ci+'r'} style={{ ...td, textAlign: 'center', fontWeight: 700, color: clr, background: '#fce4e608' }}>{cell.real}</td>,
                              <td key={ci+'mm'} style={{ ...td, textAlign: 'center', background: '#fefce808' }}>{cell.mtdMeta}</td>,
                              <td key={ci+'mr'} style={{ ...td, textAlign: 'center', fontWeight: 700, color: clr, background: '#fefce808' }}>{cell.mtdReal}</td>,
                              <td key={ci+'mp'} style={{ ...td, textAlign: 'center', fontWeight: 600, color: pctColor(cell.mtdPct), background: '#fef9c308' }}>{cell.mtdPct}</td>,
                            ];
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const th = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'center', whiteSpace: 'nowrap' };
const td = { padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' };
