import { useState, useEffect } from 'react';
import api from '../api';
import CCTsPanel from './CCTsPanel';
import { 
    HiOutlinePlus, HiOutlineTrash, HiOutlineCollection, 
    HiOutlineDocumentAdd, HiOutlineX, HiOutlinePaperClip, HiOutlinePencil,
    HiOutlineDocumentText, HiOutlineArrowLeft, HiOutlineExternalLink, HiOutlineUpload, HiOutlineDownload, HiOutlineTable
} from 'react-icons/hi';

function toRoman(num) {
    if (num === 0) return '0';
    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let str = '';
    for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
    }
    return str;
}

export default function ServicesPage() {
    const [activeBuilderTab, setActiveBuilderTab] = useState('services');
    const [services, setServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState(null);
    const [serviceDetails, setServiceDetails] = useState(null);
    
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDocumentManager, setShowDocumentManager] = useState(false);
    const [bulkModal, setBulkModal] = useState(false);
    const [bulkStep, setBulkStep] = useState(1);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkRows, setBulkRows] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkError, setBulkError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/services');
            setServices(res.data);
            if (!selectedServiceId && res.data.length > 0) {
                setSelectedServiceId(res.data[0].id);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const loadServiceDetails = async (id) => {
        try {
            const res = await api.get(`/services/${id}`);
            setServiceDetails(res.data);
        } catch (e) {
            console.error("Failed to load details");
        }
    };

    const loadDocs = async (id) => {
        try {
            const res = await api.get(`/services/reference_documents/all?service_id=${id}`);
            setDocs(res.data);
        } catch (e) {
            console.error("Failed to load documents");
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedServiceId) {
            loadServiceDetails(selectedServiceId);
            loadDocs(selectedServiceId);
            setShowDocumentManager(false);
        }
    }, [selectedServiceId]);

    // UI Modals
    const [modalConfig, setModalConfig] = useState(null); // { type: 'service'|'step'|'task'|'doc', parentId: null, editData: null }
    const [form, setForm] = useState({});

    const openModal = (type, parentId, editData = null) => {
        setModalConfig({ type, parentId, editData });
        if (type === 'service') setForm(editData ? { ...editData } : { name: '', code: '', description: '' });
        if (type === 'step') setForm(editData ? { ...editData } : { name: '', description: '' });
        if (type === 'task') setForm(editData ? { ...editData } : { name: '', description: '', default_duration_days: '' });
        if (type === 'doc') setForm({ document_id: '' });
        if (type === 'doc_create') setForm(editData ? { ...editData } : { name: '', file_url: '', description: '' });
    };

    const closeModal = () => setModalConfig(null);

    const openBulkModal = () => {
        if (!selectedServiceId) return;
        setBulkModal(true);
        setBulkStep(1);
        setBulkFile(null);
        setBulkRows([]);
        setBulkError('');
    };

    const handleDownloadBulkSample = async () => {
        try {
            const res = await api.get('/services/bulk/upload-steps/sample-excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(
                new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'sample_service_steps.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setBulkError(err.response?.data?.error || 'Failed to download sample.');
        }
    };

    const handleValidateBulk = async () => {
        if (!bulkFile || !selectedServiceId) return;
        setBulkLoading(true);
        setBulkError('');
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            const res = await api.post(`/services/${selectedServiceId}/upload-steps/validate`, formData, {
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

    const validateBulkRowsLocally = (rows) => {
        let currentStepName = '';
        let currentStepHasTask = false;

        return rows.map((row) => {
            const errors = [];
            const stepRaw = String(row.step || '').trim();
            const taskDescription = String(row.task_description || '').trim();
            const standardReferenceName = String(row.standard_reference_name || '').trim();
            const referenceLink = String(row.reference_link || '').trim();
            const hasReferenceName = !!standardReferenceName;
            const hasReferenceLink = !!referenceLink;
            const hasAnyReferenceValue = !!standardReferenceName || !!referenceLink;

            if (stepRaw) {
                currentStepName = stepRaw;
                currentStepHasTask = false;
            } else if (!currentStepName) {
                errors.push('Step is required on the first row of each step block');
            }

            if (!hasReferenceName && hasReferenceLink) {
                errors.push('Standard for Reference Name is required when Reference Link is provided');
            }
            if (referenceLink && !(referenceLink.startsWith('http://') || referenceLink.startsWith('https://'))) {
                errors.push('Reference Link must start with http:// or https://');
            }

            if (!taskDescription) {
                if (hasAnyReferenceValue && !currentStepHasTask) {
                    errors.push('Reference-only row requires a previous task in the same step');
                }
                if (!hasAnyReferenceValue) {
                    errors.push('Task/Description is required');
                }
            } else {
                currentStepHasTask = true;
            }

            return {
                ...row,
                step: stepRaw,
                step_name: currentStepName || '',
                task_description: taskDescription,
                standard_reference_name: standardReferenceName,
                reference_link: referenceLink,
                errors,
            };
        });
    };

    const handleBulkRowChange = (index, field, value) => {
        const next = bulkRows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
        setBulkRows(validateBulkRowsLocally(next));
    };

    const handleBulkConfirm = async () => {
        if (!selectedServiceId) return;
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

            await api.post(`/services/${selectedServiceId}/upload-steps/confirm`, { rows });
            await loadServiceDetails(selectedServiceId);
            await loadDocs(selectedServiceId);
            setBulkModal(false);
            setBulkStep(1);
            setBulkRows([]);
            setBulkFile(null);
        } catch (err) {
            setBulkError(err.response?.data?.error || 'Failed to apply uploaded steps.');
        } finally {
            setBulkLoading(false);
        }
    };

    const checkProjectsAndConfirm = async (actionDesc) => {
        if (!selectedServiceId) return true;
        try {
            const r = await api.get(`/projects?service_id=${selectedServiceId}`);
            const projects = r.data;
            if (projects.length > 0) {
                const projectList = projects.map(p => `• ${p.name}`).join('\n');
                return window.confirm(`This service is currently used by the following projects:\n\n${projectList}\n\nAny changes will instantly ripple out and affect these projects. Are you sure you want to ${actionDesc}?`);
            }
        } catch (e) {
            console.error(e);
        }
        return true;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const { type, parentId } = modalConfig;
            
            // Validate Empty Fields
            if (type === 'service' && (!form.name.trim() || !form.code.trim())) return alert("Name and Code are required.");
            if (type === 'task' && !form.name.trim()) return alert("Task name is required.");
            if (type === 'doc' && !form.document_id) return alert("Please select a document.");
            if (type === 'doc_create' && !form.name.trim()) return alert("Name is required.");

            // Check Deep Sync Impact if modifying an existing service component
            if (type !== 'service' || modalConfig.editData) {
                const isConfirmed = await checkProjectsAndConfirm("save these changes");
                if (!isConfirmed) return;
            }

            if (type === 'service') {
                if (modalConfig.editData) {
                    await api.put(`/services/${modalConfig.editData.id}`, form);
                    loadServiceDetails(modalConfig.editData.id);
                } else {
                    const res = await api.post('/services', form);
                    setSelectedServiceId(res.data.id);
                }
                fetchData();
            } else if (type === 'step') {
                if (modalConfig.editData) await api.put(`/services/steps/${modalConfig.editData.id}`, form);
                else await api.post(`/services/${parentId}/steps`, form);
                loadServiceDetails(selectedServiceId);
            } else if (type === 'task') {
                if (modalConfig.editData) await api.put(`/services/tasks/${modalConfig.editData.id}`, form);
                else await api.post(`/services/steps/${parentId}/tasks`, form);
                loadServiceDetails(selectedServiceId);
            } else if (type === 'doc') {
                await api.post(`/services/tasks/${parentId}/documents`, form);
                loadServiceDetails(selectedServiceId);
            } else if (type === 'doc_create') {
                if (modalConfig.editData) {
                    await api.put(`/services/reference_documents/${modalConfig.editData.id}`, form);
                } else {
                    await api.post(`/services/reference_documents`, { ...form, service_id: selectedServiceId });
                }
                loadDocs(selectedServiceId);
                loadServiceDetails(selectedServiceId); // refresh names on task pills
            }
            closeModal();
        } catch (err) {
            alert(err.response?.data?.error || "An error occurred.");
        }
    };

    const handleDelete = async (type, id, parentId = null) => {
        // Only run the generic confirm if we aren't about to run the deep sync confirm
        if (type !== 'service' && type !== 'doc_system' && type !== 'doc' && type !== 'step' && type !== 'task') {
             if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
        }

        if (type === 'doc') {
            if (!window.confirm('Are you sure you want to unlink this document from this task?')) return;
        }

        if (type === 'doc_system') {
            if (!window.confirm('Are you sure you want to permanently delete this document from the system? It will automatically be removed from all associated tasks. (Deep Sync Warning follows)')) return;
        }

        const isConfirmed = await checkProjectsAndConfirm(`delete this ${type === 'doc_system' ? 'document' : type}`);
        if (!isConfirmed) return;

        try {
            if (type === 'service') {
                await api.delete(`/services/${id}`);
                setSelectedServiceId(null);
                fetchData();
            } else if (type === 'step') {
                await api.delete(`/services/steps/${id}`);
                loadServiceDetails(selectedServiceId);
            } else if (type === 'task') {
                await api.delete(`/services/tasks/${id}`);
                loadServiceDetails(selectedServiceId);
            } else if (type === 'doc') {
                await api.delete(`/services/tasks/${parentId}/documents/${id}`);
                loadServiceDetails(selectedServiceId);
            } else if (type === 'doc_system') {
                await api.delete(`/services/reference_documents/${id}`);
                loadDocs(selectedServiceId);
                loadServiceDetails(selectedServiceId);
            }
        } catch(e) {
            alert(e.response?.data?.error || "Delete failed.");
        }
    };

    if (activeBuilderTab === 'services' && loading) return <div>Loading...</div>;

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 100px)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    className={`btn btn-sm ${activeBuilderTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveBuilderTab('services')}
                >
                    Services
                </button>
                <button
                    className={`btn btn-sm ${activeBuilderTab === 'cct' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveBuilderTab('cct')}
                >
                    Client Commitment Tracker
                </button>
            </div>
            {activeBuilderTab === 'cct' ? (
                <CCTsPanel />
            ) : (
        <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 160px)' }}>
            {/* Sidebar List */}
            <div style={{ width: '300px', flexShrink: 0, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Services</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => openModal('service')}><HiOutlinePlus/> Add</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {services.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => setSelectedServiceId(s.id)}
                            style={{ 
                                padding: '16px 20px', 
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: selectedServiceId === s.id ? 'var(--bg-secondary)' : 'transparent',
                                borderLeft: selectedServiceId === s.id ? '3px solid var(--primary)' : '3px solid transparent'
                            }}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Code: {s.code}</div>
                        </div>
                    ))}
                    {services.length === 0 && <div style={{ padding: '20px', color: 'var(--text-muted)' }}>No services found.</div>}
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {serviceDetails ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                        <div style={{ marginBottom: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, paddingRight: '24px' }}>
                                        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{serviceDetails.name}</h1>
                                        <button className="btn-icon" onClick={() => openModal('service', null, serviceDetails)} title="Edit Service">
                                            <HiOutlinePencil />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => openModal('step', serviceDetails.id)}>
                                            <HiOutlinePlus /> Add Step
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={openBulkModal}>
                                            <HiOutlineDocumentAdd /> Import Excel
                                        </button>
                                        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete('service', serviceDetails.id)}>
                                            <HiOutlineTrash /> Delete Service
                                        </button>
                                    </div>
                                </div>
                            <div>
                                <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0', wordBreak: 'break-word', lineHeight: '1.5' }}>{serviceDetails.description}</p>
                                <button 
                                    className="btn btn-sm" 
                                    style={{ 
                                        background: 'rgba(37, 99, 235, 0.1)', 
                                        color: 'var(--primary)', 
                                        border: '1px solid rgba(37, 99, 235, 0.2)',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    onClick={() => setShowDocumentManager(true)}
                                >
                                    <HiOutlineDocumentText size={16} /> Manage Standard References
                                </button>
                            </div>
                        </div>

                        {showDocumentManager ? (
                            <div className="document-manager fade-in">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setShowDocumentManager(false)}>
                                        <HiOutlineArrowLeft /> Back to Steps & Tasks
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={() => openModal('doc_create')}>
                                        <HiOutlinePlus /> Upload New Document
                                    </button>
                                </div>
                                
                                {docs.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {docs.map(doc => (
                                            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ fontSize: '24px', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(37,99,235,0.1)', borderRadius: '8px' }}>
                                                        <HiOutlineDocumentText />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>{doc.name}</div>
                                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                            {doc.description || 'No description provided.'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                    {doc.file_url && (
                                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            View <HiOutlineExternalLink />
                                                        </a>
                                                    )}
                                                    <button className="btn-icon" onClick={() => openModal('doc_create', null, doc)} title="Edit Document" style={{ color: 'var(--text-secondary)' }}><HiOutlinePencil /></button>
                                                    <button className="btn-icon" onClick={() => handleDelete('doc_system', doc.id)} title="Delete Document" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="icon" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--primary)' }}><HiOutlineDocumentText /></div>
                                        <h3>No Reference Documents</h3>
                                        <p>Upload standard reference files to attach them to tasks in this service.</p>
                                    </div>
                                )}
                            </div>
                        ) : serviceDetails.steps?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {serviceDetails.steps.map((step, idx) => (
                                    <div key={step.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px', background: 'var(--bg-secondary)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Step {toRoman(idx)} {step.name ? `- ${step.name}` : ''}</h3>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-icon" onClick={() => openModal('task', step.id)} title="Add Task"><HiOutlinePlus /></button>
                                                <button className="btn-icon" onClick={() => openModal('step', serviceDetails.id, step)} title="Edit Step"><HiOutlinePencil /></button>
                                                <button className="btn-icon" onClick={() => handleDelete('step', step.id)} title="Delete Step" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                            </div>
                                        </div>
                                        
                                        {/* Tasks Loop */}
                                        {step.tasks?.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {step.tasks.map(task => (
                                                    <div key={task.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{task.name}</div>
                                                                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Duration: {task.default_duration_days || '-'} days</div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button className="btn-icon" onClick={() => openModal('doc', task.id)} title="Attach Reference Document" style={{ color: 'var(--primary)' }}><HiOutlineDocumentAdd /></button>
                                                                <button className="btn-icon" onClick={() => openModal('task', step.id, task)} title="Edit Task" style={{ color: 'var(--text-secondary)' }}><HiOutlinePencil /></button>
                                                                <button className="btn-icon" onClick={() => handleDelete('task', task.id)} title="Delete Task" style={{ color: 'var(--danger)' }}><HiOutlineTrash /></button>
                                                            </div>
                                                        </div>

                                                        {/* Reference Documents Loop */}
                                                        {task.documents?.length > 0 && (
                                                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Reference Documents</div>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                    {task.documents.map(doc => (
                                                                        <div key={doc.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                                                                            {doc.file_url ? <HiOutlinePaperClip /> : null}
                                                                            {doc.name}
                                                                            <HiOutlineX title="Unlink from this Task" style={{ cursor: 'pointer', marginLeft: '4px', color: 'var(--danger)' }} onClick={() => handleDelete('doc', doc.id, task.id)} />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks added to this step yet.</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="icon"><HiOutlineCollection /></div>
                                <h3>No Steps Yet</h3>
                                <p>Add a phase/step to begin building out this service's workflow.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        Select a service to view details
                    </div>
                )}
            </div>

            {/* Universal Modal */}
            {modalConfig && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                {modalConfig.type === 'service' && (modalConfig.editData ? "Edit Service" : "Create Service")}
                                {modalConfig.type === 'step' && (modalConfig.editData ? "Edit Step" : "Add Step")}
                                {modalConfig.type === 'task' && (modalConfig.editData ? "Edit Task" : "Add Task")}
                                {modalConfig.type === 'doc' && "Attach Document"}
                                {modalConfig.type === 'doc_create' && (modalConfig.editData ? "Edit Reference Document" : "Upload New Document")}
                            </h2>
                            <button className="btn-icon" onClick={closeModal}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {modalConfig.type === 'service' && (
                                    <>
                                        <div className="form-group"><label>Service Name *</label><input required className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Opex" /></div>
                                        <div className="form-group"><label>Service Code *</label><input required className="form-control" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. OPx" /></div>
                                        <div className="form-group"><label>Description</label><input className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                                    </>
                                )}
                                {modalConfig.type === 'step' && (
                                    <>
                                        <div className="form-group"><label>Step Name (Optional)</label><input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Pre-Audit (Optional)" /></div>
                                        <div className="form-group"><label>Description</label><input className="form-control" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
                                    </>
                                )}
                                {modalConfig.type === 'task' && (
                                    <>
                                        <div className="form-group"><label>Task Name *</label><input required className="form-control" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Data Collection" /></div>
                                        <div className="form-group"><label>Description</label><input className="form-control" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
                                        <div className="form-group"><label>Standard Duration (Days)</label><input type="number" className="form-control" value={form.default_duration_days || ''} onChange={e => setForm({...form, default_duration_days: parseInt(e.target.value)})} /></div>
                                    </>
                                )}
                                {modalConfig.type === 'doc' && (
                                    <>
                                        <div className="form-group">
                                            <label>Select Existing Reference Document *</label>
                                            <select required className="form-control" value={form.document_id} onChange={e => setForm({...form, document_id: e.target.value})}>
                                                <option value="">Select Document...</option>
                                                {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={() => openModal('doc_create')}
                                            >
                                                Upload New Document
                                            </button>
                                        </div>
                                    </>
                                )}
                                {modalConfig.type === 'doc_create' && (
                                    <>
                                        <div className="form-group"><label>Document Title *</label><input required className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. ISO 9001 Guidelines" /></div>
                                        <div className="form-group"><label>File Path / URL (Optional)</label><input type="url" className="form-control" value={form.file_url} onChange={e => setForm({...form, file_url: e.target.value})} placeholder="https://..." /></div>
                                        <div className="form-group"><label>Description</label><input className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                                    </>
                                )}
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
                    <div className="modal" style={{ maxWidth: '1500px', width: '96vw' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Upload Steps (Bulk)</h2>
                            <button className="btn-icon" onClick={() => setBulkModal(false)}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body">
                            {bulkError && <div className="login-error" style={{ marginBottom: '12px' }}>{bulkError}</div>}
                            {bulkStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                        Upload a single-sheet Excel with columns:
                                        {' '}Step, Task/Description, Standard for Reference Name(optional), Reference Link(optional).
                                        {' '}For each step block, fill Step only on the first row and leave it blank on following rows.
                                        {' '}To add multiple references for the same task, keep Task/Description blank on next row and fill reference name (link is optional).
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls"
                                            onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                                        />
                                        <button type="button" className="btn btn-secondary" onClick={handleDownloadBulkSample}>
                                            <HiOutlineDownload /> Download Sample
                                        </button>
                                    </div>
                                </div>
                            )}
                            {bulkStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        Read-only preview of parsed Excel rows.
                                    </div>
                                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px', maxHeight: '58vh', overflowY: 'auto' }}>
                                    <table style={{ minWidth: '1200px' }}>
                                        <thead>
                                            <tr>
                                                <th>Step</th>
                                                <th>Task/Description</th>
                                                <th>Standard for Reference Name(optional)</th>
                                                <th>Reference Link(optional)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkRows.map((row, index) => (
                                                <tr key={row.id || index}>
                                                    <td style={{ minWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.step || '-'}</td>
                                                    <td style={{ minWidth: '420px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.task_description || '-'}</td>
                                                    <td style={{ minWidth: '320px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.standard_reference_name || '-'}</td>
                                                    <td style={{ minWidth: '420px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.reference_link || '-'}</td>
                                                </tr>
                                            ))}
                                            {bulkRows.map((row, idx) => (
                                                (row.errors || []).length > 0 && (
                                                    <tr key={`err-${row.id || idx}`}>
                                                        <td colSpan={4} style={{ color: 'var(--danger)', fontSize: '12px' }}>
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
                                    {bulkLoading ? 'Applying...' : 'Replace Steps'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
            )}
        </div>
    );
}
