import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { HiOutlineCollection } from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';

export default function MyAssignmentsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/dashboard/my-portal')
            .then((res) => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const assignments = data?.assignments || [];

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

    const filteredAssignments = assignments
        .filter((assignment) => {
            if (statusFilter !== 'all' && assignment.status !== statusFilter) {
                return false;
            }

            const query = searchTerm.trim().toLowerCase();
            if (!query) return true;

            const searchableText = [
                assignment.name,
                assignment.organization_name,
                assignment.location,
                assignment.my_title,
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
            <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'My Assignments', path: '/my-assignments' }]} />
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
                    placeholder="Search assignments"
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
                    <h2>My Assignments ({filteredAssignments.length})</h2>
                </div>

                {filteredAssignments.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Assignment</th>
                                <th>Client</th>
                                <th>Location</th>
                                <th>Projects</th>
                                <th>Progress</th>
                                <th>Status</th>
                                <th>My Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssignments.map((assignment) => {
                                const progress = parseFloat(assignment.overall_progress || 0);

                                return (
                                    <tr
                                        key={assignment.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/assignments/${assignment.id}`, { state: { from: '/my-assignments' } })}
                                    >
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{assignment.name}</td>
                                        <td>{assignment.organization_name}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{assignment.location || '-'}</td>
                                        <td>
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                                {assignment.projects?.length || 0}
                                            </span>
                                        </td>
                                        <td style={{ minWidth: '140px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="progress-bar" style={{ flex: 1 }}>
                                                    <div
                                                        className={`fill ${getProgressColor(progress)}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '36px' }}>
                                                    {progress.toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${getWorkflowStatusBadge(assignment.status)}`}>
                                                {formatWorkflowStatus(assignment.status)}
                                            </span>
                                        </td>
                                        <td>
                                            {assignment.my_title ? (
                                                <span
                                                    style={{
                                                        background: '#e5e7eb',
                                                        color: '#111827',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        padding: '3px 10px',
                                                        borderRadius: '999px',
                                                    }}
                                                >
                                                    {assignment.my_title}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="icon"><HiOutlineCollection /></div>
                        <h3>No assignments found</h3>
                        <p>Try adjusting the search or status filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
