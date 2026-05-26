import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Breadcrumb from '../components/Breadcrumb';
import CommitmentGaugeChart from '../components/CommitmentGaugeChart';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';
import {
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineExclamationCircle,
    HiOutlineClipboardList,
    HiOutlineDocumentText,
    HiOutlineLockClosed,
    HiOutlinePaperAirplane
} from 'react-icons/hi';

export default function ProjectDetailPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cctHistory, setCCTHistory] = useState([]);
    const [skipModalTask, setSkipModalTask] = useState(null);
    const [skipReason, setSkipReason] = useState('This task is Out of scope for this Project');
    const [skipSubmitting, setSkipSubmitting] = useState(false);

    const fetchProject = () => {
        api.get(`/projects/${id}`)
            .then((r) => setProject(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(fetchProject, [id]);

    useEffect(() => {
        api.get(`/projects/${id}/ccts`)
            .then((r) => setCCTHistory(r.data || []))
            .catch(() => setCCTHistory([]));
    }, [id]);

    const updateTaskStatus = async (taskId, newStatus, extraPayload = {}) => {
        try {
            await api.put(`/tasks/${taskId}`, { status: newStatus, ...extraPayload });
            await fetchProject();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update task status.');
            throw err;
        }
    };

    const openSkipModal = (task) => {
        setSkipModalTask(task);
        setSkipReason(task.skip_reason || 'This task is Out of scope for this Project');
    };

    const closeSkipModal = () => {
        if (skipSubmitting) return;
        setSkipModalTask(null);
        setSkipReason('This task is Out of scope for this Project');
    };

    const submitSkipReason = async () => {
        if (!skipModalTask) return;

        setSkipSubmitting(true);
        try {
            await updateTaskStatus(skipModalTask.id, 'skipped', { skip_reason: skipReason });
            setSkipModalTask(null);
            setSkipReason('This task is Out of scope for this Project');
        } finally {
            setSkipSubmitting(false);
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!project) return <div className="empty-state"><h3>Project not found</h3></div>;

    const completed = project.tasks.filter((t) => t.status === 'completed' || t.status === 'skipped').length;
    const total = project.tasks.length;
    const overdue = project.tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'skipped') return false;
        return t.due_date && new Date(t.due_date) < new Date();
    }).length;
    const progress = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    const lockedTaskIds = new Set(project.tasks.filter((task) => task.is_locked).map((task) => task.id));
    const avgCommitment = cctHistory.length > 0
        ? (cctHistory.reduce((sum, p) => sum + Number(p.overall_percentage || 0), 0) / cctHistory.length)
        : 0;

    const getTaskStatusIcon = (status, dueDate) => {
        if (status === 'completed') return <HiOutlineCheckCircle style={{ color: 'var(--success)', fontSize: '20px' }} />;
        if (status === 'in_progress') return <HiOutlineClock style={{ color: 'var(--info)', fontSize: '20px' }} />;
        if (dueDate && new Date(dueDate) < new Date() && status !== 'completed' && status !== 'skipped') {
            return <HiOutlineExclamationCircle style={{ color: 'var(--danger)', fontSize: '20px' }} />;
        }
        return <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border)' }} />;
    };

    const getTaskActionText = (task) => {
        if (!task.status_updated_by_name || !task.status_updated_at) return null;

        const actionByStatus = {
            completed: 'Completed',
            skipped: 'Skipped',
            in_progress: 'Started',
            not_started: 'Marked not started',
        };

        const actionLabel = actionByStatus[task.status] || 'Updated';
        const actionDate = new Date(task.status_updated_at).toLocaleDateString();
        return `${actionLabel} by ${task.status_updated_by_name} on ${actionDate}`;
    };

    const statusOptions = ['not_started', 'in_progress', 'completed', 'skipped'];
    const openReferenceDocument = (doc) => {
        if (!doc?.file_url) {
            alert('No Link Provided for this.');
            return;
        }
        window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    };

    const fromPath = location.state?.from || '/clients';
    const fromAssignmentId = location.state?.assignmentId;
    const fromAssignmentName = location.state?.assignmentName;

    const getBreadcrumbItems = () => {
        if (fromPath === '/projects') {
            return [
                { label: 'Home', path: '/' },
                { label: 'Projects', path: '/projects' },
                { label: project.name, path: `/projects/${project.id}`, state: { from: '/projects' } }
            ];
        }
        if (fromPath === '/assignments') {
            return [
                { label: 'Home', path: '/' },
                { label: 'Assignments', path: '/assignments' },
                { label: project.assignment_name, path: `/assignments/${project.assignment_id}`, state: { from: '/assignments' } },
                { label: project.name, path: `/projects/${project.id}`, state: { from: '/assignments' } }
            ];
        }
        if (fromPath === '/my-assignments') {
            const assignId = fromAssignmentId || project.assignment_id;
            const assignName = fromAssignmentName || project.assignment_name;
            return [
                { label: 'Home', path: '/' },
                { label: 'My Assignments', path: '/my-assignments' },
                { label: assignName, path: `/assignments/${assignId}`, state: { from: '/my-assignments' } },
                { label: project.name, path: `/projects/${project.id}`, state: { from: '/my-assignments', assignmentId: assignId, assignmentName: assignName } }
            ];
        }
        if (fromPath === '/my-projects') {
            return [
                { label: 'Home', path: '/' },
                { label: 'My Projects', path: '/my-projects' },
                { label: project.name, path: `/projects/${project.id}`, state: { from: '/my-projects' } }
            ];
        }

        return [
            { label: 'Home', path: '/' },
            { label: 'Clients', path: '/clients' },
            { label: project.organization_name, path: `/clients/${project.organization_id || ''}` },
            { label: project.assignment_name, path: `/assignments/${project.assignment_id}`, state: { from: '/clients' } },
            { label: project.name, path: `/projects/${project.id}`, state: { from: '/clients' } }
        ];
    };

    return (
        <div className="fade-in">
            <Breadcrumb items={getBreadcrumbItems()} />

            <div className="detail-header" style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{project.name}</h1>
                <div className="detail-meta">
                    <div className="meta-item"><strong>Service:</strong> <span className="badge badge-purple" style={{ marginLeft: '6px' }}>{project.service_name}</span></div>
                    <div className="meta-item"><strong>Status:</strong> <span className={`badge ${getWorkflowStatusBadge(project.status)}`} style={{ marginLeft: '6px' }}>{formatWorkflowStatus(project.status)}</span></div>
                    {project.start_date && <div className="meta-item"><strong>Start:</strong> {new Date(project.start_date).toLocaleDateString()}</div>}
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div className="stat-card">
                    <div className="stat-icon purple"><HiOutlineClipboardList /></div>
                    <div className="stat-info"><h3>{total}</h3><p>Total Tasks</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><HiOutlineCheckCircle /></div>
                    <div className="stat-info"><h3>{completed}</h3><p>Completed</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon red"><HiOutlineExclamationCircle /></div>
                    <div className="stat-info"><h3>{overdue}</h3><p>Overdue</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue"><HiOutlineClock /></div>
                    <div className="stat-info"><h3>{progress}%</h3><p>Progress</p></div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Overall Progress</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{progress}%</span>
                </div>
                <div className="progress-bar" style={{ height: '10px' }}>
                    <div className={`fill ${parseFloat(progress) >= 75 ? 'green' : parseFloat(progress) >= 40 ? 'orange' : 'purple'}`} style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                            <span className="card-title">Project Tasks ({total})</span>
                        </div>
                        <div style={{ padding: '12px' }}>
                            {(() => {
                                const groups = new Map();
                                project.tasks.forEach((task) => {
                                    const stepLabel = task.step_name || 'Other';
                                    const stepKey = task.service_step_id
                                        ? `service-step-${task.service_step_id}`
                                        : `fallback-${task.service_step_sequence_order ?? 'none'}-${stepLabel}`;

                                    if (!groups.has(stepKey)) {
                                        groups.set(stepKey, {
                                            key: stepKey,
                                            name: stepLabel,
                                            sequence: task.service_step_sequence_order,
                                            tasks: [],
                                        });
                                    }
                                    groups.get(stepKey).tasks.push(task);
                                });

                                const stepGroups = Array.from(groups.values()).sort((a, b) => {
                                    if (a.name === 'Other') return 1;
                                    if (b.name === 'Other') return -1;
                                    const aSequence = Number.isFinite(Number(a.sequence)) ? Number(a.sequence) : Number.MAX_SAFE_INTEGER;
                                    const bSequence = Number.isFinite(Number(b.sequence)) ? Number(b.sequence) : Number.MAX_SAFE_INTEGER;
                                    if (aSequence !== bSequence) return aSequence - bSequence;
                                    return 0;
                                });

                                const romanNumerals = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

                                return stepGroups.length > 0 ? stepGroups.map((stepGroup, stepIndex) => (
                                    <div key={stepGroup.key} style={{ marginBottom: '24px' }}>
                                        <div style={{
                                            background: 'var(--bg-secondary)',
                                            padding: '12px 16px',
                                            borderRadius: 'var(--radius-md)',
                                            fontWeight: 700,
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            marginBottom: '12px'
                                        }}>
                                            {stepGroup.name === 'Other' ? stepGroup.name : `Step ${romanNumerals[stepIndex] || stepIndex} - ${stepGroup.name}`}
                                        </div>
                                        <div className="task-list">
                                            {stepGroup.tasks.map((task) => {
                                                const isLocked = lockedTaskIds.has(task.id);
                                                const taskActionText = getTaskActionText(task);

                                                return (
                                                    <div
                                                        className="task-item"
                                                        key={task.id}
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'stretch',
                                                            gap: '8px',
                                                            opacity: isLocked ? 0.6 : 1,
                                                            background: isLocked ? 'var(--bg-secondary)' : undefined
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '16px' }}>
                                                            <div style={{ cursor: 'default' }}>
                                                                {getTaskStatusIcon(task.status, task.due_date)}
                                                            </div>
                                                            <div className="task-order">{task.sequence_order}</div>
                                                            <div className="task-info" style={{ flex: 1 }}>
                                                                <h4 style={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none', opacity: task.status === 'completed' ? 0.7 : 1 }}>
                                                                    {task.name}
                                                                </h4>
                                                                <p>
                                                                    {task.due_date && `Due: ${new Date(task.due_date).toLocaleDateString()}`}
                                                                    {task.assignee_first_name && `   ${task.assignee_first_name} ${task.assignee_last_name}`}
                                                                </p>
                                                                {taskActionText && (
                                                                    <div className="task-action-meta">{taskActionText}</div>
                                                                )}
                                                            </div>
                                                            {user?.role_name === 'Client' ? (
                                                                <span className={`badge ${getWorkflowStatusBadge(task.status)}`}>
                                                                    {formatWorkflowStatus(task.status)}
                                                                </span>
                                                            ) : (
                                                                <select
                                                                    className="task-status-select"
                                                                    value={task.status}
                                                                    onChange={(e) => {
                                                                        const nextStatus = e.target.value;
                                                                        if (nextStatus === 'skipped') {
                                                                            openSkipModal(task);
                                                                            return;
                                                                        }
                                                                        updateTaskStatus(task.id, nextStatus);
                                                                    }}
                                                                    disabled={isLocked}
                                                                >
                                                                    {statusOptions.map((status) => (
                                                                        <option key={status} value={status}>{formatWorkflowStatus(status)}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>

                                                        {isLocked && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
                                                                <HiOutlineLockClosed size={14} />
                                                                Locked until all earlier tasks are completed.
                                                            </div>
                                                        )}

                                                        {task.status === 'skipped' && task.skip_reason && (
                                                            <div className="task-skip-note">
                                                                <div className="task-skip-reason">{task.skip_reason}</div>
                                                            </div>
                                                        )}

                                                        {user?.role_name !== 'Client' && task.documents?.length > 0 && (
                                                            <div style={{ marginLeft: 0, marginTop: '8px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Standard for reference:</span>
                                                                {task.documents.map((doc) => (
                                                                    <button
                                                                        key={doc.id}
                                                                        type="button"
                                                                        onClick={() => openReferenceDocument(doc)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            fontSize: '13px',
                                                                            fontWeight: 600,
                                                                            padding: '6px 12px',
                                                                            background: 'var(--bg-hover)',
                                                                            color: 'var(--text-primary)',
                                                                            border: '1px solid var(--border)',
                                                                            borderRadius: '6px',
                                                                            textDecoration: 'none',
                                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {doc.file_url ? <HiOutlineDocumentText size={16} /> : null}
                                                                        {doc.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No tasks assigned to this project yet.
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                <div>
                    <div
                        className="card"
                        style={{ marginBottom: '20px', cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${id}/ccts`)}
                    >
                        <div className="card-header" style={{ marginBottom: '12px' }}>
                            <span className="card-title">Client Commitment Tracker</span>
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                            <CommitmentGaugeChart percentage={avgCommitment} small />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-hover)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Sent</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{cctHistory.length}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-hover)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Latest Sent</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                                    {cctHistory[0]?.sent_at ? new Date(cctHistory[0].sent_at).toLocaleDateString() : '-'}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {user?.role_name !== 'Client' && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/projects/${id}/ccts`, { state: { autoOpenSend: true } });
                                    }}
                                >
                                    <HiOutlinePaperAirplane /> Send New Client Commitment Tracker
                                </button>
                            )}
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/projects/${id}/ccts`);
                                }}
                            >
                                View Client Commitment Tracker
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div className="card-header">
                            <span className="card-title">Team Members ({project.members.length})</span>
                        </div>
                        {project.members.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {project.members.map((member) => (
                                    <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: member.side === 'consulting' ? 'linear-gradient(135deg, var(--accent), #a855f7)' : 'linear-gradient(135deg, var(--success), #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                                            {member.first_name[0]}{member.last_name[0]}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {member.first_name} {member.last_name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                as {member.role_name} {member.title ? `[${member.title}]` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No members found</p>
                        )}
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Timeline</span>
                        </div>
                        {project.timeline.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {project.timeline.map((event) => (
                                    <div key={event.id} style={{ display: 'flex', gap: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{event.title}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {new Date(event.event_date).toLocaleDateString()} • {event.event_type}
                                                {event.created_by_name && ` • ${event.created_by_name}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No events yet.</p>
                        )}
                    </div>
                </div>
            </div>

            {skipModalTask && (
                <div className="modal-overlay" onClick={closeSkipModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Skip Task</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="skip-reason">Reason</label>
                                <input
                                    id="skip-reason"
                                    className="form-control"
                                    value={skipReason}
                                    onChange={(e) => setSkipReason(e.target.value)}
                                    placeholder="Enter skip reason"
                                    disabled={skipSubmitting}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeSkipModal} disabled={skipSubmitting}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={submitSkipReason}
                                disabled={skipSubmitting || !skipReason.trim()}
                            >
                                {skipSubmitting ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


