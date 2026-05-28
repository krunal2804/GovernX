import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { HiOutlineClipboardList } from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';

export default function MyProjectsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/dashboard/my-portal')
            .then(res => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const assignments = data?.assignments || [];
    const projects = assignments.flatMap(a =>
        (a.projects || []).map(p => ({
            ...p,
            assignment_name: a.name,
            organization_name: a.organization_name,
        }))
    );

    const getProgressColor = (pct) => {
        return pct >= 50 ? 'green' : 'blue';
    };

    const statusPriority = {
        not_started: 0,
        active: 1,
        completed: 2,
    };

    const statusFilters = [
        { value: 'all', label: 'All' },
        { value: 'not_started', label: 'Not Started' },
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
    ];

    const filteredProjects = projects
        .filter((project) => {
            if (statusFilter !== 'all' && project.status !== statusFilter) {
                return false;
            }

            const query = searchTerm.trim().toLowerCase();
            if (!query) return true;

            const searchableText = [
                project.name,
                project.organization_name,
                project.assignment_name,
                project.service_name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchableText.includes(query);
        })
        .sort((left, right) => {
            const leftPriority = statusPriority[left.status] ?? 99;
            const rightPriority = statusPriority[right.status] ?? 99;

            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
            }

            return left.name.localeCompare(right.name);
        });

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div className="fade-in">
            <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'My Projects', path: '/my-projects' }]} />
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                }}
            >
                <input
                    className="form-control"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search projects"
                    style={{
                        flex: '1 1 320px',
                        minWidth: '220px',
                        maxWidth: '100%',
                        height: '40px',
                        borderRadius: '999px',
                        background: '#ffffff',
                    }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {statusFilters.map((filter) => {
                        const isActive = statusFilter === filter.value;
                        return (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => setStatusFilter(filter.value)}
                                style={{
                                    border: '1px solid',
                                    borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                                    background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                    borderRadius: '999px',
                                    padding: '0 14px',
                                    height: '40px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'var(--transition)',
                                }}
                            >
                                {filter.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="table-container">
                <div className="table-header">
                    <h2>My Projects ({filteredProjects.length})</h2>
                </div>

                {filteredProjects.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Client</th>
                                <th>Assignment</th>
                                <th>Service</th>
                                <th>Status</th>
                                <th>Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProjects.map(p => (
                                <tr
                                    key={p.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/projects/${p.id}`, {
                                        state: {
                                            from: '/my-projects',
                                            assignmentId: p.assignment_id,
                                            assignmentName: p.assignment_name,
                                        }
                                    })}
                                >
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                                    <td>{p.organization_name}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{p.assignment_name}</td>
                                    <td>
                                        <span className="badge badge-purple">{p.service_name}</span>
                                    </td>
                                    <td>
                                        <span className={`badge ${getWorkflowStatusBadge(p.status)}`}>
                                            {formatWorkflowStatus(p.status)}
                                        </span>
                                    </td>
                                    <td style={{ minWidth: '120px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="progress-bar" style={{ flex: 1 }}>
                                                <div
                                                    className={`fill ${getProgressColor(parseFloat(p.progress_percentage || 0))}`}
                                                    style={{ width: `${p.progress_percentage || 0}%` }}
                                                />
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '36px' }}>
                                                {parseFloat(p.progress_percentage || 0).toFixed(0)}%
                                            </span>
                                        </div>
                                        {p.task_overdue > 0 && (
                                            <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>
                                                {p.task_overdue} overdue
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="icon"><HiOutlineClipboardList /></div>
                        <h3>No projects found</h3>
                        <p>Try adjusting the search or status filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
