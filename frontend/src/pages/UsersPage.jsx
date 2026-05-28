import React, { useState, useEffect, Fragment } from 'react';
import api from '../api';
import { HiOutlineUsers, HiOutlinePlus, HiOutlineTrash, HiOutlineUpload, HiOutlineDownload, HiOutlineFilter } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        first_name: '', last_name: '', email: '', password: '', role_id: '', phone: '',
    });
    const [restoreMode, setRestoreMode] = useState(false);
    const [restoreUserId, setRestoreUserId] = useState(null);

    // Search and Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Delete state
    const [deleteModal, setDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleteError, setDeleteError] = useState('');
    const [unfinishedProjects, setUnfinishedProjects] = useState([]);
    const [unfinishedAssignments, setUnfinishedAssignments] = useState([]);
    const [deleting, setDeleting] = useState(false);
    const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);

    const [bulkModal, setBulkModal] = useState(false);
    const [bulkStep, setBulkStep] = useState(1);
    const [bulkData, setBulkData] = useState([]);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [bulkError, setBulkError] = useState('');

    // User Detail State
    const [selectedUserDetail, setSelectedUserDetail] = useState(null);
    const [userDetailLoading, setUserDetailLoading] = useState(false);
    const [userDetailModal, setUserDetailModal] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get('/users?include_inactive=true'),
            api.get('/users/roles'),
        ])
            .then(([usersRes, rolesRes]) => {
                setUsers(usersRes.data);
                const consultingRoles = rolesRes.data.filter((r) => r.side === 'consulting');
                // Filter based on hierarchy_level: user can only assign roles with a higher hierarchy_level number (less privilege)
                // Director (level 1) can assign anything.
                const allowedRoles = consultingRoles.filter(r => user?.hierarchy_level === 1 || r.hierarchy_level > (user?.hierarchy_level || 99));
                setRoles(allowedRoles);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user?.hierarchy_level]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        
        if (restoreMode && restoreUserId) {
            try {
                const res = await api.put(`/users/${restoreUserId}/restore`, form);
                setUsers(users.map(u => u.id === restoreUserId ? res.data.user : u));
                setShowModal(false);
                setForm({ first_name: '', last_name: '', email: '', password: '', role_id: '', phone: '' });
                setRestoreMode(false);
                setRestoreUserId(null);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to restore user.');
            } finally {
                setSaving(false);
            }
            return;
        }

        const existingUser = users.find(u => u.email.toLowerCase() === form.email.toLowerCase());
        if (existingUser) {
            if (!existingUser.is_active) {
                setRestoreMode(true);
                setRestoreUserId(existingUser.id);
                setError('This email belongs to a deleted account. Update their details below if needed and click "Restore User" to reactivate.');
                setSaving(false);
                return;
            } else {
                setError('Email already exists.');
                setSaving(false);
                return;
            }
        }

        try {
            const res = await api.post('/users', {
                ...form,
                role_id: parseInt(form.role_id),
            });
            const createdUser = res.data?.user || res.data;
            setUsers([...users, { ...createdUser, is_active: true, organization_name: createdUser?.organization_name || null }]);
            setShowModal(false);
            setForm({ first_name: '', last_name: '', email: '', password: '', role_id: '', phone: '' });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user.');
        } finally {
            setSaving(false);
        }
    };

    const getRoleBadgeClass = (roleName) => {
        switch (roleName) {
            case 'Client': return 'badge-success';
            case 'Director': return 'badge-purple';
            case 'Manager': return 'badge-info';
            case 'Senior Consultant': return 'badge-warning';
            case 'Consultant': return 'badge-default';
            default: return 'badge-default';
        }
    };

    const handleUserRowClick = async (user) => {
        setUserDetailModal(true);
        setUserDetailLoading(true);
        try {
            const res = await api.get(`/users/${user.id}/details`);
            setSelectedUserDetail(res.data);
        } catch (err) {
            console.error('Failed to fetch user details', err);
        } finally {
            setUserDetailLoading(false);
        }
    };

    const handleDeleteClick = async (user) => {
        setUserToDelete(user);
        setUnfinishedProjects([]);
        setUnfinishedAssignments([]);
        setDeleteError('');
        setDeleteModal(true);
        setDeleteCheckLoading(true);

        try {
            const res = await api.get(`/users/${user.id}/deletion-check`);
            setUnfinishedProjects(res.data.unfinished_projects || []);
            setUnfinishedAssignments(res.data.unfinished_assignments || []);
        } catch (err) {
            console.error("Failed to check user deletion status", err);
        } finally {
            setDeleteCheckLoading(false);
        }
    };

    const confirmDelete = async (force = false) => {
        setDeleting(true);
        setDeleteError('');
        try {
            const url = force ? `/users/${userToDelete.id}?force=true` : `/users/${userToDelete.id}`;
            await api.delete(url);
            setUsers(users.map(u => u.id === userToDelete.id ? { ...u, is_active: false } : u));
            setDeleteModal(false);
            setUserToDelete(null);
        } catch (err) {
            if (err.response?.status === 409) {
                if (err.response?.data?.unfinished_projects) {
                    setUnfinishedProjects(err.response.data.unfinished_projects);
                } else if (err.response?.data?.unfinished_assignments) {
                    setUnfinishedAssignments(err.response.data.unfinished_assignments);
                }
            } else {
                setDeleteError(err.response?.data?.error || 'Failed to delete user.');
            }
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (deleteModal && !deleteCheckLoading && !deleting && e.key === 'Enter') {
                e.preventDefault();
                const force = unfinishedProjects.length > 0 || unfinishedAssignments.length > 0;
                confirmDelete(force);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteModal, deleteCheckLoading, deleting, unfinishedProjects, unfinishedAssignments, userToDelete, users]);

    const handleBulkOpen = () => {
        setBulkFile(null);
        setBulkResult(null);
        setBulkError('');
        setBulkStep(1);
        setBulkData([]);
        setBulkModal(true);
    };

    const handleSampleDownload = async () => {
        try {
            const res = await api.get('/users/sample-excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(
                new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'sample_users.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download sample file', err);
        }
    };

    const handleBulkValidate = async () => {
        if (!bulkFile) return;
        setBulkUploading(true);
        setBulkError('');
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            const res = await api.post('/users/bulk/validate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setBulkData(res.data.rows || []);
            setBulkStep(2);
        } catch (err) {
            setBulkError(err.response?.data?.error || 'Failed to validate file.');
        } finally {
            setBulkUploading(false);
        }
    };

    const handleBulkConfirm = async () => {
        setBulkUploading(true);
        setBulkError('');
        try {
            const res = await api.post('/users/bulk/confirm', { users: bulkData });
            setBulkResult(res.data);
            if (res.data.users && res.data.users.length > 0) {
                setUsers(prev => [...prev, ...res.data.users]);
            }
        } catch (err) {
            setBulkError(err.response?.data?.error || 'Failed to upload users.');
        } finally {
            setBulkUploading(false);
        }
    };

    const handleBulkDataChange = (index, field, value) => {
        let newData = [...bulkData];
        newData[index][field] = value;
        
        // Re-validate all rows to ensure duplicate email checks are perfectly synchronized
        newData = newData.map((row, i) => {
            const errors = [];
            const warnings = [];
            if (!row.first_name) errors.push('First Name is required');
            if (!row.last_name) errors.push('Last Name is required');
            if (!row.email) errors.push('Email is required');
            if (!row.password) errors.push('Password is required');
            if (!row.role_name) errors.push('Role is required');
            if (row.password && row.password.length < 6) errors.push('Password must be at least 6 characters');
            if (row.role_name && !roles.find(r => r.name.toLowerCase() === row.role_name.toLowerCase())) {
                errors.push(`Invalid role: ${row.role_name}`);
            }
            
            if (row.email) {
                const emailLower = row.email.toLowerCase();
                // Real-time check against existing database users
                const existingDbUser = users.find(u => u.email.toLowerCase() === emailLower);
                if (existingDbUser) {
                    if (existingDbUser.is_active) {
                        errors.push('Email already exists in database');
                    } else {
                        warnings.push('User previously existed. They will be restored with these details.');
                    }
                }
                
                // Real-time check against other rows in the same upload batch
                const existsInFile = newData.some((r, checkIndex) => checkIndex !== i && r.email && r.email.toLowerCase() === emailLower);
                if (existsInFile) {
                    errors.push('Email is duplicated in this file');
                }
            }

            return { ...row, errors, warnings };
        });

        setBulkData(newData);
    };

    const handleAddRow = () => {
        setBulkData([...bulkData, {
            id: Date.now(),
            first_name: '',
            last_name: '',
            email: '',
            password: '',
            role_name: '',
            phone: '',
            errors: ['First Name is required', 'Last Name is required', 'Email is required', 'Password is required', 'Role is required'],
            warnings: []
        }]);
    };

    const handleRemoveRow = (index) => {
        setBulkData(bulkData.filter((_, i) => i !== index));
    };

    const filterOptions = [
        { value: 'org:faber', label: 'Faber Infinite' },
        { value: 'side:client', label: 'Client' },
        { value: 'role:Director', label: 'Director' },
        { value: 'role:Manager', label: 'Manager' },
        { value: 'role:Senior Consultant', label: 'Senior Consultant' },
        { value: 'role:Consultant', label: 'Consultant' },
    ];

    const toggleFilter = (value) => {
        setSelectedFilters((prev) => (
            prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
        ));
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const filteredUsers = users.filter(u => {
        if (selectedFilters.length > 0) {
            const matchesAtLeastOneFilter = selectedFilters.some((filter) => {
                if (filter === 'org:faber') return !u.organization_name;
                if (filter === 'side:client') return u.role_side === 'client';
                if (filter.startsWith('role:')) return u.role_name === filter.split(':')[1];
                return false;
            });
            if (!matchesAtLeastOneFilter) return false;
        }

        // Search filter
        if (!searchTerm.trim()) return true;
        const query = searchTerm.trim().toLowerCase();
        const searchable = [
            u.first_name, u.last_name, u.email, u.role_name, u.organization_name
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(query);
    });


    return (
        <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', position: 'relative' }}>
                <input
                    type="text"
                    className="form-control"
                    placeholder="Search users by name, email, role, or organization"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: '1 1 320px',
                        minWidth: '220px',
                        maxWidth: '100%',
                        height: '40px',
                        borderRadius: '999px',
                        background: '#ffffff',
                    }}
                />
                {/* Filter icon and dropdown menu */}
                <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    title="Filter users"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: selectedFilters.length > 0 ? 'var(--accent-light)' : '#ffffff',
                        border: `1px solid ${selectedFilters.length > 0 ? 'var(--accent)' : 'var(--border)'}`,
                        color: selectedFilters.length > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                >
                    <HiOutlineFilter />
                </button>
                {selectedFilters.length > 0 && (
                    <span className="users-filter-count">{selectedFilters.length}</span>
                )}
                {showFilterMenu && (
                    <div className="users-filter-menu">
                        <div className="users-filter-menu-header">
                            <span>Filter Users</span>
                            <button
                                type="button"
                                className="users-filter-clear"
                                onClick={() => setSelectedFilters([])}
                                disabled={selectedFilters.length === 0}
                            >
                                Clear
                            </button>
                        </div>
                        <div className="users-filter-menu-body">
                            {filterOptions.map((option) => {
                                const active = selectedFilters.includes(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`users-filter-option ${active ? 'active' : ''}`}
                                        onClick={() => toggleFilter(option.value)}
                                    >
                                        <span className={`users-filter-check ${active ? 'active' : ''}`}>✓</span>
                                        <span>{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="users-filter-menu-footer">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFilterMenu(false)}>
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="card">
                <div className="table-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '16px', position: 'relative' }}>
                    <h2>Users ({filteredUsers.length})</h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={handleBulkOpen}>
                            <HiOutlineUpload /> Upload Users
                        </button>
                        <button className="btn btn-primary" onClick={() => {
                            setRestoreMode(false);
                            setRestoreUserId(null);
                            setForm({ first_name: '', last_name: '', email: '', password: '', role_id: '', phone: '' });
                            setError('');
                            setShowModal(true);
                        }}>
                            <HiOutlinePlus /> Add User
                        </button>
                    </div>
                </div>

                {filteredUsers.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Organization</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.filter(u => u.is_active).map((u) => (
                                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => handleUserRowClick(u)}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: u.role_side === 'consulting' ? 'var(--accent)' : 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                                {u.first_name[0]}{u.last_name[0]}
                                            </div>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.first_name} {u.last_name}</span>
                                        </div>
                                    </td>
                                    <td>{u.email}</td>
                                    <td><span className={`badge ${getRoleBadgeClass(u.role_name)}`}>{u.role_name}</span></td>
                                    <td>{u.organization_name || 'Faber Infinite'}</td>
                                    <td>
                                        <button 
                                            className="btn-icon" 
                                            style={{ color: 'var(--danger)' }} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(u);
                                            }}
                                            title="Delete User"
                                        >
                                            <HiOutlineTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="icon"><HiOutlineUsers /></div>
                        <h3>No users found</h3>
                        <p>Adjust your search filters or add a new team member.</p>
                    </div>
                )}
            </div>

            {/* Add User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add New User</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className="login-error">{error}</div>}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>First Name *</label>
                                        <input
                                            className="form-control"
                                            value={form.first_name}
                                            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name *</label>
                                        <input
                                            className="form-control"
                                            value={form.last_name}
                                            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        required
                                        disabled={restoreMode}
                                        style={{ backgroundColor: restoreMode ? 'var(--bg-secondary)' : '', cursor: restoreMode ? 'not-allowed' : 'text' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Password {!restoreMode && '*'}</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        required={!restoreMode}
                                        disabled={restoreMode}
                                        minLength={6}
                                        style={{ backgroundColor: restoreMode ? 'var(--bg-secondary)' : '', cursor: restoreMode ? 'not-allowed' : 'text' }}
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Role *</label>
                                        <select
                                            className="form-control"
                                            value={form.role_id}
                                            onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Select role...</option>
                                            {roles.map((r) => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input
                                            className="form-control"
                                            value={form.phone}
                                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? (restoreMode ? 'Restoring...' : 'Creating...') : (restoreMode ? 'Restore User' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal && userToDelete && (
                <div className="modal-overlay" onClick={() => !deleting && setDeleteModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Delete User</h2>
                            <button className="btn-icon" onClick={() => setDeleteModal(false)} disabled={deleting}>✕</button>
                        </div>
                        <div className="modal-body">
                            {deleteCheckLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                                    <div className="spinner" style={{ marginBottom: '16px', width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                    <p style={{ color: 'var(--text-muted)' }}>Checking allocations...</p>
                                </div>
                            ) : (
                                <>
                                    {deleteError && <div className="login-error" style={{ marginBottom: '16px' }}>{deleteError}</div>}
                                    
                                    {unfinishedProjects.length > 0 ? (
                                        <div>
                                            <p style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                                                <strong>Are you sure?</strong> This person is allocated to these projects which are not completed:
                                            </p>
                                            <ul style={{ background: 'var(--bg-secondary)', padding: '12px 12px 12px 24px', borderRadius: '8px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                                {unfinishedProjects.map((p, i) => <li key={i} style={{ marginBottom: '4px' }}>{p}</li>)}
                                            </ul>
                                        </div>
                                    ) : unfinishedAssignments.length > 0 ? (
                                        <div>
                                            <p style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                                                <strong>Are you sure?</strong> These assignments are implicated for this client:
                                            </p>
                                            <ul style={{ background: 'var(--bg-secondary)', padding: '12px 12px 12px 24px', borderRadius: '8px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                                {unfinishedAssignments.map((a, i) => <li key={i} style={{ marginBottom: '4px' }}>{a}</li>)}
                                            </ul>
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                                            Are you sure you want to delete <strong>{userToDelete.first_name} {userToDelete.last_name}</strong>?
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setDeleteModal(false)} disabled={deleting || deleteCheckLoading}>Cancel</button>
                            {unfinishedProjects.length > 0 || unfinishedAssignments.length > 0 ? (
                                <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => confirmDelete(true)} disabled={deleting || deleteCheckLoading}>
                                    {deleting ? 'Deleting...' : 'Force Delete'}
                                </button>
                            ) : (
                                <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => confirmDelete(false)} disabled={deleting || deleteCheckLoading}>
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {bulkModal && (
                <div className="modal-overlay" onClick={() => !bulkUploading && setBulkModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: bulkStep === 2 ? '1000px' : '520px', width: '100%', transition: 'max-width 0.3s ease' }}>
                        <div className="modal-header">
                            <h2>{bulkStep === 1 ? 'Upload Users' : bulkResult ? 'Upload Complete' : 'Review & Edit Users'}</h2>
                            <button className="btn-icon" onClick={() => setBulkModal(false)} disabled={bulkUploading}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {bulkError && <div className="login-error" style={{ marginBottom: '16px' }}>{bulkError}</div>}

                            {bulkResult ? (
                                <div>
                                    {bulkResult.created > 0 && (
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px', color: 'var(--success)' }}>
                                            ✅ {bulkResult.created} user{bulkResult.created !== 1 ? 's' : ''} created successfully.
                                        </div>
                                    )}
                                    {bulkResult.errors?.length > 0 && (
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
                                            <p style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>❌ Errors:</p>
                                            <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                {bulkResult.errors.map((e, i) => <li key={i} style={{ marginBottom: '4px' }}>{e}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                    {bulkResult.created === 0 && (!bulkResult.errors || bulkResult.errors.length === 0) && (
                                        <p style={{ color: 'var(--text-muted)' }}>No rows were found in the file.</p>
                                    )}
                                </div>
                            ) : bulkStep === 1 ? (
                                <>
                                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        Upload an Excel file (.xlsx) to create multiple users at once. The file must have columns:
                                        <strong> First Name, Last Name, Email, Password, Role, Phone</strong>.
                                    </p>

                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={handleSampleDownload}
                                        style={{ marginBottom: '20px', width: '100%', justifyContent: 'center' }}
                                    >
                                        <HiOutlineDownload /> Download Sample File
                                    </button>

                                    <div
                                        style={{
                                            border: '2px dashed var(--border)',
                                            borderRadius: '12px',
                                            padding: '32px 20px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            background: bulkFile ? 'var(--bg-secondary)' : 'transparent',
                                            transition: 'all 0.2s',
                                        }}
                                        onClick={() => document.getElementById('bulk-file-input').click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const file = e.dataTransfer.files[0];
                                            if (file && file.name.endsWith('.xlsx')) setBulkFile(file);
                                        }}
                                    >
                                        <input
                                            id="bulk-file-input"
                                            type="file"
                                            accept=".xlsx"
                                            style={{ display: 'none' }}
                                            onChange={(e) => setBulkFile(e.target.files[0] || null)}
                                        />
                                        {bulkFile ? (
                                            <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                                📄 {bulkFile.name}
                                            </p>
                                        ) : (
                                            <>
                                                <HiOutlineUpload style={{ fontSize: '28px', color: 'var(--text-muted)', marginBottom: '8px' }} />
                                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Click or drag an Excel file here</p>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        Please review the parsed data. Fix any highlighted errors before uploading.
                                    </p>
                                    <div className="table-container" style={{ overflowX: 'auto' }}>
                                        <table style={{ minWidth: '800px', width: '100%' }}>
                                            <thead>
                                                <tr>
                                                    <th>First Name</th>
                                                    <th>Last Name</th>
                                                    <th>Email</th>
                                                    <th>Password</th>
                                                    <th>Role</th>
                                                    <th>Phone</th>
                                                    <th style={{ width: '40px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bulkData.map((row, index) => {
                                                    const hasError = row.errors && row.errors.length > 0;
                                                    return (
                                                        <Fragment key={row.id}>
                                                            <tr style={{ background: hasError ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                                                                <td style={{ padding: '8px' }}>
                                                                    <input className="form-control" style={{ padding: '6px', fontSize: '13px', borderColor: (!row.first_name && hasError) ? 'var(--danger)' : 'var(--border)' }} value={row.first_name} onChange={e => handleBulkDataChange(index, 'first_name', e.target.value)} />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <input className="form-control" style={{ padding: '6px', fontSize: '13px', borderColor: (!row.last_name && hasError) ? 'var(--danger)' : 'var(--border)' }} value={row.last_name} onChange={e => handleBulkDataChange(index, 'last_name', e.target.value)} />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <input className="form-control" style={{ padding: '6px', fontSize: '13px', borderColor: (!row.email && hasError) ? 'var(--danger)' : 'var(--border)' }} value={row.email} onChange={e => handleBulkDataChange(index, 'email', e.target.value)} />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <input className="form-control" type="text" style={{ padding: '6px', fontSize: '13px', borderColor: (!row.password && hasError) ? 'var(--danger)' : 'var(--border)' }} value={row.password} onChange={e => handleBulkDataChange(index, 'password', e.target.value)} />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <select className="form-control" style={{ padding: '6px', fontSize: '13px', borderColor: (!row.role_name && hasError) ? 'var(--danger)' : 'var(--border)' }} value={roles.find(r => r.name.toLowerCase() === row.role_name?.toLowerCase())?.name || row.role_name} onChange={e => handleBulkDataChange(index, 'role_name', e.target.value)}>
                                                                        <option value="">Select...</option>
                                                                        {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                                                        {/* If the Excel role is invalid, show it so the user sees it's wrong */}
                                                                        {row.role_name && !roles.find(r => r.name.toLowerCase() === row.role_name.toLowerCase()) && (
                                                                            <option value={row.role_name}>{row.role_name} (Invalid)</option>
                                                                        )}
                                                                    </select>
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <input className="form-control" style={{ padding: '6px', fontSize: '13px' }} value={row.phone} onChange={e => handleBulkDataChange(index, 'phone', e.target.value)} />
                                                                </td>
                                                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                                                    <button className="btn-icon" style={{ color: 'var(--danger)', padding: '4px' }} onClick={() => handleRemoveRow(index)}>✕</button>
                                                                </td>
                                                            </tr>
                                                            {hasError && (
                                                                <tr style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                                                                    <td colSpan="7" style={{ padding: '4px 12px 12px 12px', color: 'var(--danger)', fontSize: '12px', borderBottom: '1px solid var(--border)' }}>
                                                                        ⚠️ {row.errors.join(' | ')}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            {row.warnings && row.warnings.length > 0 && (
                                                                <tr style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
                                                                    <td colSpan="7" style={{ padding: '4px 12px 12px 12px', color: 'var(--warning)', fontSize: '12px', borderBottom: '1px solid var(--border)' }}>
                                                                        ℹ️ {row.warnings.join(' | ')}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {bulkData.length === 0 && (
                                            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No data to show. Add a row below.</p>
                                        )}
                                        <button type="button" className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={handleAddRow}>
                                            <HiOutlinePlus /> Add Row
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setBulkModal(false)} disabled={bulkUploading}>
                                {bulkResult ? 'Close' : 'Cancel'}
                            </button>
                            {!bulkResult && bulkStep === 1 && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleBulkValidate}
                                    disabled={!bulkFile || bulkUploading}
                                >
                                    {bulkUploading ? 'Parsing...' : 'Next'}
                                </button>
                            )}
                            {!bulkResult && bulkStep === 2 && (() => {
                                const isUploadDisabled = bulkUploading || bulkData.length === 0 || bulkData.some(row => row.errors && row.errors.length > 0);
                                return (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleBulkConfirm}
                                        disabled={isUploadDisabled}
                                        style={{
                                            backgroundColor: isUploadDisabled ? 'var(--text-muted)' : '',
                                            borderColor: isUploadDisabled ? 'var(--text-muted)' : '',
                                            cursor: isUploadDisabled ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {bulkUploading ? 'Uploading...' : 'Upload Data'}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* User Detail Modal */}
            {userDetailModal && (
                <div className="modal-overlay" onClick={() => setUserDetailModal(false)}>
                    <div className="modal" style={{ width: '100%', maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>User Details</h3>
                            <button className="btn-icon" onClick={() => setUserDetailModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {userDetailLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                                    <div className="spinner" />
                                </div>
                            ) : selectedUserDetail ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '8px 0' }}>
                                    {/* Header Section */}
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ 
                                            width: '72px', height: '72px', borderRadius: '50%', 
                                            background: selectedUserDetail.role_side === 'consulting' ? 'var(--accent)' : 'var(--success)', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            fontSize: '28px', fontWeight: 700, color: 'white',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                        }}>
                                            {selectedUserDetail.first_name[0]}{selectedUserDetail.last_name[0]}
                                        </div>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {selectedUserDetail.first_name} {selectedUserDetail.last_name}
                                            </h2>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '15px', color: 'var(--text-muted)' }}>
                                                {selectedUserDetail.email}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Profile Information */}
                                    <div style={{ 
                                        background: 'var(--bg-card)', 
                                        borderRadius: '12px', 
                                        border: '1px solid var(--border)', 
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)', 
                                        padding: '24px' 
                                    }}>
                                        <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Profile Information</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                                            <div>
                                                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Role</strong>
                                                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{selectedUserDetail.role_name}</span>
                                            </div>
                                            <div>
                                                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Organization</strong>
                                                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{selectedUserDetail.organization_name || 'Faber Infinite'}</span>
                                            </div>
                                            <div>
                                                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Phone</strong>
                                                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{selectedUserDetail.phone || '—'}</span>
                                            </div>
                                            <div>
                                                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Status</strong>
                                                <span style={{ 
                                                    display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                                                    background: selectedUserDetail.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: selectedUserDetail.is_active ? 'var(--success)' : 'var(--danger)'
                                                }}>
                                                    {selectedUserDetail.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Assignments & Projects */}
                                    <div style={{ 
                                        background: 'var(--bg-card)', 
                                        borderRadius: '12px', 
                                        border: '1px solid var(--border)', 
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)', 
                                        padding: '24px' 
                                    }}>
                                        <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            Active Assignments ({selectedUserDetail.active_assignments?.length || 0})
                                        </h4>
                                        {selectedUserDetail.active_assignments && selectedUserDetail.active_assignments.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                {selectedUserDetail.active_assignments.map(a => (
                                                    <div key={a.id} style={{ 
                                                        background: 'var(--bg-primary)', border: '1px solid var(--border)', 
                                                        borderRadius: '10px', padding: '16px'
                                                    }}>
                                                        <div style={{ 
                                                            fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', 
                                                            display: 'flex', alignItems: 'center', gap: '10px' 
                                                        }}>
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                                                            {a.name}
                                                        </div>
                                                        
                                                        {/* Project Subpoints */}
                                                        {a.projects && a.projects.length > 0 ? (
                                                            <div style={{ marginTop: '12px', paddingLeft: '20px' }}>
                                                                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {a.projects.map(p => (
                                                                        <li key={p.id} style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                                                                            {p.name}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ) : (
                                                            <div style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                No active projects in this assignment
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ 
                                                padding: '24px', textAlign: 'center', background: 'var(--bg-primary)', 
                                                borderRadius: '8px', border: '1px solid var(--border)' 
                                            }}>
                                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>This user is not currently assigned to any active assignments.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <p style={{ color: 'var(--danger)', margin: 0 }}>Failed to load user details.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
