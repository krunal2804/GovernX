import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { HiOutlinePlus, HiOutlineX, HiOutlineClipboardList, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';
import { useAuth } from '../context/AuthContext';

export default function ProjectsPage() {
    const { user } = useAuth();
    const isClient = user?.role_name === 'Client';
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [form, setForm] = useState({ assignment_id: '', service_id: '', name: '', description: '', start_date: '' });

    const fetchData = async () => {
        try {
            const [pRes, aRes, sRes] = await Promise.all([api.get('/projects'), api.get('/assignments'), api.get('/services')]);
            setProjects(pRes.data);
            setAssignments(aRes.data);
            setServices(sRes.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const openAdd = () => {
        setEditItem(null);
        setForm({ assignment_id: assignments[0]?.id || '', service_id: services[0]?.id || '', name: '', description: '', start_date: '' });
        setShowModal(true);
    };

    const openEdit = (e, p) => {
        e.stopPropagation();
        setEditItem(p);
        setForm({ assignment_id: p.assignment_id, service_id: p.service_id, name: p.name, description: p.description || '', start_date: p.start_date?.split('T')[0] || '' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editItem) {
                await api.put(`/projects/${editItem.id}`, form);
            } else {
                await api.post('/projects', form);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save project.');
        }
    };

    const handleDelete = async (e, p) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete project "${p.name}"?`)) return;
        try {
            await api.delete(`/projects/${p.id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete project.');
        }
    };

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
            <Breadcrumb items={[
                { label: 'Home', path: '/' },
                { label: 'Projects', path: '/projects' }
            ]} />
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
                    <h2>All Projects ({filteredProjects.length})</h2>
                </div>

                {filteredProjects.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Organization</th>
                                <th>Assignment</th>
                                <th>Service</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Tasks</th>
                                {!isClient && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProjects.map((p) => (
                                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`, { state: { from: '/projects' } })} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                                    <td>{p.organization_name}</td>
                                    <td>{p.assignment_name}</td>
                                    <td><span className="badge badge-purple">{p.service_name}</span></td>
                                    <td><span className={`badge ${getWorkflowStatusBadge(p.status)}`}>{formatWorkflowStatus(p.status)}</span></td>
                                    <td style={{ minWidth: '120px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="progress-bar" style={{ flex: 1 }}>
                                                <div className={`fill ${getProgressColor(parseFloat(p.progress_percentage))}`} style={{ width: `${p.progress_percentage}%` }} />
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{parseFloat(p.progress_percentage).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '12px' }}>
                                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{p.task_completed}</span>
                                            /{p.task_total}
                                            {p.task_overdue > 0 && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>({p.task_overdue} overdue)</span>}
                                        </span>
                                    </td>
                                    {!isClient && (
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-icon" onClick={(e) => openEdit(e, p)} title="Edit Project"><HiOutlinePencil /></button>
                                                <button className="btn-icon" onClick={(e) => handleDelete(e, p)} title="Delete Project" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="icon"><HiOutlineClipboardList /></div>
                        <h3>{isClient ? "No projects assigned." : "No projects found"}</h3>
                        <p>Try adjusting the search or status filter.</p>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Project "{form.name}"</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Assignment</label>
                                    <input className="form-control" value={projects.find(p => p.id === editItem?.id)?.assignment_name || ''} disabled style={{ background: 'var(--bg-primary)' }} />
                                </div>
                                <div className="form-group">
                                    <label>Service Type</label>
                                    <input className="form-control" value={projects.find(p => p.id === editItem?.id)?.service_name || ''} disabled style={{ background: 'var(--bg-primary)' }} />
                                </div>
                                <div className="form-group">
                                    <label>Project Name *</label>
                                    <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Time & Motion Study - Phase 1" />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief project description" />
                                </div>
                                <div className="form-group">
                                    <label>Start Date</label>
                                    <input type="date" className="form-control" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
