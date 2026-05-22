import React, { useState, useEffect, Fragment, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import CommitmentGaugeChart from '../components/CommitmentGaugeChart';
import { HiOutlineArrowLeft, HiOutlinePaperAirplane, HiOutlineX, HiOutlineInformationCircle } from 'react-icons/hi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

export default function ProjectCCTsPage() {
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
    const [sendForm, setSendForm] = useState({ cct_template_id: '', title: '', notes: '' });
    const [sending, setSending] = useState(false);
    const [pendingScores, setPendingScores] = useState({});
    const [savingScores, setSavingScores] = useState(false);
    const [unsavedModal, setUnsavedModal] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [keyToScoreModal, setKeyToScoreModal] = useState(false);

    const fetchBaseData = async () => {
        setLoading(true);
        try {
            const [projectRes, plansRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get(`/projects/${id}/ccts`),
            ]);
            setProject(projectRes.data);
            setPlans(plansRes.data || []);
            setSelectedPlanId(null);
            setSelectedPlan(null);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to load project ccts.');
        } finally {
            setLoading(false);
        }
    };

    const loadPlanDetail = async (planId) => {
        if (!planId) return setSelectedPlan(null);
        try {
            const res = await api.get(`/projects/${id}/ccts/${planId}`);
            setSelectedPlan(res.data);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to load cct detail.');
        }
    };

    const loadTemplates = async () => {
        try {
            const res = await api.get('/ccts');
            setTemplates(res.data || []);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to load cct templates.');
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

    const summaryData = useMemo(() => {
        if (!plans || plans.length === 0) return { averagePercentage: 0, chartData: [] };
        
        let total = 0;
        let chartData = [];
        
        // Plans are ordered descending from API. Reverse for chronological chart.
        const sortedPlans = [...plans].reverse();

        sortedPlans.forEach((plan) => {
            const perc = Number(plan.overall_percentage || 0);
            total += perc;
            chartData.push({
                name: plan.title,
                percentage: Number(perc.toFixed(2)),
                date: plan.sent_at ? new Date(plan.sent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'
            });
        });

        // If there's only 1 plan, Recharts draws a single dot, no line. 
        // Duplicate the point to create a visible flat line spanning the chart.
        // Use unique spaces for name so X-axis treats them as distinct categories.
        if (chartData.length === 1) {
            chartData = [
                { ...chartData[0], name: ' ' },
                chartData[0],
                { ...chartData[0], name: '  ' }
            ];
        }

        return {
            averagePercentage: total / plans.length,
            chartData
        };
    }, [plans]);

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
        setSendForm({ cct_template_id: '', title: '', notes: '' });
        setSendModal(true);
    };

    const submitSend = async (e) => {
        e.preventDefault();
        if (!sendForm.cct_template_id || !sendForm.title.trim()) {
            return alert('Template and title are required.');
        }
        setSending(true);
        try {
            await api.post(`/projects/${id}/ccts/send`, {
                cct_template_id: Number(sendForm.cct_template_id),
                title: sendForm.title.trim(),
                notes: sendForm.notes.trim() || null,
            });
            setSendModal(false);
            await fetchBaseData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to send cct.');
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
            return api.put(`/projects/${id}/ccts/${selectedPlanId}/particulars/${pId}/score`, {
                score_out_of_5: pendingScores[pId]
            });
        });
        
        if (updates.length === 0) return;

        setSavingScores(true);
        try {
            await Promise.all(updates);
            await loadPlanDetail(selectedPlanId);
            
            // Re-fetch ccts to update the overall percentages for the list and summary charts
            const plansRes = await api.get(`/projects/${id}/ccts`);
            setPlans(plansRes.data || []);
            
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
                    { label: 'Client Commitment Trackers', path: `/projects/${id}/ccts` },
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
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Project Client Commitment Trackers</h1>
                </div>
                {!isClient && (
                    <button className="btn btn-primary btn-sm" onClick={openSendModal}>
                        <HiOutlinePaperAirplane /> Send New Client Commitment Tracker
                    </button>
                )}
            </div>

            <div>
                {!selectedPlanId ? (
                    <>
                        {plans.length > 0 && (
                            <div className="card" style={{ marginBottom: '24px' }}>
                                <div className="card-header">
                                    <span className="card-title">Overall Commitment Summary</span>
                                </div>
                                <div style={{ padding: '32px 24px', display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center' }}>
                                    <div style={{ flex: '0 0 320px' }}>
                                        <CommitmentGaugeChart percentage={summaryData.averagePercentage} />
                                    </div>
                                    <div style={{ flex: '1 1 450px', minWidth: '400px', height: '250px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={summaryData.chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis 
                                                    dataKey="name" 
                                                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
                                                    tickMargin={12} 
                                                    axisLine={{ stroke: 'var(--border)' }} 
                                                    tickLine={false}
                                                    tickFormatter={(v) => v.trim().length > 12 ? v.substring(0, 12) + '...' : v} 
                                                />
                                                <YAxis 
                                                    domain={[0, 100]} 
                                                    tick={{ fill: 'var(--text-muted)', fontSize: 13 }} 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tickFormatter={(v) => `${v}%`} 
                                                    width={40} 
                                                />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                    itemStyle={{ color: '#3b82f6', fontWeight: 700 }}
                                                    formatter={(value) => [`${value}%`, 'Commitment']}
                                                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}
                                                    labelFormatter={(label, payload) => {
                                                        const date = payload?.[0]?.payload?.date;
                                                        return date && date !== '-' && label.trim().length > 0 ? `${label} (${date})` : label;
                                                    }}
                                                />
                                                <Line 
                                                    type="linear" 
                                                    dataKey="percentage" 
                                                    stroke="#3b82f6" 
                                                    strokeWidth={3} 
                                                    dot={{ r: 5, fill: '#3b82f6', stroke: 'var(--bg-primary)', strokeWidth: 2 }} 
                                                    activeDot={{ r: 7, strokeWidth: 0, fill: '#2563eb' }} 
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="card" style={{ marginBottom: 0 }}>
                        <div className="card-header">
                            <span className="card-title">Sent Plans ({plans.length})</span>
                        </div>
                        {plans.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>No ccts sent yet</div>
                                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Create and send an cct to start tracking progress.</div>
                                {!isClient && (
                                    <button className="btn btn-primary" onClick={openSendModal}>
                                        <HiOutlinePaperAirplane /> Send New Client Commitment Tracker
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
                                            <CommitmentGaugeChart percentage={Number(plan.overall_percentage || 0)} small={true} />
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
                    </>
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
                                <button className="btn btn-secondary btn-sm" onClick={() => setKeyToScoreModal(true)}>
                                    <HiOutlineInformationCircle style={{ marginRight: '6px', fontSize: '16px' }} /> Key to Score
                                </button>
                            </div>
                            
                            {metrics && (
                                <div style={{ padding: '32px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center' }}>
                                    <div style={{ flex: '0 0 320px' }}>
                                        <CommitmentGaugeChart percentage={metrics.globalPercentage} />
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
                        Loading cct details...
                    </div>
                )}
            </div>

            {sendModal && (
                <div className="modal-overlay" onClick={() => !sending && setSendModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Send New Client Commitment Tracker</h2>
                            <button className="btn-icon" onClick={() => !sending && setSendModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={submitSend}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Template *</label>
                                    <select
                                        required
                                        className="form-control"
                                        value={sendForm.cct_template_id}
                                        onChange={(e) => setSendForm((p) => ({ ...p, cct_template_id: e.target.value }))}
                                    >
                                        <option value="">Select Client Commitment Tracker Template</option>
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
                                <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending...' : 'Send Client Commitment Tracker'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {!isClient && Object.keys(pendingScores).length > 0 && (
                <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, display: 'flex', gap: '12px', animation: 'fadeInUp 0.3s ease-out' }}>
                    <button className="btn btn-primary" onClick={savePendingScores} disabled={savingScores} style={{ padding: '8px 16px', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)' }}>
                        {savingScores ? 'Saving...' : 'Update Changes'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setPendingScores({})} style={{ padding: '8px 16px', fontSize: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        Cancel
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

            {keyToScoreModal && (
                <div className="modal-overlay" onClick={() => setKeyToScoreModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                        <div className="modal-header">
                            <h2>Key to Score</h2>
                            <button className="btn-icon" onClick={() => setKeyToScoreModal(false)}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <table className="bordered-table" style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th colSpan="2" style={{ textAlign: 'center', fontSize: '16px' }}>Criteria</th>
                                        <th style={{ fontSize: '16px' }}>Interpretation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={{ backgroundColor: '#22c55e', color: '#ffffff', fontWeight: 700, width: '150px' }}>Outstanding</td>
                                        <td style={{ backgroundColor: '#22c55e', color: '#ffffff', width: '50px', textAlign: 'center', fontWeight: 700 }}>5</td>
                                        <td style={{ fontWeight: 500 }}>Follows rigorously as well as give additional contribution</td>
                                    </tr>
                                    <tr>
                                        <td style={{ backgroundColor: '#86efac', color: '#1e293b', fontWeight: 700 }}>Satisfactory</td>
                                        <td style={{ backgroundColor: '#86efac', color: '#1e293b', textAlign: 'center', fontWeight: 700 }}>4</td>
                                        <td style={{ fontWeight: 500 }}>Follows rigorously every time</td>
                                    </tr>
                                    <tr>
                                        <td style={{ backgroundColor: '#fde047', color: '#1e293b', fontWeight: 700 }}>Needs Improvement</td>
                                        <td style={{ backgroundColor: '#fde047', color: '#1e293b', textAlign: 'center', fontWeight: 700 }}>3</td>
                                        <td style={{ fontWeight: 500 }}>Follows but not rigorous, intermittent deterioration</td>
                                    </tr>
                                    <tr>
                                        <td style={{ backgroundColor: '#fca5a5', color: '#1e293b', fontWeight: 700 }}>Unsatisfactory</td>
                                        <td style={{ backgroundColor: '#fca5a5', color: '#1e293b', textAlign: 'center', fontWeight: 700 }}>2</td>
                                        <td style={{ fontWeight: 500 }}>Needs continuous follow-up from consultants</td>
                                    </tr>
                                    <tr>
                                        <td style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700 }}>Disappointing</td>
                                        <td style={{ backgroundColor: '#ef4444', color: '#ffffff', textAlign: 'center', fontWeight: 700 }}>1</td>
                                        <td style={{ fontWeight: 500 }}>No involvement & No contribution, Reluctant to change</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
