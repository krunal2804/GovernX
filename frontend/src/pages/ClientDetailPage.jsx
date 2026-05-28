import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { HiOutlineCollection, HiOutlineClipboardList } from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';

export default function ClientDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/organizations/${id}`)
            .then((res) => setOrg(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    const getProgressColor = (pct) => {
        return pct >= 50 ? 'green' : 'blue';
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!org) return <div className="empty-state"><h3>Client not found</h3></div>;

    return (
        <div className="fade-in">
            <Breadcrumb items={[
                { label: 'Home', path: '/' },
                { label: 'Clients', path: '/clients' },
                { label: org.name, path: `/clients/${id}` }
            ]} />

            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>{org.name}</h2>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    {[org.industry, org.city, org.state, org.country].filter(Boolean).join(' � ') || 'No details'}
                </span>
            </div>

            <div className="stats-grid" style={{ marginBottom: '28px' }}>
                <div className="stat-card">
                    <div className="stat-icon blue"><HiOutlineCollection /></div>
                    <div className="stat-info">
                        <h3>{org.assignments?.length || 0}</h3>
                        <p>Assignments</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><HiOutlineClipboardList /></div>
                    <div className="stat-info">
                        <h3>{org.assignments?.reduce((sum, a) => sum + (a.project_count || 0), 0)}</h3>
                        <p>Total Projects</p>
                    </div>
                </div>
            </div>

            {org.assignments && org.assignments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {org.assignments.map((a) => (
                        <div
                            className="card"
                            key={a.id}
                            style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                            onClick={() => navigate(`/assignments/${a.id}`)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{a.name}</h3>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {a.location || 'No location'} � {a.project_count} project{a.project_count !== 1 ? 's' : ''} � {a.total_tasks} task{a.total_tasks !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {a.progress_percentage}%
                                </span>
                            </div>
                            <div className="progress-bar" style={{ height: '10px' }}>
                                <div
                                    className={`fill ${getProgressColor(a.progress_percentage)}`}
                                    style={{ width: `${a.progress_percentage}%` }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span>{a.completed_tasks} of {a.total_tasks} tasks done</span>
                                {a.status && <span className={`badge ${getWorkflowStatusBadge(a.status)}`}>{formatWorkflowStatus(a.status)}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="icon"><HiOutlineCollection /></div>
                    <h3>No assignments yet</h3>
                    <p>Create assignments for this client under the Assignments page.</p>
                </div>
            )}
        </div>
    );
}
