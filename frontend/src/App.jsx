import React, { useState } from 'react';
import axios from 'axios';
import { Upload, ArrowRight, ShieldAlert } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('upload'); // 'upload', 'heatmap', 'comparison'
  const [v1File, setV1File] = useState(null);
  const [v2File, setV2File] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const handleUpload = async () => {
    if (!v1File && !v2File) return;
    setLoading(true);

    try {
      if (v1File && !v2File) {
        // Single document upload
        const formData = new FormData();
        formData.append('document', v1File);
        const res = await axios.post('http://localhost:3008/api/upload', formData);
        setData(res.data);
        setView('heatmap');
      } else if (v1File && v2File) {
        // Compare documents
        const formData = new FormData();
        formData.append('v1', v1File);
        formData.append('v2', v2File);
        const res = await axios.post('http://localhost:3008/api/compare', formData);
        setData(res.data);
        setView('comparison');
      }
    } catch (err) {
      alert('Error processing document. Ensure the backend is running and API keys are set.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Legal Document Intelligence</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Automated risk scoring and semantic clause comparison</p>
      </header>

      {/* VIEW 1: UPLOAD UI */}
      {view === 'upload' && (
        <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '24px', fontFamily: 'Outfit' }}>Upload Contracts</h2>
          <div className="upload-section">
            <label className="dropzone">
              <Upload size={48} className="icon" />
              <h3 style={{ marginTop: '16px' }}>{v1File ? v1File.name : 'Upload Original (V1)'}</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>PDF or DOCX</p>
              <input type="file" accept=".pdf,.docx" onChange={e => setV1File(e.target.files[0])} />
            </label>

            <label className="dropzone">
              <Upload size={48} className="icon" />
              <h3 style={{ marginTop: '16px' }}>{v2File ? v2File.name : 'Upload Modified (V2)'}</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>(Optional for Diffing)</p>
              <input type="file" accept=".pdf,.docx" onChange={e => setV2File(e.target.files[0])} />
            </label>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleUpload} 
            disabled={!v1File || loading}
          >
            {loading ? <span className="loader"></span> : 'Analyze Document(s)'}
          </button>
        </div>
      )}

      {/* VIEW 2: HEATMAP */}
      {view === 'heatmap' && data && (
        <div className="glass-panel">
          <div className="heatmap-header">
            <div>
              <h2 style={{ fontFamily: 'Outfit' }}>Risk Heatmap</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{data.document.filename}</p>
            </div>
            <button className="btn-primary" onClick={() => { setView('upload'); setV1File(null); setV2File(null); setData(null); }} style={{ padding: '8px 16px', marginTop: 0 }}>
              New Upload
            </button>
          </div>
          
          <div className="heatmap-grid">
            {data.clauses.map((clause, idx) => (
              <div key={idx} className={`clause-card ${clause.risk_level}`}>
                <div className="clause-header">
                  <div>
                    <div className="clause-number">{clause.clause_number}</div>
                    <div className="clause-title">{clause.clause_title}</div>
                  </div>
                  <span className={`risk-badge ${clause.risk_level}`}>{clause.risk_level} RISK</span>
                </div>
                <div className="reason-box" style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', border: 'none' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AI REASONING:</div>
                  <div style={{ fontSize: '0.9rem' }}>{clause.reason || 'No specific constraint violated.'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: COMPARISON VIEW */}
      {view === 'comparison' && data && (
        <div className="glass-panel">
          <div className="heatmap-header">
            <div>
              <h2 style={{ fontFamily: 'Outfit' }}>Clause Comparison</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Net Risk Delta: 
                <span style={{ 
                  fontWeight: 'bold', marginLeft: '8px', 
                  color: data.results.net_risk_delta === 'INCREASED' ? '#f87171' : data.results.net_risk_delta === 'DECREASED' ? '#4ade80' : '#facc15' 
                }}>
                  {data.results.net_risk_delta}
                </span>
              </p>
            </div>
            <button className="btn-primary" onClick={() => { setView('upload'); setV1File(null); setV2File(null); setData(null); }} style={{ padding: '8px 16px', marginTop: 0 }}>
              New Upload
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {data.results.clause_results.map((result, idx) => (
              <div key={idx} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span className={`status-badge ${result.status}`}>
                    {result.status}
                    {result.notes && <span style={{ fontWeight: 'normal', opacity: 0.8, marginLeft: '4px' }}>({result.notes})</span>}
                  </span>
                  
                  {result.risk_delta !== 'NEUTRAL' && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: result.risk_delta === 'INCREASED' ? '#f87171' : '#4ade80' }}>
                      Risk {result.risk_delta}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  {/* V1 Pane */}
                  <div style={{ flex: 1, padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                      V1: {result.v1_clause ? `${result.v1_clause.clause_number} - ${result.v1_clause.clause_title}` : 'None'}
                    </div>
                    {result.v1_clause && (
                      <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                        {result.status === 'MODIFIED' && result.diff ? (
                          result.diff.map((part, i) => (
                            <span key={i} className={part.removed ? 'diff-removed' : part.added ? 'diff-added' : ''}>
                              {!part.added && part.value}
                            </span>
                          ))
                        ) : (
                          result.v1_clause.full_text
                        )}
                      </div>
                    )}
                  </div>

                  <ArrowRight style={{ alignSelf: 'center', color: 'var(--text-secondary)' }} />

                  {/* V2 Pane */}
                  <div style={{ flex: 1, padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                      V2: {result.v2_clause ? `${result.v2_clause.clause_number} - ${result.v2_clause.clause_title}` : 'None'}
                    </div>
                    {result.v2_clause && (
                      <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                        {result.status === 'MODIFIED' && result.diff ? (
                          result.diff.map((part, i) => (
                            <span key={i} className={part.added ? 'diff-added' : part.removed ? 'diff-removed' : ''}>
                              {!part.removed && part.value}
                            </span>
                          ))
                        ) : (
                          result.v2_clause.full_text
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Risk Reason if RED/HIGH */}
                {result.v2_clause && (result.v2_clause.risk_level === 'RED' || result.v2_clause.risk_level === 'HIGH') && (
                  <div className="reason-box">
                    <div className="reason-title"><ShieldAlert size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: '#f87171' }} />High Risk Detected in V2</div>
                    <div className="reason-text">{result.v2_clause.reason}</div>
                    <div>
                      {result.v2_clause.triggered_constraints?.map(c => (
                        <span key={c} className="constraint-tag">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
