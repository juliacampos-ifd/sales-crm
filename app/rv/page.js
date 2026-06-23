'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, TrendingUp, ExternalLink, X } from 'lucide-react';

const FORMS_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeePhTZBPd5TaVw9GXlc_ba-mEo_8iuS6i_7hSixuaL-HZ3HA/viewform';
const DASHBOARD_URL = 'https://script.google.com/a/macros/ifood.com.br/s/AKfycbxulkgOJ32LKHliRRtfudOQAcO1DdoY2cK420zsE9aWMhNjzpKaQegSZ48MEeUdWScq/exec';

export default function RVPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // null | 'forms' | 'dashboard'
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      setLoading(false);
    });
  }, []);

  const handleCard = (type) => {
    setIframeError(false);
    setActive(type);
  };

  const activeUrl = active === 'forms' ? FORMS_URL : DASHBOARD_URL;
  const activeLabel = active === 'forms' ? 'Formulário RV' : 'Dashboard RV';

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#EA1D2C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Voltar ao CRM
        </a>
        <div style={{ height: 20, width: 1, background: '#e2e8f0' }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>RV</span>
        {active && (
          <>
            <div style={{ height: 20, width: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 14, color: '#64748b' }}>{activeLabel}</span>
            <button onClick={() => setActive(null)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
              <X size={14} /> Fechar
            </button>
            <a href={activeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', fontSize: 13, textDecoration: 'none' }}>
              <ExternalLink size={14} /> Abrir em nova aba
            </a>
          </>
        )}
      </div>

      {/* Cards */}
      {!active && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ maxWidth: 700, width: '100%' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8, textAlign: 'center' }}>RV — Remuneração Variável</h1>
            <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 40 }}>Escolha o que deseja acessar</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Card Forms */}
              <button onClick={() => handleCard('forms')} style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: 32, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#EA1D2C'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                <div style={{ width: 48, height: 48, background: '#fef2f2', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <FileText size={24} color="#EA1D2C" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Formulário RV</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>Preencha o formulário de registro de evidências para sua remuneração variável.</div>
              </button>

              {/* Card Dashboard */}
              <button onClick={() => handleCard('dashboard')} style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: 32, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#EA1D2C'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                <div style={{ width: 48, height: 48, background: '#fef2f2', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <TrendingUp size={24} color="#EA1D2C" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Dashboard RV</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>Visualize seu desempenho, metas e progresso de remuneração variável.</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Iframe */}
      {active && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {iframeError ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#64748b' }}>
              <p style={{ fontSize: 14 }}>Não foi possível carregar em iframe. Clique abaixo para abrir em nova aba.</p>
              <a href={activeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#EA1D2C', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                <ExternalLink size={16} /> Abrir {activeLabel}
              </a>
            </div>
          ) : (
            <iframe
              src={activeUrl}
              style={{ flex: 1, width: '100%', border: 'none', minHeight: 'calc(100vh - 57px)' }}
              onError={() => setIframeError(true)}
              title={activeLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}
