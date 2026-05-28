import { useEffect, useState } from 'react';
import api from '../api';
import { HiOutlineCollection, HiOutlineDownload, HiOutlinePencil, HiOutlinePlus, HiOutlineTrash, HiOutlineUpload, HiOutlineX, HiOutlineDotsVertical, HiOutlineArrowLeft } from 'react-icons/hi';

export default function CCTsPanel() {
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [planDetails, setPlanDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState(null);
    const [form, setForm] = useState({});
    const [bulkModal, setBulkModal] = useState(false);
    const [bulkStep, setBulkStep] = useState(1);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkRows, setBulkRows] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkError, setBulkError] = useState('');
    const [showMobileActions, setShowMobileActions] = useState(false);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const res = await api.get('/ccts');
            setPlans(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadPlanDetails = async (id) => {
        try {
            const res = await api.get(`/ccts/${id}`);
            setPlanDetails(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    useEffect(() => {
        if (selectedPlanId) loadPlanDetails(selectedPlanId);
    }, [selectedPlanId]);

    const openModal = (type, parentId = null, editData = null) => {
        setModalConfig({ type, parentId, editData });
        if (type === 'plan') setForm(editData ? { ...editData } : { name: '', description: '' });
        if (type === 'category') setForm(editData ? { ...editData } : { name: '', description: '' });
        if (type === 'particular') setForm(editData ? { ...editData } : { name: '', description: '' });
    };

    const closeModal = () => setModalConfig(null);

    const openBulkModal = () => {
        if (!selectedPlanId) return;
        setBulkModal(true);
        setBulkStep(1);
        setBulkFile(null);
        setBulkRows([]);
        setBulkError('');
    };

    const handleDownloadBulkSample = async () => {
        try {
            const res = await api.get('/ccts/bulk/upload/sample-excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(
                new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'sample_cct.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setBulkError(err.response?.data?.error || 'Failed to download sample.');
        }
    };

    const validateBulkRowsLocally = (rows) => {
        let currentCategoryName = '';
        return rows.map((row) => {
            const categoryNameRaw = String(row.category_name || '').trim();
            const particularName = String(row.particular_name || '').trim();
            const errors = [];

            if (categoryNameRaw) currentCategoryName = categoryNameRaw;
            if (!currentCategoryName) errors.push('Category Name is required on first row of each category block');
            if (!particularName) errors.push('Particular Name is required');

            return { ...row, category_name: currentCategoryName, particular_name: particularName, errors };
        });
    };

    const handleValidateBulk = async () => {
        if (!bulkFile || !selectedPlanId) return;
        setBulkLoading(true);
        setBulkError('');
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            const res = await api.post(`/ccts/${selectedPlanId}/upload/validate`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setBulkRows(res.data.rows || []);
            setBulkStep(2);
        } catch (err) {
            setBulkError(err.response?.data?.error || 'Failed to validate upload file.');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkConfirm = async () => {
        if (!selectedPlanId) return;
        setBulkLoading(true);
        setBulkError('');
        try {
            const rows = validateBulkRowsLocally(bulkRows);
            setBulkRows(rows);
            if (rows.some((r) => (r.errors || []).length > 0)) {
                setBulkError('Please fix row errors before applying.');
                setBulkLoading(false);
                return;
            }
            await api.post(`/ccts/${selectedPlanId}/upload/confirm`, { rows });
            await loadPlanDetails(selectedPlanId);
            setBulkModal(false);
            setBulkStep(1);
            setBulkRows([]);
            setBulkFile(null);
        } catch (err) {
            setBulkError(err.response?.data?.error || 'Failed to apply uploaded rows.');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const { type, parentId, editData } = modalConfig;
            if (!form.name?.trim()) {
                const label = type === 'plan' ? 'Plan name' : type === 'category' ? 'Category name' : 'Particular name';
                return alert(`${label} is required.`);
            }

            if (type === 'plan') {
                if (editData) {
                    await api.put(`/ccts/${editData.id}`, form);
                    await loadPlanDetails(editData.id);
                } else {
                    const res = await api.post('/ccts', form);
                    setSelectedPlanId(res.data.id);
                }
                await fetchPlans();
            } else if (type === 'category') {
                if (editData) await api.put(`/ccts/categories/${editData.id}`, form);
                else await api.post(`/ccts/${parentId}/categories`, form);
                await loadPlanDetails(selectedPlanId);
            } else if (type === 'particular') {
                if (editData) await api.put(`/ccts/particulars/${editData.id}`, form);
                else await api.post(`/ccts/categories/${parentId}/particulars`, form);
                await loadPlanDetails(selectedPlanId);
            }
            closeModal();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save.');
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm(`Delete this ${type}?`)) return;
        try {
            if (type === 'plan') {
                await api.delete(`/ccts/${id}`);
                setSelectedPlanId(null);
                setPlanDetails(null);
                await fetchPlans();
            } else if (type === 'category') {
                await api.delete(`/ccts/categories/${id}`);
                await loadPlanDetails(selectedPlanId);
            } else if (type === 'particular') {
                await api.delete(`/ccts/particulars/${id}`);
                await loadPlanDetails(selectedPlanId);
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Delete failed.');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className={`fade-in service-builder-container ${selectedPlanId ? 'has-selection' : ''}`}>
            <div className="service-builder-sidebar">
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Client Commitment Trackers</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => openModal('plan')}><HiOutlinePlus /> Add</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {plans.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedPlanId(p.id)}
                            style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: selectedPlanId === p.id ? 'var(--bg-secondary)' : 'transparent',
                                borderLeft: selectedPlanId === p.id ? '3px solid var(--accent)' : '3px solid transparent',
                            }}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        </div>
                    ))}
                    {plans.length === 0 && <div style={{ padding: '20px', color: 'var(--text-muted)' }}>No ccts found.</div>}
                </div>
            </div>

            <div className="service-builder-main">
                {planDetails ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }} className="service-detail-scroll-area">
                        <div style={{ marginBottom: '24px' }}>
                            <button 
                                className="btn btn-secondary btn-sm mobile-back-btn" 
                                onClick={() => setSelectedPlanId(null)}
                                style={{ marginBottom: '16px' }}
                            >
                                <HiOutlineArrowLeft /> Back to Trackers
                            </button>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, paddingRight: '24px' }}>
                                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{planDetails.name}</h1>
                                </div>
                                <div className="desktop-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    <button className="btn-icon" onClick={() => openModal('plan', null, planDetails)} title="Edit Plan">
                                        <HiOutlinePencil />
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={() => openModal('category', planDetails.id)}>
                                        <HiOutlinePlus /> Add Category
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={openBulkModal}>
                                        <HiOutlineUpload /> Upload Excel
                                    </button>
                                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete('plan', planDetails.id)}>
                                        <HiOutlineTrash /> Delete Plan
                                    </button>
                                </div>
                                <div className="mobile-actions-toggle">
                                    <button className="btn-icon" onClick={() => setShowMobileActions(!showMobileActions)}>
                                        <HiOutlineDotsVertical />
                                    </button>
                                    {showMobileActions && (
                                        <div className="mobile-actions-dropdown fade-in">
                                            <button className="mobile-action-btn" onClick={() => { setShowMobileActions(false); openModal('plan', null, planDetails); }}>
                                                <HiOutlinePencil /> Edit Plan
                                            </button>
                                            <button className="mobile-action-btn" onClick={() => { setShowMobileActions(false); openModal('category', planDetails.id); }}>
                                                <HiOutlinePlus /> Add Category
                                            </button>
                                            <button className="mobile-action-btn" onClick={() => { setShowMobileActions(false); openBulkModal(); }}>
                                                <HiOutlineUpload /> Upload Excel
                                            </button>
                                            <button className="mobile-action-btn danger" onClick={() => { setShowMobileActions(false); handleDelete('plan', planDetails.id); }}>
                                                <HiOutlineTrash /> Delete Plan
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{planDetails.description || 'No description provided.'}</p>
                        </div>

                        {(planDetails.categories || []).length === 0 ? (
                            <div className="empty-state">
                                <div className="icon"><HiOutlineCollection /></div>
                                <h3>No Categories Yet</h3>
                                <p>Add a category to start building this cct.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {planDetails.categories.map((category, idx) => (
                                    <div key={category.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', background: 'var(--bg-secondary)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                Category {idx + 1}: {category.name || '-'}
                                            </h3>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-icon" onClick={() => openModal('particular', category.id)} title="Add Particular"><HiOutlinePlus /></button>
                                                <button className="btn-icon" onClick={() => openModal('category', planDetails.id, category)} title="Edit Category"><HiOutlinePencil /></button>
                                                <button className="btn-icon" onClick={() => handleDelete('category', category.id)} title="Delete Category" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                            </div>
                                        </div>
                                        {category.description && (
                                            <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '12px', fontSize: '13px' }}>
                                                {category.description}
                                            </p>
                                        )}

                                        {(category.particulars || []).length === 0 ? (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>No particulars yet.</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {category.particulars.map((particular) => (
                                                    <div
                                                        key={particular.id}
                                                        style={{
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '14px 12px',
                                                            background: 'var(--bg-primary)',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            gap: '12px',
                                                            alignItems: 'flex-start',
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: particular.description ? '4px' : 0 }}>
                                                                {particular.name}
                                                            </div>
                                                            {particular.description && (
                                                                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.45 }}>
                                                                    {particular.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button className="btn-icon" onClick={() => openModal('particular', category.id, particular)} title="Edit Particular"><HiOutlinePencil /></button>
                                                            <button className="btn-icon" onClick={() => handleDelete('particular', particular.id)} title="Delete Particular" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        Select an cct to view details
                    </div>
                )}
            </div>

            {modalConfig && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                {modalConfig.type === 'plan' && (modalConfig.editData ? 'Edit Client Commitment Tracker' : 'Create Client Commitment Tracker')}
                                {modalConfig.type === 'category' && (modalConfig.editData ? 'Edit Category' : 'Add Category')}
                                {modalConfig.type === 'particular' && (modalConfig.editData ? 'Edit Particular' : 'Add Particular')}
                            </h2>
                            <button className="btn-icon" onClick={closeModal}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input required className="form-control" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input className="form-control" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {bulkModal && (
                <div className="modal-overlay" onClick={() => setBulkModal(false)}>
                    <div className="modal" style={{ maxWidth: '1100px', width: '94vw' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Upload Client Commitment Tracker Rows</h2>
                            <button className="btn-icon" onClick={() => setBulkModal(false)}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body">
                            {bulkError && <div className="login-error" style={{ marginBottom: '12px' }}>{bulkError}</div>}
                            {bulkStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                        Upload a single-sheet Excel with only two columns: Category Name and Particular Name.
                                        {' '}For rows under same category, keep Category Name blank after first row.
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input type="file" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} />
                                        <button type="button" className="btn btn-secondary" onClick={handleDownloadBulkSample}>
                                            <HiOutlineDownload /> Download Sample
                                        </button>
                                    </div>
                                </div>
                            )}
                            {bulkStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Read-only preview of parsed rows.</div>
                                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px', maxHeight: '58vh', overflowY: 'auto' }}>
                                        <table style={{ minWidth: '720px' }}>
                                            <thead>
                                                <tr>
                                                    <th>Category Name</th>
                                                    <th>Particular Name</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bulkRows.map((row, idx) => (
                                                    <tr key={row.id || idx}>
                                                        <td style={{ minWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.category_name || '-'}</td>
                                                        <td style={{ minWidth: '420px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.particular_name || '-'}</td>
                                                    </tr>
                                                ))}
                                                {bulkRows.map((row, idx) => (
                                                    (row.errors || []).length > 0 && (
                                                        <tr key={`err-${row.id || idx}`}>
                                                            <td colSpan={2} style={{ color: 'var(--danger)', fontSize: '12px' }}>
                                                                Row {row.row_number || idx + 2}: {row.errors.join(' | ')}
                                                            </td>
                                                        </tr>
                                                    )
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setBulkModal(false)} disabled={bulkLoading}>Cancel</button>
                            {bulkStep === 1 && (
                                <button type="button" className="btn btn-primary" onClick={handleValidateBulk} disabled={!bulkFile || bulkLoading}>
                                    {bulkLoading ? 'Validating...' : 'Preview'}
                                </button>
                            )}
                            {bulkStep === 2 && (
                                <button type="button" className="btn btn-primary" onClick={handleBulkConfirm} disabled={bulkLoading || bulkRows.some((r) => (r.errors || []).length > 0)}>
                                    {bulkLoading ? 'Applying...' : 'Replace Categories & Particulars'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
