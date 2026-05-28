import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import {
    HiOutlineArrowLeft,
    HiOutlineOfficeBuilding,
    HiOutlineUser,
    HiOutlinePhone,
    HiOutlineMail,
    HiOutlineBriefcase,
    HiOutlineCalendar,
    HiOutlineLocationMarker,
    HiOutlineClipboardList,
    HiOutlineTruck,
    HiOutlineShieldCheck,
    HiOutlineExclamation,
    HiOutlineDocumentText,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
} from 'react-icons/hi';
import Breadcrumb from '../components/Breadcrumb';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';

/* ---- Reusable Detail Field ---- */
function InfoField({ label, value, icon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {icon && <div style={{ color: 'var(--text-muted)', fontSize: '18px', marginTop: '1px', flexShrink: 0 }}>{icon}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                <div style={{ fontSize: '14px', color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: value ? 500 : 400, fontStyle: value ? 'normal' : 'italic', wordBreak: 'break-word' }}>
                    {value || 'Not provided'}
                </div>
            </div>
        </div>
    );
}

/* ---- Section Card ---- */
function SectionCard({ title, icon, children, accentColor = 'var(--accent)' }) {
    return (
        <div className="card" style={{ marginBottom: '20px', overflow: 'hidden' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '18px 24px', borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
            }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: `${accentColor}14`, color: accentColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                }}>{icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
            </div>
            <div style={{ padding: '12px 24px' }}>
                {children}
            </div>
        </div>
    );
}

/* ---- Confirmation Badge ---- */
function ConfirmBadge({ label, confirmed }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 16px', background: confirmed ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${confirmed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: 'var(--radius-md)',
        }}>
            {confirmed
                ? <HiOutlineCheckCircle style={{ color: '#10B981', fontSize: '20px', flexShrink: 0 }} />
                : <HiOutlineXCircle style={{ color: '#EF4444', fontSize: '20px', flexShrink: 0 }} />
            }
            <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                <div style={{ fontSize: '12px', color: confirmed ? '#10B981' : '#EF4444', fontWeight: 500 }}>
                    {confirmed ? 'Confirmed' : 'Not confirmed'}
                </div>
            </div>
        </div>
    );
}

