import React, { useState, useEffect, Fragment, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import { HiOutlineArrowLeft, HiOutlinePaperAirplane, HiOutlineX } from 'react-icons/hi';

const GaugeChart = ({ percentage, small = false }) => {
    const strokeWidth = 30;
    const cx = 100;
    const cy = 100;
    // 0% -> -90deg, 100% -> 90deg
    const angle = -90 + (percentage / 100) * 180;

    return (
        <div style={{ textAlign: 'center', position: 'relative', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
            <svg viewBox="0 0 200 120" style={{ width: '100%', overflow: 'visible' }}>
                <defs>
                    <filter id="shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                    </filter>
                </defs>
                {/* 5 colored segments */}
                <path d="M 20 100 A 80 80 0 0 1 35.28 53.04" fill="none" stroke="#ef4444" strokeWidth={strokeWidth} />
                <path d="M 35.28 53.04 A 80 80 0 0 1 75.28 23.92" fill="none" stroke="#fca5a5" strokeWidth={strokeWidth} />
                <path d="M 75.28 23.92 A 80 80 0 0 1 124.72 23.92" fill="none" stroke="#fde047" strokeWidth={strokeWidth} />
                <path d="M 124.72 23.92 A 80 80 0 0 1 164.72 53.04" fill="none" stroke="#86efac" strokeWidth={strokeWidth} />
                <path d="M 164.72 53.04 A 80 80 0 0 1 180 100" fill="none" stroke="#22c55e" strokeWidth={strokeWidth} />

                {/* White gaps to separate segments */}
                <g stroke={small ? "var(--bg-secondary)" : "#ffffff"} strokeWidth="3">
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(36, 100, 100)" />
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(72, 100, 100)" />
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(108, 100, 100)" />
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(144, 100, 100)" />
                </g>
                <circle cx="100" cy="100" r="64" fill={small ? "var(--bg-secondary)" : "#ffffff"} />

                {/* Needle */}
                <g transform={`rotate(${angle}, ${cx}, ${cy})`} style={{ transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    <polygon points="96,100 104,100 100,25" fill="#475569" filter="url(#shadow)" />
                    <circle cx="100" cy="100" r="10" fill="#334155" filter="url(#shadow)" />
                    <circle cx="98" cy="98" r="3" fill="rgba(255,255,255,0.4)" />
                </g>
            </svg>
            {!small && (
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '10px' }}>
                    Client Commitment : <span style={{ color: 'var(--text-primary)' }}>{percentage.toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
};

const HorizontalBarCharts = ({ categories }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center' }}>
            <div style={{ display: 'flex', height: '12px', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px', marginLeft: '232px', marginRight: '57px' }}>
                <div style={{ flex: 1, backgroundColor: '#ef4444' }} />
                <div style={{ flex: 1, backgroundColor: '#fca5a5' }} />
                <div style={{ flex: 1, backgroundColor: '#fde047' }} />
                <div style={{ flex: 1, backgroundColor: '#86efac' }} />
                <div style={{ flex: 1, backgroundColor: '#22c55e' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {categories.map(cat => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '220px', fontSize: '13px', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cat.name}>
                            {cat.name || 'Category'}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '30px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ 
                                    height: '100%', 
                                    width: `${cat.percentage}%`, 
                                    background: 'linear-gradient(90deg, #0ea5e9, #1e3a8a)', 
                                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </div>
                            <div style={{ width: '45px', fontSize: '14px', fontWeight: 700 }}>
                                {cat.percentage.toFixed(0)}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const getScoreColor = (score) => {
    if (score === null || score === undefined || score === '') return undefined;
    const s = Number(score);
    if (s === 5) return '#22c55e'; // green
    if (s === 4) return '#86efac'; // light green
    if (s === 3) return '#fde047'; // yellow
    if (s === 2) return '#fca5a5'; // light red
    if (s === 1) return '#ef4444'; // red
    return undefined;
};

const getScoreTextColor = (score) => {
    if (score === null || score === undefined || score === '') return undefined;
    const s = Number(score);
    if (s === 5 || s === 1) return '#ffffff';
    if (s === 4 || s === 3 || s === 2) return '#1e293b';
    return undefined;
};

export default function ProjectActionPlansPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isClient = user?.role_name === 'Client';

    const [project, setProject] = useState(null);
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sendModal, setSendModal] = useState(false);
    const [sendForm, setSendForm] = useState({ action_plan_template_id: '', title: '', notes: '' });
    const [sending, setSending] = useState(false);
    const [pendingScores, setPendingScores] = useState({});
    const [savingScores, setSavingScores] = useState(false);
    const [unsavedModal, setUnsavedModal] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);

    const fetchBaseData = async () => {
        setLoading(true);
        try {
            const [projectRes, plansRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get(`/projects/${id}/action-plans`),
            ]);
            setProject(projectRes.data);
            setPlans(plansRes.data || []);
            setSelectedPlanId(null);
            setSelectedPlan(null);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to load project action plans.');
        } finally {
            setLoading(false);
        }
    };

    const loadPlanDetail = async (planId) => {
        if (!planId) return setSelectedPlan(null);
        try {
            const res = await api.get(`/projects/${id}/action-plans/${planId}`);
            setSelectedPlan(res.data);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to load action plan detail.');
        }
    };

    const loadTemplates = async () => {
        try {
            const res = await api.get('/action-plans');
            setTemplates(res.data || []);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to load action plan templates.');
        }
    };

    const metrics = useMemo(() => {
        if (!selectedPlan || !selectedPlan.categories) return null;
        
        let globalTotal = 0;
        let globalMax = 0;
        const categories = selectedPlan.categories.map(cat => {
            const particulars = cat.particulars || [];
            let catTotal = 0;
            particulars.forEach(p => {
                const val = pendingScores[p.id] !== undefined ? pendingScores[p.id] : p.score_out_of_5;
                if (val !== null && val !== '') catTotal += Number(val);
            });
            const catMax = particulars.length * 5;
            const catPercentage = catMax > 0 ? (catTotal / catMax) * 100 : 0;
            globalTotal += catTotal;
            globalMax += catMax;
            return {
                id: cat.id,
                name: cat.name,
                total: catTotal,
                max: catMax,
                percentage: catPercentage
            };
        });
        
        return {
            globalTotal,
            globalMax,
            globalPercentage: globalMax > 0 ? (globalTotal / globalMax) * 100 : 0,
            categories
        };
    }, [selectedPlan, pendingScores]);

    useEffect(() => {
        fetchBaseData();
    }, [id]);

    useEffect(() => {
        setPendingScores({});
        loadPlanDetail(selectedPlanId);
    }, [selectedPlanId]);

    useEffect(() => {
        if (location.state?.autoOpenSend && !isClient) {
            openSendModal();
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, isClient]);

    const openSendModal = async () => {
        await loadTemplates();
        setSendForm({ action_plan_template_id: '', title: '', notes: '' });
        setSendModal(true);
    };

    const submitSend = async (e) => {
        e.preventDefault();
        if (!sendForm.action_plan_template_id || !sendForm.title.trim()) {
            return alert('Template and title are required.');
        }
        setSending(true);
        try {
            await api.post(`/projects/${id}/action-plans/send`, {
                action_plan_template_id: Number(sendForm.action_plan_template_id),
                title: sendForm.title.trim(),
                notes: sendForm.notes.trim() || null,
            });
            setSendModal(false);
            await fetchBaseData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to send action plan.');
        } finally {
            setSending(false);
        }
    };

    const handleScoreChange = (particularId, value) => {
        setPendingScores(prev => ({
            ...prev,
            [particularId]: value === '' ? null : Number(value)
        }));
    };

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (Object.keys(pendingScores).length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [pendingScores]);

    const handleBackClick = (action) => {
        if (Object.keys(pendingScores).length > 0) {
            setPendingNavigation(() => action);
            setUnsavedModal(true);
        } else {
            action();
        }
    };

    const savePendingScores = async () => {
        const updates = Object.keys(pendingScores).map(pId => {
            return api.put(`/projects/${id}/action-plans/${selectedPlanId}/particulars/${pId}/score`, {
                score_out_of_5: pendingScores[pId]
            });
        });
        
        if (updates.length === 0) return;

        setSavingScores(true);
        try {
            await Promise.all(updates);
            await loadPlanDetail(selectedPlanId);
            setPendingScores({});
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update some scores.');
        } finally {
            setSavingScores(false);
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div className="fade-in">
            <Breadcrumb
                items={[
                    { label: 'Home', path: '/' },
                    { label: 'Projects', path: '/projects' },
                    { label: project?.name || 'Project', path: `/projects/${id}`, state: { from: '/projects' } },
                    { label: 'Action Plans', path: `/projects/${id}/action-plans` },
                ]}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {selectedPlanId ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleBackClick(() => setSelectedPlanId(null))}>
                            <HiOutlineArrowLeft /> Back to Plans
                        </button>
                    ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleBackClick(() => navigate(`/projects/${id}`, { state: { from: '/projects' } }))}>
                            <HiOutlineArrowLeft /> Back to Project
                        </button>
                    )}
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Project Action Plans</h1>
                </div>
                {!isClient && (
                    <button className="btn btn-primary btn-sm" onClick={openSendModal}>
                        <HiOutlinePaperAirplane /> Send New Action Plan
                    </button>
                )}
            </div>

            <div>
                {!selectedPlanId ? (
                    <div className="card" style={{ marginBottom: 0 }}>
                        <div className="card-header">
                            <span className="card-title">Sent Plans ({plans.length})</span>
                        </div>
                        {plans.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>No action plans sent yet</div>
                                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Create and send an action plan to start tracking progress.</div>
                                {!isClient && (
                                    <button className="btn btn-primary" onClick={openSendModal}>
                                        <HiOutlinePaperAirplane /> Send New Action Plan
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                {plans.map((plan) => (
                                    <button
                                        key={plan.id}
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        style={{
                                            border: '1px solid var(--border)',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '20px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'var(--transition)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                            e.currentTarget.style.background = 'var(--bg-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.background = 'var(--bg-secondary)';
                                        }}
                                    >
                                        <div style={{ width: '120px', margin: '0 auto 12px', opacity: 0.9 }}>
                                            <GaugeChart percentage={Number(plan.overall_percentage || 0)} small={true} />
                                        </div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center' }}>
                                            {plan.title} : <span style={{ color: 'var(--primary)' }}>{Number(plan.overall_percentage || 0).toFixed(0)}%</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                            Sent: {plan.sent_at ? new Date(plan.sent_at).toLocaleDateString() : '-'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : selectedPlan ? (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '20px', fontWeight: 700 }}>{selectedPlan.title}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Sent: {selectedPlan.sent_at ? new Date(selectedPlan.sent_at).toLocaleString() : '-'}
                                            {selectedPlan.sent_by_name ? ` by ${selectedPlan.sent_by_name}` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {metrics && (
                                <div style={{ padding: '32px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center' }}>
                                    <div style={{ flex: '0 0 320px' }}>
                                        <GaugeChart percentage={metrics.globalPercentage} />
                                    </div>
                                    <div style={{ flex: '1 1 450px', minWidth: '400px' }}>
                                        <HorizontalBarCharts categories={metrics.categories} />
                                    </div>
                                </div>
                            )}

                            <div style={{ padding: '16px', overflowX: 'auto' }}>
                                <table className="bordered-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '22%' }}>Category</th>
                                            <th>Particular</th>
                                            <th style={{ width: '120px' }}>Score</th>
                                            <th style={{ width: '200px' }}>Updated At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            if (!metrics) return null;
                                            
                                            return (
                                                <>
                                                    {(selectedPlan.categories || []).map((category) => {
                                                        const particulars = category.particulars || [];
                                                        const rowSpan = Math.max(1, particulars.length) + 3;
                                                        
                                                        const catMetric = metrics.categories.find(c => c.id === category.id);
                                                        const catTotalScore = catMetric?.total || 0;
                                                        const catMaxScore = catMetric?.max || 0;
                                                        const catPercentage = catMetric ? catMetric.percentage.toFixed(2) : '0.00';

                                                        return (
                                                            <Fragment key={category.id}>
                                                                {particulars.map((particular, index) => {
                                                                    const currentScore = pendingScores[particular.id] !== undefined ? pendingScores[particular.id] : particular.score_out_of_5;
                                                                    const cellBg = getScoreColor(currentScore);
                                                                    const cellText = getScoreTextColor(currentScore);
                                                                    
                                                                    return (
                                                                    <tr key={particular.id}>
                                                                        {index === 0 && (
                                                                            <td 
                                                                                rowSpan={rowSpan} 
                                                                                style={{ verticalAlign: 'middle', fontWeight: 700, backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
                                                                            >
                                                                                {category.name || '-'}
                                                                            </td>
                                                                        )}
                                                                        <td style={{ fontWeight: 500 }}>{particular.name}</td>
                                                                        <td style={{ backgroundColor: cellBg, color: cellText, transition: 'all 0.2s' }}>
                                                                            {isClient ? (
                                                                                <span style={{ fontWeight: 800 }}>
                                                                                    {currentScore ?? '-'}
                                                                                </span>
                                                                            ) : (
                                                                                <select
                                                                                    className="form-control"
                                                                                    style={{ 
                                                                                        padding: '6px 8px', 
                                                                                        height: '34px', 
                                                                                        fontWeight: 600, 
                                                                                        backgroundColor: cellBg ? 'rgba(255,255,255,0.4)' : undefined,
                                                                                        color: 'inherit',
                                                                                        borderColor: cellBg ? 'rgba(0,0,0,0.1)' : undefined
                                                                                    }}
                                                                                    value={currentScore ?? ''}
                                                                                    onChange={(e) => handleScoreChange(particular.id, e.target.value)}
                                                                                >
                                                                                    <option value="" style={{ color: '#1e293b' }}>-</option>
                                                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                                                        <option key={s} value={s} style={{ color: '#1e293b' }}>{s}</option>
                                                                                    ))}
                                                                                </select>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                                            {particular.score_updated_at ? new Date(particular.score_updated_at).toLocaleString(undefined, {
                                                                                year: 'numeric',
                                                                                month: 'numeric',
                                                                                day: 'numeric',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit'
                                                                            }) : '-'}
                                                                        </td>
                                                                    </tr>
                                                                )})}
                                                                
                                                                {/* Category Summaries */}
                                                                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 600 }}>
                                                                    {particulars.length === 0 && (
                                                                        <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', fontWeight: 700, backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
                                                                            {category.name || '-'}
                                                                        </td>
                                                                    )}
                                                                    <td>Total score</td>
                                                                    <td colSpan={2}>{catTotalScore}</td>
                                                                </tr>
                                                                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 600 }}>
                                                                    <td>Maximum Score</td>
                                                                    <td colSpan={2}>{catMaxScore}</td>
                                                                </tr>
                                                                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 600 }}>
                                                                    <td>Top Management Commitment</td>
                                                                    <td colSpan={2} style={{ color: 'var(--primary)' }}>{catPercentage}%</td>
                                                                </tr>
                                                            </Fragment>
                                                        );
                                                    })}

                                                    {/* Global Summaries */}
                                                    <tr style={{ background: 'var(--accent-light)', fontWeight: 700 }}>
                                                        <td colSpan={2} style={{ textAlign: 'right', borderRight: '1px solid var(--border)' }}>TOTAL MARKS ACHIEVED</td>
                                                        <td colSpan={2}>{metrics.globalTotal}</td>
                                                    </tr>
                                                    <tr style={{ background: 'var(--accent-light)', fontWeight: 700 }}>
                                                        <td colSpan={2} style={{ textAlign: 'right', borderRight: '1px solid var(--border)' }}>TOTAL MARKS</td>
                                                        <td colSpan={2}>{metrics.globalMax}</td>
                                                    </tr>
                                                    <tr style={{ background: 'var(--accent-light)', fontWeight: 700 }}>
                                                        <td colSpan={2} style={{ textAlign: 'right', borderRight: '1px solid var(--border)' }}>COMMITMENT SCORE</td>
                                                        <td colSpan={2} style={{ color: 'var(--primary)' }}>{metrics.globalPercentage.toFixed(2)}%</td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px' }} />
                        Loading action plan details...
                    </div>
                )}
            </div>

            {sendModal && (
                <div className="modal-overlay" onClick={() => !sending && setSendModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Send New Action Plan</h2>
                            <button className="btn-icon" onClick={() => !sending && setSendModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={submitSend}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Template *</label>
                                    <select
                                        required
                                        className="form-control"
                                        value={sendForm.action_plan_template_id}
                                        onChange={(e) => setSendForm((p) => ({ ...p, action_plan_template_id: e.target.value }))}
                                    >
                                        <option value="">Select Action Plan Template</option>
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Title *</label>
                                    <input
                                        required
                                        maxLength={150}
                                        className="form-control"
                                        value={sendForm.title}
                                        onChange={(e) => setSendForm((p) => ({ ...p, title: e.target.value }))}
                                        placeholder="e.g. Workshop 1 - Packaging"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Notes (Optional)</label>
                                    <input
                                        className="form-control"
                                        value={sendForm.notes}
                                        onChange={(e) => setSendForm((p) => ({ ...p, notes: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" disabled={sending} onClick={() => setSendModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending...' : 'Send Action Plan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {!isClient && Object.keys(pendingScores).length > 0 && (
                <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, display: 'flex', gap: '12px', animation: 'fadeInUp 0.3s ease-out' }}>
                    <button className="btn btn-secondary" onClick={() => setPendingScores({})}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={savePendingScores} disabled={savingScores} style={{ padding: '12px 24px', fontSize: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', borderRadius: '100px' }}>
                        {savingScores ? 'Saving...' : 'Update Changes'}
                    </button>
                </div>
            )}

            {unsavedModal && (
                <div className="modal-overlay" onClick={() => setUnsavedModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Unsaved Changes</h2>
                            <button className="btn-icon" onClick={() => setUnsavedModal(false)}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px 20px', fontSize: '15px' }}>
                            <p>You have unsaved score changes. Do you want to save them before leaving?</p>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                            <button className="btn btn-secondary" onClick={() => {
                                setUnsavedModal(false);
                                setPendingScores({});
                                if (pendingNavigation) pendingNavigation();
                            }}>
                                Discard Changes
                            </button>
                            <button className="btn btn-primary" onClick={async () => {
                                await savePendingScores();
                                setUnsavedModal(false);
                                if (pendingNavigation) pendingNavigation();
                            }}>
                                Save & Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
