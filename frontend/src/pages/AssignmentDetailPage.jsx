import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { HiOutlineClipboardList, HiOutlineCheckCircle, HiOutlineInformationCircle } from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';

export default function AssignmentDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/assignments/${id}`)
            .then((res) => {
                const assignmentData = res.data;
                api.get(`/projects?assignment_id=${id}`)
                    .then((projRes) => {
                        const projects = projRes.data || [];
                        const overallProgress = projects.length > 0
                            ? projects.reduce((sum, project) => sum + parseFloat(project.progress_percentage || 0), 0) / projects.length
                            : 0;

                        setAssignment({
                            ...assignmentData,
                            projects,
                            overall_progress: Number(overallProgress.toFixed(1)),
                        });
                    })
                    .catch(console.error)
                    .finally(() => setLoading(false));
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    const getProgressColor = (pct) => {
        return pct >= 50 ? 'green' : 'blue';
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!assignment) return <div className="empty-state"><h3>Assignment not found</h3></div>;

    const totalProjects = assignment.projects?.length || 0;
    const completedProjects = assignment.projects?.filter((p) => p.status === 'completed').length || 0;
    const overallProgress = parseFloat(assignment.overall_progress || 0);

    const fromPath = location.state?.from || '/clients';

    const getBreadcrumbItems = () => {
        if (fromPath === '/my-assignments') {
            return [
                { label: 'Home', path: '/' },
                { label: 'My Assignments', path: '/my-assignments' },
                { label: assignment.name, path: `/assignments/${assignment.id}`, state: { from: '/my-assignments' } }
            ];
        }
        if (fromPath === '/assignments') {
            return [
                { label: 'Home', path: '/' },
                { label: 'Assignments', path: '/assignments' },
                { label: assignment.name, path: `/assignments/${assignment.id}`, state: { from: '/assignments' } }
            ];
        }
        return [
            { label: 'Home', path: '/' },
            { label: 'Clients', path: '/clients' },
            { label: assignment.organization_name, path: `/clients/${assignment.organization_id}` },
            { label: assignment.name, path: `/assignments/${assignment.id}`, state: { from: '/clients' } }
        ];
    };

    return (
        <div className="fade-in">
            <Breadcrumb items={getBreadcrumbItems()} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700 }}>{assignment.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            {assignment.organization_name} • {assignment.location || 'No location'}
                        </span>
                        <span className={`badge ${getWorkflowStatusBadge(assignment.status)}`}>{formatWorkflowStatus(assignment.status)}</span>
                    </div>
                </div>
                <button
                    onClick={() => navigate(`/assignments/${id}/info`, { state: { from: fromPath } })}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                        padding: '10px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                        transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <HiOutlineInformationCircle style={{ fontSize: '18px' }} />
                    Assignment Info
                </button>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Overall Assignment Progress</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Average of {totalProjects} project{totalProjects !== 1 ? 's' : ''}
                        </div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {overallProgress.toFixed(0)}%
                    </div>
                </div>
                <div className="progress-bar" style={{ height: '10px' }}>
                    <div
                        className={`fill ${getProgressColor(overallProgress)}`}
                        style={{ width: `${overallProgress}%` }}
                    />
                </div>
            </div>

            <div className="stats-grid" style={{ marginBottom: '28px' }}>
                <div className="stat-card">
                    <div className="stat-icon purple"><HiOutlineClipboardList /></div>
                    <div className="stat-info">
                        <h3>{totalProjects}</h3>
                        <p>Total Projects</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><HiOutlineCheckCircle /></div>
                    <div className="stat-info">
                        <h3>{completedProjects}</h3>
                        <p>Completed</p>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="card-title">Projects</span>
                </div>

                {assignment.projects && assignment.projects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px' }}>
                        {assignment.projects.map((p) => {
                            const totalTasks = p.task_total || 0;
                            const completedTasks = p.task_completed || 0;
                            const progress = parseFloat(p.progress_percentage || 0).toFixed(1);

                            return (
                                <div
                                    className="card"
                                    key={p.id}
                                    style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                                    onClick={() => navigate(`/projects/${p.id}`, {
                                        state: {
                                            from: fromPath,
                                            assignmentId: assignment.id,
                                            assignmentName: assignment.name,
                                        }
                                    })}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                        e.currentTarget.style.borderColor = 'var(--purple-light)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div>
                                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</h3>
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                {p.service_name} • {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                                                {progress}%
                                            </span>
                                            <span className={`badge ${getWorkflowStatusBadge(p.status)}`}>
                                                {formatWorkflowStatus(p.status)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="progress-bar" style={{ height: '8px', background: 'var(--bg-primary)' }}>
                                        <div
                                            className={`fill ${getProgressColor(parseFloat(progress))}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>{completedTasks} of {totalTasks} tasks done</span>
                                        {p.task_overdue > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{p.task_overdue} overdue</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                        <div className="icon"><HiOutlineClipboardList /></div>
                        <h3>No projects yet</h3>
                        <p>Projects for this assignment will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
