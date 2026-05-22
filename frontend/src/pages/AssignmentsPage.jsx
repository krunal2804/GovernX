import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineX, HiOutlineCollection, HiOutlineTrash } from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';
import { useAuth } from '../context/AuthContext';

export default function AssignmentsPage() {
    const { user } = useAuth();
    const isClient = user?.role_name === 'Client';
    const initialLogistics = {
        travel: { book_by: 'Client', paid_by: 'Client' },
        lodging: { book_by: 'Client', paid_by: 'Client' },
        boarding: { book_by: 'Client', paid_by: 'Client' },
        local_conveyance: { book_by: 'Client', paid_by: 'Client' }
    };
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [orgs, setOrgs] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [faberUsers, setFaberUsers] = useState([]);
    const [selectedTeamMemberId, setSelectedTeamMemberId] = useState('');
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        organization_id: '', name: '', location: '', description: '', start_date: '',
        faber_poc_id: '',
        top_management_name: '', top_management_designation: '', top_management_mobile: '', top_management_email: '',
        client_poc_name: '', client_poc_designation: '', client_poc_mobile: '', client_poc_email: '',
        logistics_poc_name: '', logistics_poc_designation: '', logistics_poc_mobile: '', logistics_poc_email: '',
        logistics_arrangements: initialLogistics,
        conf_data_sharing: false, conf_aae_communication: false,
        special_instructions: '',
        schedule_type: 'month',
        consulting_team: [],    // [{ user_id, title }]
        period_count: 1,
        consulting_grid: [[]],  // grid[periodIndex][teamIndex] = days
        projects: []
    });

    const fetchData = async () => {
        try {
            const [aRes, oRes, sRes, uRes] = await Promise.all([
                api.get('/assignments'),
                api.get('/organizations'),
                api.get('/services'),
                api.get('/users?role_side=consulting')
            ]);
            setAssignments(aRes.data);
            setOrgs(oRes.data);
            setServices(sRes.data);
            setFaberUsers(uRes.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const getEmptyProject = () => ({ name: '', service_id: '', description: '', start_date: '', project_code: '' });

    const openAdd = () => {
        setEditItem(null);
        setErrors({});
        setForm({
            organization_id: orgs[0]?.id || '', name: '', location: '', description: '', start_date: '',
            faber_poc_id: '',
            top_management_name: '', top_management_designation: '', top_management_mobile: '', top_management_email: '',
            client_poc_name: '', client_poc_designation: '', client_poc_mobile: '', client_poc_email: '',
            logistics_poc_name: '', logistics_poc_designation: '', logistics_poc_mobile: '', logistics_poc_email: '',
            logistics_arrangements: initialLogistics,
            conf_data_sharing: false, conf_aae_communication: false,
            special_instructions: '',
            schedule_type: 'month',
            consulting_team: [],
            period_count: 1,
            consulting_grid: [[]],
            projects: [getEmptyProject()]
        });
        setShowModal(true);
    };

    const openEdit = async (e, a) => {
        e.stopPropagation();
        setEditItem(a);
        setErrors({});
        try {
            const res = await api.get(`/assignments/${a.id}`);
            const fullAssignment = res.data;
            const teamMembers = fullAssignment.team_members || [];
            const cDays = fullAssignment.consulting_days || [];
            
            const consulting_team = teamMembers.map(tm => ({ user_id: tm.user_id, title: tm.title || '' }));
            
            const maxPeriodIndex = cDays.reduce((max, d) => Math.max(max, d.period_index), -1);
            const period_count = maxPeriodIndex >= 0 ? maxPeriodIndex + 1 : 1;
            
            let consulting_grid = [[]];
            if (consulting_team.length > 0) {
                consulting_grid = Array.from({ length: period_count }, () => Array(consulting_team.length).fill(0));
                cDays.forEach(d => {
                    const colIndex = teamMembers.findIndex(tm => tm.id === d.team_member_id);
                    if (colIndex >= 0 && d.period_index >= 0) {
                        consulting_grid[d.period_index][colIndex] = d.days || 0;
                    }
                });
            }

            setForm({
                organization_id: a.organization_id, name: a.name, location: a.location || '', description: a.description || '', start_date: a.start_date?.split('T')[0] || '',
                faber_poc_id: a.faber_poc_id || '',
                top_management_name: a.top_management_name || '', top_management_designation: a.top_management_designation || '', top_management_mobile: a.top_management_mobile || '', top_management_email: a.top_management_email || '',
                client_poc_name: a.client_poc_name || '', client_poc_designation: a.client_poc_designation || '', client_poc_mobile: a.client_poc_mobile || '', client_poc_email: a.client_poc_email || '',
                logistics_poc_name: a.logistics_poc_name || '', logistics_poc_designation: a.logistics_poc_designation || '', logistics_poc_mobile: a.logistics_poc_mobile || '', logistics_poc_email: a.logistics_poc_email || '',
                logistics_arrangements: typeof a.logistics_arrangements === 'string' ? JSON.parse(a.logistics_arrangements) : (a.logistics_arrangements || initialLogistics),
                conf_data_sharing: a.conf_data_sharing || false, conf_aae_communication: a.conf_aae_communication || false,
                special_instructions: a.special_instructions || '',
                schedule_type: a.schedule_type || 'month',
                consulting_team,
                period_count,
                consulting_grid,
                projects: [] // Hide project form on edit
            });
            setShowModal(true);
        } catch (err) {
            console.error('Failed to load assignment details for edit', err);
            alert('Failed to load assignment details.');
        }
    };

    const handleLogisticsArrangementChange = (key, field, value) => {
        setForm({
            ...form,
            logistics_arrangements: {
                ...form.logistics_arrangements,
                [key]: {
                    ...form.logistics_arrangements[key],
                    [field]: value
                }
            }
        });
    };

    const handleProjectChange = (index, field, value) => {
        const newProjects = [...form.projects];
        newProjects[index][field] = value;
        setForm({ ...form, projects: newProjects });
    };

    const addProjectField = () => setForm({ ...form, projects: [...form.projects, getEmptyProject()] });
    const removeProjectField = (index) => {
        const newProjects = form.projects.filter((_, i) => i !== index);
        setForm({ ...form, projects: newProjects });
    };

    // ─── Consulting Days helpers ───
    const handleToggleTeamMember = (userId) => {
        const exists = form.consulting_team.find(t => String(t.user_id) === String(userId));
        let newTeam;
        let newGrid;
        if (exists) {
            const idx = form.consulting_team.findIndex(t => String(t.user_id) === String(userId));
            newTeam = form.consulting_team.filter((_, i) => i !== idx);
            newGrid = form.consulting_grid.map(row => row.filter((_, i) => i !== idx));
        } else {
            const user = faberUsers.find(u => String(u.id) === String(userId));
            newTeam = [...form.consulting_team, { user_id: userId, title: user?.role_name || '' }];
            newGrid = form.consulting_grid.map(row => [...row, 0]);
        }
        setForm({ ...form, consulting_team: newTeam, consulting_grid: newGrid });
    };

    const handleTeamTitleChange = (idx, title) => {
        const newTeam = [...form.consulting_team];
        newTeam[idx] = { ...newTeam[idx], title };
        setForm({ ...form, consulting_team: newTeam });
    };

    const handlePeriodCountChange = (count) => {
        const c = Math.max(1, parseInt(count) || 1);
        const teamLen = form.consulting_team.length;
        const newGrid = Array.from({ length: c }, (_, pi) =>
            form.consulting_grid[pi] ? form.consulting_grid[pi].slice(0, teamLen).concat(Array(Math.max(0, teamLen - (form.consulting_grid[pi]?.length || 0))).fill(0)) : Array(teamLen).fill(0)
        );
        setForm({ ...form, period_count: c, consulting_grid: newGrid });
    };

    const handleGridDayChange = (periodIdx, teamIdx, value) => {
        const newGrid = form.consulting_grid.map(row => [...row]);
        newGrid[periodIdx][teamIdx] = parseInt(value) || 0;
        setForm({ ...form, consulting_grid: newGrid });
    };

    const getPeriodLabel = (idx) => {
        const prefix = form.schedule_type === 'workshop' ? 'Workshop' : 'Month';
        return `${prefix} ${idx + 1}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = {};

        if (!form.organization_id) newErrors.organization_id = 'This field is required';
        if (!form.name || !form.name.trim()) newErrors.name = 'This field is required';
        if (!form.faber_poc_id) newErrors.faber_poc_id = 'This field is required';

        // Top Management Details (Optional but validate email if provided)
        if (form.top_management_email && form.top_management_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.top_management_email)) newErrors.top_management_email = 'Invalid email address';

        // Point of Contact - Client (Optional but validate email if provided)
        if (form.client_poc_email && form.client_poc_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_poc_email)) newErrors.client_poc_email = 'Invalid email address';

        if (!editItem && form.projects && form.projects.length > 0) {
            form.projects.forEach((proj, idx) => {
                if (!proj.name || !proj.name.trim()) newErrors[`project_name_${idx}`] = 'This field is required';
                if (!proj.service_id) newErrors[`project_service_id_${idx}`] = 'This field is required';
                if (!proj.start_date) newErrors[`project_start_date_${idx}`] = 'This field is required';
            });
        }

        // Consulting Team
        if (form.consulting_team.length === 0) {
            newErrors.consulting_team = 'At least one team member must be selected';
        }

        const arr = Object.values(form.logistics_arrangements);
        const needsClientPOC = arr.some(r => r.book_by === 'Client' || r.paid_by === 'Client');
        if (needsClientPOC) {
            if (!form.logistics_poc_name || !form.logistics_poc_name.trim()) newErrors.logistics_poc_name = 'This field is required';
            if (!form.logistics_poc_designation || !form.logistics_poc_designation.trim()) newErrors.logistics_poc_designation = 'This field is required';
            if (!form.logistics_poc_mobile || !form.logistics_poc_mobile.trim()) newErrors.logistics_poc_mobile = 'This field is required';
            if (!form.logistics_poc_email || !form.logistics_poc_email.trim()) newErrors.logistics_poc_email = 'This field is required';
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.logistics_poc_email)) newErrors.logistics_poc_email = 'Invalid email address';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

        try {
            // Flatten consulting days grid into API format
            const team_members = form.consulting_team.map(t => ({ user_id: t.user_id, title: t.title }));
            const consulting_days = [];
            form.consulting_grid.forEach((row, pi) => {
                row.forEach((days, ti) => {
                    if (form.consulting_team[ti]) {
                        consulting_days.push({
                            user_id: form.consulting_team[ti].user_id,
                            period_label: getPeriodLabel(pi),
                            period_index: pi,
                            days
                        });
                    }
                });
            });
            const payload = {
                ...form,
                start_date: form.start_date || null,
                projects: (form.projects || []).map(p => ({
                    ...p,
                    start_date: p.start_date || null
                })),
                team_members,
                consulting_days
            };

            if (editItem) {
                await api.put(`/assignments/${editItem.id}`, payload);
            } else {
                await api.post('/assignments', payload);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save assignment.');
        }
    };

    const handleDelete = async (e, a) => {
        e.stopPropagation();
        try {
            // Check for dependent projects first to show explicitly in the prompt
            const pRes = await api.get(`/projects?assignment_id=${a.id}`);
            const childProjects = pRes.data;

            let message = `Are you sure you want to delete assignment "${a.name}"?`;
            if (childProjects.length > 0) {
                message += `\n\nThis will also delete the following ${childProjects.length} project(s):\n`;
                childProjects.slice(0, 5).forEach(p => message += `- ${p.name}\n`);
                if (childProjects.length > 5) message += `- ...and ${childProjects.length - 5} more\n`;
            }

            if (!window.confirm(message)) return;

            await api.delete(`/assignments/${a.id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete assignment.');
        }
    };

    

    const getProgressColor = (pct) => {
        if (pct >= 75) return 'green';
        if (pct >= 40) return 'orange';
        return 'purple';
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
                { label: 'Assignments', path: '/assignments' }
            ]} />
            {!showModal ? (
                <>
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
                        <h2>All Assignments ({filteredAssignments.length})</h2>
                        {!isClient && <button className="btn btn-primary btn-sm" onClick={openAdd}><HiOutlinePlus /> Add Assignment</button>}
                    </div>

                    {filteredAssignments.length > 0 ? (
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Organization</th>
                                    <th>Location</th>
                                    <th>Status</th>
                                    <th>Projects</th>
                                    <th>Progress</th>
                                    {!isClient && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAssignments.map((a) => (
                                    <tr key={a.id} onClick={() => navigate(`/assignments/${a.id}`, { state: { from: '/assignments' } })} style={{ cursor: 'pointer' }}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</td>
                                        <td>{a.organization_name}</td>
                                        <td>{a.location || '—'}</td>
                                        <td><span className={`badge ${getWorkflowStatusBadge(a.status)}`}>{formatWorkflowStatus(a.status)}</span></td>
                                        <td><span className="badge badge-purple">{a.project_count}</span></td>
                                        <td style={{ minWidth: '140px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="progress-bar" style={{ flex: 1 }}>
                                                    <div
                                                        className={`fill ${getProgressColor(parseFloat(a.overall_progress || 0))}`}
                                                        style={{ width: `${a.overall_progress || 0}%` }}
                                                    />
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '36px' }}>{parseFloat(a.overall_progress || 0).toFixed(0)}%</span>
                                            </div>
                                        </td>
                                        {!isClient && (
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn-icon" onClick={(e) => openEdit(e, a)} title="Edit"><HiOutlinePencil /></button>
                                                    <button className="btn-icon" onClick={(e) => handleDelete(e, a)} title="Delete" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <div className="icon"><HiOutlineCollection /></div>
                            <h3>{isClient ? "No projects assigned." : "No assignments found"}</h3>
                            <p>Try adjusting the search or status filter.</p>
                        </div>
                    )}
                </div>
                </>
            ) : (
                <div className="form-container-full fade-in" style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: 'none', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)' }}>{editItem ? 'Edit Assignment' : 'Add Assignment'}</h2>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}><HiOutlineX /> Cancel</button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div>
                            {/* Top Layout */}
                            <div className="project-form-card">
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Assignment Overview</h3>
                                <div className="form-group">
                                    <label>1. Client Name *</label>
                                    <select className="form-control" disabled={!!editItem} value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
                                        <option value="">Select Client</option>
                                        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                    </select>
                                    {errors.organization_id && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.organization_id}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Assignment Name *</label>
                                    <input className="form-control" disabled={!!editItem} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. TATA-Gujarat" />
                                    {errors.name && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.name}</span>}
                                </div>

                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label>2. Site Address (For Consulting Intervention)</label>
                                    <input className="form-control" disabled={!!editItem} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City or Plant Name" />
                                </div>

                                <div className="form-group" style={{ marginBottom: '32px' }}>
                                    <label>3. Point of Contact - Faber Infinite *</label>
                                    <select className="form-control" disabled={!!editItem} value={form.faber_poc_id} onChange={(e) => setForm({ ...form, faber_poc_id: e.target.value })}>
                                        <option value="">Select Faber Contact</option>
                                        {faberUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                                    </select>
                                    {errors.faber_poc_id && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.faber_poc_id}</span>}
                                </div>
                            </div>

                                {/* Section 3: Top Management Details */}
                                <div style={{ marginBottom: '32px' }}>
                                    <div className="project-form-card">
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Top Management Details</h3>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Name</label>
                                                <input className="form-control" value={form.top_management_name} onChange={(e) => setForm({ ...form, top_management_name: e.target.value })} placeholder="Name" />
                                                {errors.top_management_name && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.top_management_name}</span>}
                                            </div>
                                            <div className="form-group">
                                                <label>Designation</label>
                                                <input className="form-control" value={form.top_management_designation} onChange={(e) => setForm({ ...form, top_management_designation: e.target.value })} placeholder="Designation" />
                                                {errors.top_management_designation && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.top_management_designation}</span>}
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Mobile/ Board Line No.</label>
                                                <input className="form-control" value={form.top_management_mobile} onChange={(e) => setForm({ ...form, top_management_mobile: e.target.value })} placeholder="Phone Number" />
                                                {errors.top_management_mobile && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.top_management_mobile}</span>}
                                            </div>
                                            <div className="form-group">
                                                <label>E-mail ID</label>
                                                <input type="email" className="form-control" value={form.top_management_email} onChange={(e) => setForm({ ...form, top_management_email: e.target.value })} placeholder="Email Address" />
                                                {errors.top_management_email && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.top_management_email}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 4: Point of Contact - Client */}
                                <div style={{ marginBottom: '32px' }}>
                                    <div className="project-form-card">
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Point of Contact - Client</h3>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Name</label>
                                                <input className="form-control" value={form.client_poc_name} onChange={(e) => setForm({ ...form, client_poc_name: e.target.value })} placeholder="Name" />
                                                {errors.client_poc_name && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.client_poc_name}</span>}
                                            </div>
                                            <div className="form-group">
                                                <label>Designation</label>
                                                <input className="form-control" value={form.client_poc_designation} onChange={(e) => setForm({ ...form, client_poc_designation: e.target.value })} placeholder="Designation" />
                                                {errors.client_poc_designation && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.client_poc_designation}</span>}
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Mobile/ Board Line No.</label>
                                                <input className="form-control" value={form.client_poc_mobile} onChange={(e) => setForm({ ...form, client_poc_mobile: e.target.value })} placeholder="Phone Number" />
                                                {errors.client_poc_mobile && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.client_poc_mobile}</span>}
                                            </div>
                                            <div className="form-group">
                                                <label>E-mail ID</label>
                                                <input type="email" className="form-control" value={form.client_poc_email} onChange={(e) => setForm({ ...form, client_poc_email: e.target.value })} placeholder="Email Address" />
                                                {errors.client_poc_email && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.client_poc_email}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 5: Consulting Days */}
                                <div style={{ marginBottom: '32px' }}>
                                    <div className="project-form-card">
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Consulting Days</h3>

                                        {/* Schedule Type Toggle */}
                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label>Schedule Type</label>
                                            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 400 }}>
                                                    <input type="radio" name="schedule_type" value="month" checked={form.schedule_type === 'month'} onChange={() => setForm({ ...form, schedule_type: 'month' })} />
                                                    Month Wise
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 400 }}>
                                                    <input type="radio" name="schedule_type" value="workshop" checked={form.schedule_type === 'workshop'} onChange={() => setForm({ ...form, schedule_type: 'workshop' })} />
                                                    Workshop Wise
                                                </label>
                                            </div>
                                        </div>

                                        {/* Number of Periods */}
                                        <div className="form-group" style={{ marginBottom: '16px', maxWidth: '200px' }}>
                                            <label>Number of {form.schedule_type === 'workshop' ? 'Workshops' : 'Months'}</label>
                                            <input type="number" className="form-control" min="1" value={form.period_count} onChange={(e) => handlePeriodCountChange(e.target.value)} />
                                        </div>

                                        {/* Team Member Selector */}
                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label>Select Team Members *</label>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                                <select
                                                    className="form-control"
                                                    value={selectedTeamMemberId}
                                                    onChange={(e) => setSelectedTeamMemberId(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (selectedTeamMemberId) {
                                                                const exists = form.consulting_team.some(t => String(t.user_id) === String(selectedTeamMemberId));
                                                                if (!exists) {
                                                                    handleToggleTeamMember(parseInt(selectedTeamMemberId, 10));
                                                                }
                                                                setSelectedTeamMemberId('');
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <option value="">Select a member...</option>
                                                    {faberUsers
                                                        .filter(u => !form.consulting_team.some(t => String(t.user_id) === String(u.id)))
                                                        .map(u => (
                                                            <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                                                        ))
                                                    }
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
                                                    disabled={!selectedTeamMemberId}
                                                    onClick={() => {
                                                        if (selectedTeamMemberId) {
                                                            const exists = form.consulting_team.some(t => String(t.user_id) === String(selectedTeamMemberId));
                                                            if (!exists) {
                                                                handleToggleTeamMember(parseInt(selectedTeamMemberId, 10));
                                                            }
                                                            setSelectedTeamMemberId('');
                                                        }
                                                    }}
                                                >
                                                    <HiOutlinePlus size={20} />
                                                </button>
                                            </div>
                                            {errors.consulting_team && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.consulting_team}</span>}
                                        </div>

                                        {/* Title inputs for selected members */}
                                        {form.consulting_team.length > 0 && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ marginBottom: '8px', display: 'block' }}>Team Titles</label>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                                    {form.consulting_team.map((member, idx) => {
                                                        const user = faberUsers.find(u => String(u.id) === String(member.user_id));
                                                        return (
                                                            <div key={member.user_id} style={{ flex: '1 1 200px', minWidth: '180px' }}>
                                                                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                                                                    <span>{user ? `${user.first_name} ${user.last_name}` : 'User'}</span>
                                                                    <button type="button" onClick={() => handleToggleTeamMember(member.user_id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} title="Remove Team Member">
                                                                        <HiOutlineX size={16} />
                                                                    </button>
                                                                </div>
                                                                <input className="form-control" value={member.title} onChange={(e) => handleTeamTitleChange(idx, e.target.value)} placeholder="e.g. Industrial Engineer" />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Consulting Days Grid */}
                                        {form.consulting_team.length > 0 && form.period_count > 0 && (
                                            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ background: 'var(--bg-secondary)' }}>
                                                            <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                {form.schedule_type === 'workshop' ? 'Workshop' : 'Month'}
                                                            </th>
                                                            {form.consulting_team.map((member, ti) => (
                                                                <th key={ti} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid var(--border)', fontWeight: 600, minWidth: '100px' }}>
                                                                    {member.title || `Member ${ti + 1}`}
                                                                </th>
                                                            ))}
                                                            <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid var(--border)', fontWeight: 700, background: 'var(--bg-secondary)' }}>
                                                                Total
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {form.consulting_grid.map((row, pi) => (
                                                            <tr key={pi} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                <td style={{ padding: '8px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>{getPeriodLabel(pi)}</td>
                                                                {row.map((days, ti) => (
                                                                    <td key={ti} style={{ padding: '4px 8px', textAlign: 'center' }}>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={days}
                                                                            onChange={(e) => handleGridDayChange(pi, ti, e.target.value)}
                                                                            style={{
                                                                                width: '60px',
                                                                                textAlign: 'center',
                                                                                padding: '6px 4px',
                                                                                border: '1px solid var(--border)',
                                                                                borderRadius: '6px',
                                                                                background: 'var(--bg-primary)',
                                                                                color: 'var(--text-primary)',
                                                                                fontSize: '13px'
                                                                            }}
                                                                        />
                                                                    </td>
                                                                ))}
                                                                <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>
                                                                    {row.reduce((sum, d) => sum + d, 0)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {/* Totals Row */}
                                                        <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                                                            <td style={{ padding: '10px 12px' }}>Total</td>
                                                            {form.consulting_team.map((_, ti) => (
                                                                <td key={ti} style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                                    {form.consulting_grid.reduce((sum, row) => sum + (row[ti] || 0), 0)}
                                                                </td>
                                                            ))}
                                                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                                                                {form.consulting_grid.reduce((total, row) => total + row.reduce((s, d) => s + d, 0), 0)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="project-form-card" style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Logistics Arrangement</h3>
                                    <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px' }}>Point of Contact - Logistics</h4>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Name</label>
                                            <input className="form-control" value={form.logistics_poc_name} onChange={(e) => setForm({ ...form, logistics_poc_name: e.target.value })} placeholder="POC Name" />
                                            {errors.logistics_poc_name && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.logistics_poc_name}</span>}
                                        </div>
                                        <div className="form-group">
                                            <label>Designation</label>
                                            <input className="form-control" value={form.logistics_poc_designation} onChange={(e) => setForm({ ...form, logistics_poc_designation: e.target.value })} placeholder="POC Designation" />
                                            {errors.logistics_poc_designation && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.logistics_poc_designation}</span>}
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Mobile No.</label>
                                            <input className="form-control" value={form.logistics_poc_mobile} onChange={(e) => setForm({ ...form, logistics_poc_mobile: e.target.value })} placeholder="POC Mobile" />
                                            {errors.logistics_poc_mobile && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.logistics_poc_mobile}</span>}
                                        </div>
                                        <div className="form-group">
                                            <label>E-mail ID</label>
                                            <input type="email" className="form-control" value={form.logistics_poc_email} onChange={(e) => setForm({ ...form, logistics_poc_email: e.target.value })} placeholder="POC Email" />
                                            {errors.logistics_poc_email && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors.logistics_poc_email}</span>}
                                        </div>
                                    </div>

                                    <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>Booking Instructions</th>
                                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>Paid by</th>
                                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>Book by</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {['travel', 'lodging', 'boarding', 'local_conveyance'].map(key => (
                                                    <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{key.replace('_', ' ').charAt(0).toUpperCase() + key.replace('_', ' ').slice(1)}</td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <select className="form-control" style={{ padding: '6px', fontSize: '13px' }} value={form.logistics_arrangements?.[key]?.paid_by || 'Client'} onChange={(e) => handleLogisticsArrangementChange(key, 'paid_by', e.target.value)}>
                                                                <option value="Client">Client</option>
                                                                <option value="Faber Infinite">Faber Infinite</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <select className="form-control" style={{ padding: '6px', fontSize: '13px' }} value={form.logistics_arrangements?.[key]?.book_by || 'Client'} onChange={(e) => handleLogisticsArrangementChange(key, 'book_by', e.target.value)}>
                                                                <option value="Client">Client</option>
                                                                <option value="Faber Infinite">Faber Infinite</option>
                                                            </select>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="project-form-card" style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Significant Confirmation</h3>
                                    <div style={{ marginBottom: '16px' }}>
                                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            1. Has the point of contact from Business Creation team of Faber Infinite, ensured with the client that all the formalities for sharing data with respective consultants (e.g NDA, service contract) are completed? Please get written note from the client if possible.
                                        </p>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="radio" checked={form.conf_data_sharing === true} onChange={() => setForm({ ...form, conf_data_sharing: true })} /> Yes
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="radio" checked={form.conf_data_sharing === false} onChange={() => setForm({ ...form, conf_data_sharing: false })} /> No
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            2. Has the point of contact from Business Creation team of Faber Infinite, communicated to client authority to share formal communication with all the involved shareholders about Alignment and Analysis Exercise (AAE)?
                                        </p>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="radio" checked={form.conf_aae_communication === true} onChange={() => setForm({ ...form, conf_aae_communication: true })} /> Yes
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="radio" checked={form.conf_aae_communication === false} onChange={() => setForm({ ...form, conf_aae_communication: false })} /> No
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="project-form-card" style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Points to Consider</h3>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        <li>-In the case of Implementation, KPI sheet approved by the client, should go along with Client Announcement Form as an Annexure.</li>
                                        <li>-After releasing Client Announcement form, there should be a formal communication of any specification, among Business Creation team member and Consulting team members, before the initiation of project.</li>
                                        <li>-Kindly jot down the key points of client discussions and important elements, that would be helpful to consulting team in further process.</li>
                                    </ul>
                                </div>

                                <div className="project-form-card" style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Special Instructions</h3>
                                    <div className="form-group">
                                        <textarea
                                            className="form-control"
                                            rows="4"
                                            value={form.special_instructions}
                                            onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
                                            placeholder="Add any special instructions or notes here..."
                                        />
                                    </div>
                                </div>

                                {!editItem && (
                                    <div style={{ marginTop: '24px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Projects</h3>
                                        {form.projects.map((proj, idx) => (
                                            <div key={idx} className="project-form-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Project {idx + 1}</h4>
                                                    {form.projects.length > 1 && (
                                                        <button type="button" onClick={() => removeProjectField(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Remove Project">
                                                            <HiOutlineTrash size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Project Name *</label>
                                                        <input className="form-control" value={proj.name} onChange={(e) => handleProjectChange(idx, 'name', e.target.value)} placeholder="e.g. Implementation Phase" />
                                                        {errors[`project_name_${idx}`] && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors[`project_name_${idx}`]}</span>}
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Service Type *</label>
                                                        <select className="form-control" value={proj.service_id} onChange={(e) => handleProjectChange(idx, 'service_id', e.target.value)}>
                                                            <option value="">Select Service</option>
                                                            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                        </select>
                                                        {errors[`project_service_id_${idx}`] && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors[`project_service_id_${idx}`]}</span>}
                                                    </div>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                                    <label>Key Deliverables and Scope of Work</label>
                                                    <textarea
                                                        className="form-control"
                                                        rows="2"
                                                        value={proj.description || ''}
                                                        onChange={(e) => handleProjectChange(idx, 'description', e.target.value)}
                                                        style={{ resize: 'vertical' }}
                                                        placeholder="Enter deliverables and scope..."
                                                    />
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Tentative Flagoff Date *</label>
                                                        <input type="date" className="form-control" value={proj.start_date || ''} onChange={(e) => handleProjectChange(idx, 'start_date', e.target.value)} />
                                                        {errors[`project_start_date_${idx}`] && <span className="error-text" style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px', display: 'block' }}>{errors[`project_start_date_${idx}`]}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" className="add-project-btn" onClick={addProjectField}>
                                            <HiOutlinePlus size={20} /> Add Another Project
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editItem ? 'Save Changes' : 'Add Assignment'}</button>
                            </div>
                    </form>
                </div>
            )}
        </div>
    );
}






