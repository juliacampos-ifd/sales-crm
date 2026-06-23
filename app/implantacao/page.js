'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, ExternalLink } from 'lucide-react';

// Após publicar o Apps Script do dashboard, cole a URL aqui:
const DASH_URL = 'COLE_AQUI_A_URL_DO_DASHBOARD_IMPLANTACAO';

export default function ImplantacaoPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#EA1D2C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Voltar ao CRM
        </a>
        <div style={{ height: 20, width: 1, background: '#e2e8f0' }} />
        <Package size={16} color="#EA1D2C" />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Implantações 3S</span>
        <a href={DASH_URL} target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', fontSize: 12, textDecoration: 'none' }}>
          <ExternalLink size={13} /> Abrir em nova aba
        </a>
      </div>

      {/* Iframe */}
      <iframe
        src={DASH_URL}
        style={{ flex: 1, width: '100%', border: 'none', minHeight: 'calc(100vh - 53px)' }}
        title="Dashboard Implantações 3S"
      />
    </div>
  );
}
