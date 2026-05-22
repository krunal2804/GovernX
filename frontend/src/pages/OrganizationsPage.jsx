import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineOfficeBuilding, HiOutlineEye } from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';

export default function OrganizationsPage() {
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editOrg, setEditOrg] = useState(null);
    const [form, setForm] = useState({ name: '', industry: '', city: '', state: '', country: '', phone: '', email: '', password: '' });
    const navigate = useNavigate();

    const fetchOrgs = () => {
        api.get('/organizations').then((r) => setOrgs(r.data)).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(fetchOrgs, []);

    const openAdd = () => { setEditOrg(null); setForm({ name: '', industry: '', city: '', state: '', country: '', phone: '', email: '', password: '' }); setShowModal(true); };
    const openEdit = (e, org) => { e.stopPropagation(); setEditOrg(org); setForm({ name: org.name, industry: org.industry || '', city: org.city || '', state: org.state || '', country: org.country || '', phone: org.phone || '', email: org.email || '', password: '' }); setShowModal(true); };

    const handleDelete = async (e, org) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete "${org.name}"? This will deactivate the client and all related data.`)) return;
        try {
            await api.delete(`/organizations/${org.id}`);
            fetchOrgs();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete client.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editOrg) {
                await api.put(`/organizations/${editOrg.id}`, form);
            } else {
                await api.post('/organizations', form);
            }
            setShowModal(false);
            fetchOrgs();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save client.');
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div className="fade-in">
            <Breadcrumb items={[
                { label: 'Home', path: '/' },
                { label: 'Clients', path: '/clients' }
            ]} />
            <div className="table-container">
                <div className="table-header">
                    <h2>All Clients ({orgs.length})</h2>
                    <button className="btn btn-primary btn-sm" onClick={openAdd}><HiOutlinePlus /> Add Client</button>
                </div>

                {orgs.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Industry</th>
                                <th>Location</th>
                                <th>Assignments</th>
                                <th>Projects</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orgs.map((org) => (
                                <tr key={org.id} onClick={() => navigate(`/clients/${org.id}`)} style={{ cursor: 'pointer' }}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{org.name}</td>
                                    <td>{org.industry || '—'}</td>
                                    <td>{[org.city, org.state, org.country].filter(Boolean).join(', ') || '—'}</td>
                                    <td><span className="badge badge-info">{org.assignment_count}</span></td>
                                    <td><span className="badge badge-purple">{org.project_count}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button className="btn-icon" onClick={(e) => openEdit(e, org)} title="Edit"><HiOutlinePencil /></button>
                                            <button className="btn-icon" onClick={(e) => handleDelete(e, org)} title="Delete" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="icon"><HiOutlineOfficeBuilding /></div>
                        <h3>No clients yet</h3>
                        <p>Add your first client company to get started.</p>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editOrg ? 'Edit Client' : 'Add Client'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Company Name *</label>
                                    <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. TATA" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Industry</label>
                                        <input className="form-control" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Manufacturing" />
                                    </div>
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="contact@company.com" />
                                    </div>
                                </div>
                                {!editOrg && (
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label>Password *</label>
                                        <input className="form-control" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Enter password for client login" />
                                    </div>
                                )}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>City</label>
                                        <input className="form-control" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
                                    </div>
                                    <div className="form-group">
                                        <label>State</label>
                                        <input className="form-control" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Country</label>
                                        <input className="form-control" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 12345 67890" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editOrg ? 'Save Changes' : 'Add Client'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
