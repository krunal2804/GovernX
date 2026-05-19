import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import { HiOutlineArrowLeft, HiOutlinePaperAirplane, HiOutlineX } from 'react-icons/hi';

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

    const updateScore = async (particularId, value) => {
        try {
            await api.put(`/projects/${id}/action-plans/${selectedPlanId}/particulars/${particularId}/score`, {
                score_out_of_5: Number(value),
            });
            await loadPlanDetail(selectedPlanId);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update score.');
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-header">
                        <span className="card-title">Sent Plans ({plans.length})</span>
                    </div>
                    {plans.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)' }}>No action plans sent yet.</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                            {plans.map((plan) => (
                                <button
                                    key={plan.id}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    style={{
                                        border: selectedPlanId === plan.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                                        background: selectedPlanId === plan.id ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '12px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'var(--transition)',
                                    }}
                                >
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{plan.title}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {plan.sent_at ? new Date(plan.sent_at).toLocaleDateString() : '-'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {selectedPlan ? (
                        <div>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700 }}>{selectedPlan.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Sent: {selectedPlan.sent_at ? new Date(selectedPlan.sent_at).toLocaleString() : '-'}
                                    {selectedPlan.sent_by_name ? ` by ${selectedPlan.sent_by_name}` : ''}
                                </div>
                            </div>
                            <div style={{ padding: '16px', overflowX: 'auto' }}>
                                <table className="bordered-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '22%' }}>Category</th>
                                            <th>Particular</th>
                                            <th style={{ width: '120px' }}>Score (/5)</th>
                                            <th style={{ width: '200px' }}>Updated At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedPlan.categories || []).map((category) => {
                                            const rowSpan = Math.max(1, (category.particulars || []).length);
                                            return (category.particulars || []).map((particular, index) => (
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
                                                    <td>
                                                        {isClient ? (
                                                            <span style={{ fontWeight: 700, color: particular.score_out_of_5 ? 'var(--primary)' : 'inherit' }}>
                                                                {particular.score_out_of_5 ?? '-'}
                                                            </span>
                                                        ) : (
                                                            <select
                                                                className="form-control"
                                                                style={{ padding: '6px 8px', height: '34px', fontWeight: 600 }}
                                                                value={particular.score_out_of_5 ?? ''}
                                                                onChange={(e) => updateScore(particular.id, e.target.value)}
                                                            >
                                                                <option value="">-</option>
                                                                {[0, 1, 2, 3, 4, 5].map((s) => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        {particular.score_updated_at ? new Date(particular.score_updated_at).toLocaleString() : '-'}
                                                    </td>
                                                </tr>
                                            ));
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '24px', color: 'var(--text-muted)' }}>
                            Click a sent action plan card to view Category and Particular details.
                        </div>
                    )}
                </div>
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
