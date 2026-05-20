import { useEffect, useState, Fragment } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import { HiOutlineArrowLeft, HiOutlinePaperAirplane, HiOutlineX } from 'react-icons/hi';

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

    const fetchBaseData = async () => {
        setLoading(true);
        try {
            const [projectRes, plansRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get(`/projects/${id}/action-plans`),
            ]);
            setProject(projectRes.data);
            setPlans(plansRes.data || []);
            if ((plansRes.data || []).length > 0) {
                const firstId = plansRes.data[0].id;
                setSelectedPlanId(firstId);
            } else {
                setSelectedPlanId(null);
                setSelectedPlan(null);
            }
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
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${id}`, { state: { from: '/projects' } })}>
                        <HiOutlineArrowLeft /> Back
                    </button>
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
                            <div style={{ color: 'var(--text-muted)' }}>No action plans sent yet.</div>
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
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '16px' }}>{plan.title}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
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
                                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPlanId(null)}>
                                        <HiOutlineArrowLeft /> Back to Plans
                                    </button>
                                    <div>
                                        <div style={{ fontSize: '20px', fontWeight: 700 }}>{selectedPlan.title}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Sent: {selectedPlan.sent_at ? new Date(selectedPlan.sent_at).toLocaleString() : '-'}
                                            {selectedPlan.sent_by_name ? ` by ${selectedPlan.sent_by_name}` : ''}
                                        </div>
                                    </div>
                                </div>
                                {!isClient && Object.keys(pendingScores).length > 0 && (
                                    <button className="btn btn-primary btn-sm" onClick={savePendingScores} disabled={savingScores}>
                                        {savingScores ? 'Saving...' : 'Update Changes'}
                                    </button>
                                )}
                            </div>
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
                                            let globalTotal = 0;
                                            let globalMax = 0;

                                            return (
                                                <>
                                                    {(selectedPlan.categories || []).map((category) => {
                                                        const particulars = category.particulars || [];
                                                        const rowSpan = Math.max(1, particulars.length) + 3;
                                                        
                                                        let catTotalScore = 0;
                                                        particulars.forEach(p => {
                                                            const val = pendingScores[p.id] !== undefined ? pendingScores[p.id] : p.score_out_of_5;
                                                            if (val !== null && val !== '') catTotalScore += Number(val);
                                                        });
                                                        const catMaxScore = particulars.length * 5;
                                                        const catPercentage = catMaxScore > 0 ? ((catTotalScore / catMaxScore) * 100).toFixed(2) : '0.00';
                                                        
                                                        globalTotal += catTotalScore;
                                                        globalMax += catMaxScore;

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
                                                                                    {[0, 1, 2, 3, 4, 5].map((s) => (
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
                                                    {(() => {
                                                        const globalPercentage = globalMax > 0 ? ((globalTotal / globalMax) * 100).toFixed(2) : '0.00';
                                                        return (
                                                            <>
                                                                <tr style={{ background: 'var(--accent-light)', fontWeight: 700 }}>
                                                                    <td colSpan={2} style={{ textAlign: 'right', borderRight: '1px solid var(--border)' }}>TOTAL MARKS ACHIEVED</td>
                                                                    <td colSpan={2}>{globalTotal}</td>
                                                                </tr>
                                                                <tr style={{ background: 'var(--accent-light)', fontWeight: 700 }}>
                                                                    <td colSpan={2} style={{ textAlign: 'right', borderRight: '1px solid var(--border)' }}>TOTAL MARKS</td>
                                                                    <td colSpan={2}>{globalMax}</td>
                                                                </tr>
                                                                <tr style={{ background: 'var(--accent-light)', fontWeight: 700 }}>
                                                                    <td colSpan={2} style={{ textAlign: 'right', borderRight: '1px solid var(--border)' }}>COMMITMENT SCORE</td>
                                                                    <td colSpan={2} style={{ color: 'var(--primary)' }}>{globalPercentage}%</td>
                                                                </tr>
                                                            </>
                                                        );
                                                    })()}
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
        </div>
    );
}
