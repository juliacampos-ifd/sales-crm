'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PRODUCTS } from '@/lib/constants';
import { ArrowLeft, Check, Plus, Target } from 'lucide-react';

// Field and SelectField OUTSIDE the component to prevent re-creation on each render
const Field = ({ label, value, onChange, placeholder, type }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{label}</label>
    <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff' }} />
  </div>
);

const SelectField = ({ label, value, onChange, options, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff', color: value ? '#1e293b' : '#94a3b8' }}>
      <option value="">{placeholder || 'Selecione...'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const UF = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function InputPage() {
  const [marca, setMarca] = useState('');
  const [qtdLojas, setQtdLojas] = useState('');
  const [topKa, setTopKa] = useState('');
  const [noBP, setNoBP] = useState('');
  const [pdv, setPdv] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [estado, setEstado] = useState('');
  const [activeProducts, setActiveProducts] = useState(['3s']);
  const [responsaveis, setResponsaveis] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const toggleProduct = (pk) => {
    setActiveProducts(prev => prev.includes(pk) ? prev.filter(p => p !== pk) : [...prev, pk]);
  };

  const handleSubmit = async () => {
    if (!marca.trim()) { setError('Nome da marca e obrigatorio'); return; }
    if (activeProducts.length === 0) { setError('Selecione pelo menos um produto'); return; }
    setSaving(true);
    setError('');
    setSuccess('');

        try {
      const { data: { session } } = await supabase.auth.getSession();

      const resp3s = responsaveis['3s'] || '';
      const parts = resp3s.split('/').map(s => s.trim());
      const bdr = parts[0] || '';
      const closer = parts[1] || '';

      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          marca: marca.trim(),
          responsavel_bdr: bdr || null,
          responsavel_closer: closer || null,
          classificacao: classificacao || null,
          qtd_lojas_fisicas: parseInt(qtdLojas) || 0,
          estado: estado || null,
          pdv_atual: pdv || null,
          marca_top_ka: topKa || null,
          marca_no_bp: noBP || null,
          base_elegivel: 'FY27',
          products: activeProducts,
        }),
      });

      const data = await res.json();
      if (data.error) { setError(data.error); setSaving(false); return; }

      const brandId = data.brand?.id;
      if (brandId) {
        for (const pk of activeProducts) {
          if (responsaveis[pk]) {
            await fetch('/api/pipelines', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ brand_id: brandId, product: pk, responsavel: responsaveis[pk] }),
            });
          }
        }
      }

      setSuccess(`Marca "${marca}" adicionada com sucesso!`);
      setMarca(''); setQtdLojas(''); setTopKa(''); setNoBP(''); setPdv('');
      setClassificacao(''); setEstado(''); setActiveProducts(['3s']); setResponsaveis({});
    } catch (err) {
      setError('Erro ao adicionar marca');
    }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 40 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13 }}><ArrowLeft size={16} /> Voltar ao CRM</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={18} color="#fff" /></div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#EA1D2C' }}>Adicionar Marca</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '32px auto', padding: '0 20px' }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>Dados da marca</div>

          <Field label="Nome da marca *" value={marca} onChange={setMarca} placeholder="Ex: Burger King" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Qtd de lojas fisicas" value={qtdLojas} onChange={setQtdLojas} placeholder="0" type="number" />
            <SelectField label="Classificacao" value={classificacao} onChange={setClassificacao} options={['P', 'M', 'G']} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SelectField label="Marca TOP KA" value={topKa} onChange={setTopKa} options={['Sim', 'Nao']} placeholder="Selecione..." />
            <SelectField label="Marca no BP" value={noBP} onChange={setNoBP} options={['Sim', 'Nao']} placeholder="Selecione..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="PDV atual" value={pdv} onChange={setPdv} placeholder="Ex: Linx, TOTVS" />
            <SelectField label="Estado" value={estado} onChange={setEstado} options={UF} />
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginTop: 8 }}>Produtos ativos</div>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: -12 }}>Selecione os produtos e defina o responsavel de cada um</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(PRODUCTS).map(([pk, prod]) => {
              const isActive = activeProducts.includes(pk);
              return (
                <div key={pk} style={{ border: `1px solid ${isActive ? prod.color : '#e2e8f0'}`, borderRadius: 12, overflow: 'hidden', background: isActive ? prod.color + '05' : '#fff' }}>
                  <div onClick={() => toggleProduct(pk)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isActive ? prod.color : '#cbd5e1'}`, background: isActive ? prod.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isActive && <Check size={14} color="#fff" />}
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: prod.color }} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: isActive ? '#1e293b' : '#94a3b8' }}>{prod.name}</span>
                  </div>
                  {isActive && prod.responsaveis && (
                    <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>Responsavel:</span>
                      <select value={responsaveis[pk] || ''} onChange={e => setResponsaveis(prev => ({ ...prev, [pk]: e.target.value }))}
                        style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff' }}>
                        <option value="">Selecione...</option>
                        {prod.responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#dc2626' }}>{error}</div>}
          {success && <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#15803d' }}>{success}</div>}

          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '14px', borderRadius: 10, border: 'none', background: saving ? '#fca5a5' : '#EA1D2C', color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? 'Salvando...' : <><Plus size={18} /> Adicionar marca</>}
          </button>
        </div>
      </div>
    </div>
  );
}
