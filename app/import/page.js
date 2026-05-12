'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, ArrowLeft, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  let current = [];
  let inQuotes = false;
  let field = '';

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',' || ch === ';') {
          current.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      }
    }
    if (!inQuotes) {
      current.push(field.trim());
      field = '';
      if (current.length > 1 || current[0] !== '') result.push(current);
      current = [];
    } else {
      field += '\n';
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

export default function ImportPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      setLoading(false);
    });
  }, []);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        setPreview({ error: 'Arquivo vazio ou sem dados' });
        return;
      }
      const headers = rows[0];
      const data = rows.slice(1).filter(r => r.some(c => c !== ''));
      const marcaIdx = headers.findIndex(h => h.toLowerCase().includes('marca') && !h.toLowerCase().includes('top') && !h.toLowerCase().includes('bp'));
      setPreview({ headers, data, marcaIdx, total: data.length });
    };
    reader.readAsText(f, 'UTF-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) handleFile(f);
  };

  const doImport = async () => {
    if (!preview || !preview.data) return;
    setImporting(true);
    setResult(null);
    try {
      // Send in batches of 50
      const batchSize = 50;
      let totalCreated = 0, totalUpdated = 0, allErrors = [];

      for (let i = 0; i < preview.data.length; i += batchSize) {
        const batch = preview.data.slice(i, i + batchSize);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers: preview.headers, rows: batch }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        totalCreated += json.created || 0;
        totalUpdated += json.updated || 0;
        if (json.errors) allErrors = allErrors.concat(json.errors);
      }

      setResult({ success: true, created: totalCreated, updated: totalUpdated, total: preview.total, errors: allErrors });
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setImporting(false);
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#64748b' }}>Carregando...</p></div>;
  if (!user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}><p>Faca login primeiro</p><a href="/" style={{ color: '#EA1D2C' }}>Login</a></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 40 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 13 }}><ArrowLeft size={16} /> CRM</a>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #EA1D2C, #DA5D69)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={18} color="#fff" /></div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#EA1D2C' }}>Import CSV</span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 28px' }}>
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#EA1D2C' : '#cbd5e1'}`,
            borderRadius: 16,
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? '#fef2f2' : '#fff',
            transition: '.2s',
            marginBottom: 24,
          }}
        >
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <FileSpreadsheet size={48} color={dragOver ? '#EA1D2C' : '#94a3b8'} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>
            {file ? file.name : 'Arraste o CSV aqui ou clique para selecionar'}
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            Aceita arquivos .csv separados por virgula ou ponto-e-virgula
          </p>
        </div>

        {/* Preview */}
        {preview?.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, color: '#dc2626', marginBottom: 24 }}>
            <AlertCircle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            {preview.error}
          </div>
        )}

        {preview?.data && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Pre-visualizacao</span>
                <span style={{ fontSize: 13, color: '#64748b', marginLeft: 12 }}>{preview.total} marcas encontradas</span>
                <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 12 }}>{preview.headers.length} colunas</span>
              </div>
              <button
                onClick={doImport}
                disabled={importing}
                style={{
                  background: importing ? '#94a3b8' : '#EA1D2C',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: importing ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {importing ? <><Loader2 size={16} className="spin" /> Importando...</> : <><Upload size={16} /> Importar {preview.total} marcas</>}
              </button>
            </div>

            {/* Preview table - first 10 rows */}
            <div style={{ overflowX: 'auto', maxHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #e2e8f0', textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
                    {preview.headers.slice(0, 12).map((h, i) => (
                      <th key={i} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</th>
                    ))}
                    {preview.headers.length > 12 && <th style={{ padding: '8px 10px', fontSize: 10, color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>+{preview.headers.length - 12} cols</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.slice(0, 10).map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ padding: '6px 10px', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{ri + 1}</td>
                      {row.slice(0, 12).map((cell, ci) => (
                        <td key={ci} style={{ padding: '6px 10px', fontSize: 11, color: '#475569', borderBottom: '1px solid #f1f5f9', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell || '—'}</td>
                      ))}
                      {preview.headers.length > 12 && <td style={{ padding: '6px 10px', fontSize: 10, color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.total > 10 && (
              <div style={{ padding: '8px 20px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
                Mostrando 10 de {preview.total} linhas
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            background: result.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 14,
            padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              {result.success ? <CheckCircle size={22} color="#22c55e" /> : <AlertCircle size={22} color="#ef4444" />}
              <span style={{ fontSize: 16, fontWeight: 700, color: result.success ? '#166534' : '#991b1b' }}>
                {result.success ? 'Importacao concluida!' : 'Erro na importacao'}
              </span>
            </div>
            {result.success ? (
              <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                <p style={{ margin: '4px 0' }}>{result.created} marcas novas criadas</p>
                <p style={{ margin: '4px 0' }}>{result.updated} marcas existentes atualizadas</p>
                <p style={{ margin: '4px 0' }}>{result.total} linhas processadas no total</p>
                {result.errors?.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: '#fefce8', borderRadius: 8, fontSize: 12, color: '#854d0e' }}>
                    <p style={{ fontWeight: 600, margin: '0 0 6px' }}>Avisos ({result.errors.length}):</p>
                    {result.errors.map((e, i) => <p key={i} style={{ margin: '2px 0' }}>{e}</p>)}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: '#991b1b', margin: '4px 0' }}>{result.error}</p>
            )}
          </div>
        )}

        {/* Instructions */}
        <div style={{ marginTop: 32, padding: '20px 24px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Como funciona</p>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
            <p style={{ margin: '4px 0' }}>1. Exporte sua planilha como CSV (separado por virgula ou ponto-e-virgula)</p>
            <p style={{ margin: '4px 0' }}>2. Arraste o arquivo ou clique na area acima para selecionar</p>
            <p style={{ margin: '4px 0' }}>3. Confira a pre-visualizacao e clique em Importar</p>
            <p style={{ margin: '4px 0' }}>4. Marcas existentes (mesmo nome) serao atualizadas. Marcas novas serao criadas.</p>
            <p style={{ margin: '4px 0' }}>5. Se a marca mudou de etapa no pipeline, a mudanca sera registrada no historico.</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