export default function AssignmentInfoPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/assignments/${id}`)
            .then((res) => setAssignment(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!assignment) return <div className="empty-state"><h3>Assignment not found</h3></div>;

    const fromPath = location.state?.from || '/assignments';
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

    const logistics = assignment.logistics_arrangements || {};
    const logisticsCategories = [
        { key: 'travel', label: 'Travel' },
        { key: 'lodging', label: 'Lodging' },
        { key: 'boarding', label: 'Boarding' },
        { key: 'local_conveyance', label: 'Local Conveyance' },
    ];

    const teamMembers = assignment.team_members || [];
    const consultingDays = assignment.consulting_days || [];
    const projects = assignment.projects || [];

    // Group consulting days by team member
    const daysByMember = {};
    consultingDays.forEach((d) => {
        if (!daysByMember[d.team_member_id]) daysByMember[d.team_member_id] = [];
        daysByMember[d.team_member_id].push(d);
    });

    // Get unique period labels in order
    const periodLabels = [...new Set(consultingDays.map((d) => d.period_label))];

    const getProgressColor = (pct) => {
        return pct >= 50 ? 'green' : 'blue';
    };

    const breadcrumbItems = [
        { label: 'Home', path: '/' },
        { label: 'Assignments', path: '/assignments' },
        { label: assignment.name, path: `/assignments/${id}`, state: { from: fromPath } },
        { label: 'Assignment Info', path: `/assignments/${id}/info` },
    ];

    return (
        <div className="fade-in">
            <Breadcrumb items={breadcrumbItems} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button
                        onClick={() => navigate(`/assignments/${id}`, { state: { from: fromPath } })}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                            padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', transition: 'all 0.2s',
                        }}
                    >
                        <HiOutlineArrowLeft /> Back
                    </button>
                    <div>
                        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Assignment Information</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            All details for <strong>{assignment.name}</strong>
                        </p>
                    </div>
                </div>
                <span className={`badge ${getWorkflowStatusBadge(assignment.status)}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
                    {formatWorkflowStatus(assignment.status)}
                </span>
            </div>

            {/* Two-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                {/* ── Left Column ── */}
                <div>
                    {/* Assignment Overview */}
                    <SectionCard title="Assignment Overview" icon={<HiOutlineBriefcase />} accentColor="#2563EB">
                        <InfoField label="Assignment Name" value={assignment.name} icon={<HiOutlineClipboardList />} />
                        <InfoField label="Organization" value={assignment.organization_name} icon={<HiOutlineOfficeBuilding />} />
                        <InfoField label="Location" value={assignment.location} icon={<HiOutlineLocationMarker />} />
                        <InfoField label="Start Date" value={formatDate(assignment.start_date)} icon={<HiOutlineCalendar />} />
                        <InfoField label="Faber Point of Contact" value={assignment.faber_poc_name} icon={<HiOutlineUser />} />
                        <InfoField label="Created By" value={assignment.created_by_name} icon={<HiOutlineUser />} />
                        <InfoField label="Description" value={assignment.description} icon={<HiOutlineDocumentText />} />
                    </SectionCard>

                    {/* Top Management Details */}
                    <SectionCard title="Top Management Details" icon={<HiOutlineUser />} accentColor="#8B5CF6">
                        <InfoField label="Name" value={assignment.top_management_name} icon={<HiOutlineUser />} />
                        <InfoField label="Designation" value={assignment.top_management_designation} icon={<HiOutlineBriefcase />} />
                        <InfoField label="Mobile" value={assignment.top_management_mobile} icon={<HiOutlinePhone />} />
                        <InfoField label="Email" value={assignment.top_management_email} icon={<HiOutlineMail />} />
                    </SectionCard>

                    {/* Client POC */}
                    <SectionCard title="Point of Contact - Client" icon={<HiOutlineUser />} accentColor="#F59E0B">
                        <InfoField label="Name" value={assignment.client_poc_name} icon={<HiOutlineUser />} />
                        <InfoField label="Designation" value={assignment.client_poc_designation} icon={<HiOutlineBriefcase />} />
                        <InfoField label="Mobile" value={assignment.client_poc_mobile} icon={<HiOutlinePhone />} />
                        <InfoField label="Email" value={assignment.client_poc_email} icon={<HiOutlineMail />} />
                    </SectionCard>

                    {/* Logistics POC */}
                    <SectionCard title="Point of Contact - Logistics" icon={<HiOutlineTruck />} accentColor="#06B6D4">
                        <InfoField label="Name" value={assignment.logistics_poc_name} icon={<HiOutlineUser />} />
                        <InfoField label="Designation" value={assignment.logistics_poc_designation} icon={<HiOutlineBriefcase />} />
                        <InfoField label="Mobile" value={assignment.logistics_poc_mobile} icon={<HiOutlinePhone />} />
                        <InfoField label="Email" value={assignment.logistics_poc_email} icon={<HiOutlineMail />} />
                    </SectionCard>
                </div>

                {/* ── Right Column ── */}
                <div>
                    {/* Consulting Days */}
                    <SectionCard title="Consulting Days" icon={<HiOutlineCalendar />} accentColor="#10B981">
                        {teamMembers.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '13px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 700 }}>Team Member</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 700 }}>Title</th>
                                            {periodLabels.map((label, i) => (
                                                <th key={i} style={{ textAlign: 'center', padding: '10px 8px', fontSize: '12px', fontWeight: 700 }}>{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamMembers.map((tm) => {
                                            const memberDays = daysByMember[tm.id] || [];
                                            return (
                                                <tr key={tm.id}>
                                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{tm.first_name} {tm.last_name}</td>
                                                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{tm.title || 'Not provided'}</td>
                                                    {periodLabels.map((label, i) => {
                                                        const dayEntry = memberDays.find((d) => d.period_label === label);
                                                        return (
                                                            <td key={i} style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>
                                                                {dayEntry ? dayEntry.days : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>No consulting team assigned.</p>
                        )}
                    </SectionCard>

                    {/* Logistics Arrangement */}
                    <SectionCard title="Logistics Arrangement" icon={<HiOutlineTruck />} accentColor="#EC4899">
                        {logisticsCategories.some(c => logistics[c.key]) ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '13px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 700 }}>Category</th>
                                            <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 700 }}>Booked By</th>
                                            <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 700 }}>Paid By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logisticsCategories.map((cat) => {
                                            const item = logistics[cat.key] || {};
                                            return (
                                                <tr key={cat.key}>
                                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{cat.label}</td>
                                                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                                                        <span className="badge badge-blue" style={{ fontSize: '11px' }}>{item.book_by || 'Not provided'}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                                                        <span className="badge badge-green" style={{ fontSize: '11px' }}>{item.paid_by || 'Not provided'}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>No logistics arrangement details provided.</p>
                        )}
                    </SectionCard>

                    {/* Significant Confirmation */}
                    <SectionCard title="Significant Confirmation" icon={<HiOutlineShieldCheck />} accentColor="#10B981">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0' }}>
                            <ConfirmBadge label="Data Sharing NDA" confirmed={assignment.conf_data_sharing} />
                            <ConfirmBadge label="AAE Communication" confirmed={assignment.conf_aae_communication} />
                        </div>
                    </SectionCard>

                    {/* Special Instructions */}
                    <SectionCard title="Special Instructions" icon={<HiOutlineExclamation />} accentColor="#F59E0B">
                        <div style={{ padding: '12px 0', fontSize: '14px', color: assignment.special_instructions ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: assignment.special_instructions ? 'normal' : 'italic', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                            {assignment.special_instructions || 'No special instructions provided.'}
                        </div>
                    </SectionCard>
                </div>
            </div>

            {/* ── Projects Section (Full Width) ── */}
            <SectionCard title={`Projects (${projects.length})`} icon={<HiOutlineClipboardList />} accentColor="#2563EB">
                {projects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
                        {projects.map((p) => {
                            const total = p.task_total || 0;
                            const completed = p.task_completed || 0;
                            const progress = total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0;

                            return (
                                <div
                                    key={p.id}
                                    style={{
                                        padding: '16px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                    onClick={() => navigate(`/projects/${p.id}`)}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                        <div>
                                            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{p.name}</h4>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {p.service_name} {p.project_code ? `• ${p.project_code}` : ''}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span className={`badge ${getWorkflowStatusBadge(p.status)}`}>{formatWorkflowStatus(p.status)}</span>
                                            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{progress}%</span>
                                        </div>
                                    </div>
                                    <div className="progress-bar" style={{ height: '6px', background: 'var(--bg-primary)' }}>
                                        <div className={`fill ${getProgressColor(progress)}`} style={{ width: `${progress}%` }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>{completed} of {total} tasks done</span>
                                        {p.task_overdue > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{p.task_overdue} overdue</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>No projects created for this assignment.</p>
                )}
            </SectionCard>

            {/* Responsive override */}
            <style>{`
                @media (max-width: 1024px) {
                    .fade-in > div[style*="gridTemplateColumns: 1fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
