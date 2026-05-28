import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatWorkflowStatus, getWorkflowStatusBadge } from '../utils/workflowStatus';
import {
    HiOutlineOfficeBuilding,
    HiOutlineCollection,
    HiOutlineClipboardList,
    HiOutlineUsers,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineX,
    HiOutlineTrendingUp,
    HiOutlineChartPie,
} from 'react-icons/hi';
import {
    ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, ComposedChart,
    RadialBarChart, RadialBar,
    PieChart, Pie, Cell,
} from 'recharts';

function EmptyDashboard({ roleName }) {
    return (
        <div className="fade-in">
            <div className="empty-state" style={{ paddingTop: '120px' }}>
                <div className="icon">Under Construction</div>
                <h3>Welcome, {roleName}!</h3>
                <p>Your portal is coming soon. We're building features tailored for your role.</p>
            </div>
        </div>
    );
}

function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mediaQuery = window.matchMedia(query);
        const handleChange = () => setMatches(mediaQuery.matches);
        handleChange();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
}

/* ─── Skeleton Loading Component ─── */
function ClientPortalSkeleton() {
    const shimmer = `
        @keyframes clientShimmer {
            0% { background-position: -400px 0; }
            100% { background-position: 400px 0; }
        }
    `;
    const skeletonStyle = (w, h, mb = 0, br = '8px') => ({
        width: w, height: h, marginBottom: mb, borderRadius: br,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%)',
        backgroundSize: '800px 100%',
        animation: 'clientShimmer 1.4s ease infinite',
    });

    return (
        <div className="fade-in">
            <style>{shimmer}</style>
            {/* Banner skeleton */}
            <div style={skeletonStyle('100%', '120px', 24, '12px')} />

            {/* Stats skeleton */}
            <div className="dashboard-stat-grid" style={{ marginBottom: '28px' }}>
                {[...Array(4)].map((_, i) => <div key={i} style={skeletonStyle('100%', '100px', 0, '12px')} />)}
            </div>

            {/* Charts skeleton */}
            <div className="dashboard-chart-grid" style={{ marginBottom: '28px' }}>
                <div style={skeletonStyle('100%', '340px', 0, '12px')} />
                <div style={skeletonStyle('100%', '340px', 0, '12px')} />
            </div>

            {/* Gauge row skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
                {[...Array(3)].map((_, i) => <div key={i} style={skeletonStyle('100%', '260px', 0, '12px')} />)}
            </div>

            {/* Table skeleton */}
            <div style={skeletonStyle('100%', '300px', 0, '12px')} />
        </div>
    );
}

/* ─── Custom Tooltip for Line Chart ─── */
function CustomLineTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const filteredPayload = payload.filter((p) => p.dataKey !== 'Pending');
    if (!filteredPayload.length) return null;

    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
            padding: '14px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            fontSize: '13px', lineHeight: '1.6',
        }}>
            <div style={{ fontWeight: 700, color: '#0d131b', marginBottom: '6px', fontSize: '14px' }}>{label}</div>
            {filteredPayload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                    <span style={{ color: '#64748b' }}>{p.name}:</span>
                    <span style={{ fontWeight: 700, color: '#0d131b' }}>{p.value}{p.name === 'Progress' || p.name === 'Current Progress' ? '%' : ''}</span>
                </div>
            ))}
        </div>
    );
}

/* ─── Single Project Gauge Card ─── */
function ProjectGaugeCard({ project, assignments, onClick }) {
    const total = project.task_total || 0;
    const completed = project.task_completed || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const parentAssignment = assignments.find(a => a.projects?.some(p => p.id === project.id));

    const getColor = (pct) => {
        if (pct >= 50) return '#10B981';
        return '#2563EB';
    };

    const color = getColor(progress);
    const gaugeData = [{ value: progress, fill: color }];

    return (
        <div
            onClick={() => onClick(project.id)}
            style={{
                background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                padding: '20px', cursor: 'pointer', transition: 'all 0.25s ease',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = color; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = '#e4e8f0'; }}
        >
            {/* Top accent line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color, borderRadius: '14px 14px 0 0' }} />

            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0d131b', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {project.name}
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>
                    {parentAssignment?.name || 'Assignment'}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                <ResponsiveContainer width={160} height={140}>
                    <RadialBarChart
                        innerRadius="70%" outerRadius="100%"
                        data={gaugeData} startAngle={210} endAngle={-30}
                        barSize={12}
                    >
                        <RadialBar
                            background={{ fill: '#f1f5f9' }}
                            dataKey="value"
                            cornerRadius={10}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color, lineHeight: 1 }}>{progress}%</div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600, marginTop: '2px' }}>Complete</div>
                </div>
            </div>

            {/* Task stats footer */}
            <div style={{
                display: 'flex', justifyContent: 'space-around', marginTop: '8px',
                background: '#f8fafc', borderRadius: '8px', padding: '8px 4px',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#10B981' }}>{completed}</div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Done</div>
                </div>
                <div style={{ width: '1px', background: '#e4e8f0' }} />
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#F59E0B' }}>{project.task_in_progress || 0}</div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Active</div>
                </div>
                <div style={{ width: '1px', background: '#e4e8f0' }} />
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: project.task_overdue > 0 ? '#EF4444' : '#9CA3AF' }}>{project.task_overdue || 0}</div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Overdue</div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   CLIENT PORTAL — Main Component
   ═══════════════════════════════════════════ */
function ClientPortal({ user }) {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const isMobileDashboard = useMediaQuery('(max-width: 768px)');

    const todayKey = `client_welcome_dismissed_${user.id}_${new Date().toDateString()}`;
    const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(todayKey));
    const dismissWelcome = () => { localStorage.setItem(todayKey, '1'); setShowWelcome(false); };

    useEffect(() => {
        api.get('/dashboard/client-portal')
            .then((res) => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <ClientPortalSkeleton />;

    const {
        assignments = [],
        counts = {},
        taskStats = { total: 0, completed: 0, in_progress: 0, overdue: 0, not_started: 0 },
        projectStatuses = [],
    } = data || {};

    const allProjects = assignments.flatMap((a) => a.projects || []).sort((a, b) => {
        const progressA = (a.task_total || 0) > 0 ? Math.round(((a.task_completed || 0) / a.task_total) * 100) : 0;
        const progressB = (b.task_total || 0) > 0 ? Math.round(((b.task_completed || 0) / b.task_total) * 100) : 0;
        if (progressA !== progressB) {
            return progressB - progressA;
        }
        return (a.name || '').localeCompare(b.name || '');
    });

    const getProgressColor = (pct) => {
        return pct >= 50 ? 'green' : 'blue';
    };

    /* ── Chart Data Preparation ── */
    const isSingleProject = allProjects.length === 1;

    let lineChartData = [];
    if (isSingleProject) {
        const p = allProjects[0];
        const total = p.task_total || 0;
        const completed = p.task_completed || 0;

        lineChartData.push({
            name: 'Start',
            Progress: 0,
            Pending: total > 0 && completed === 0 ? 0 : null,
            projectId: p.id,
        });

        for (let i = 1; i <= total; i++) {
            const isCompleted = i <= completed;
            const progressVal = Math.round((i / total) * 100);
            lineChartData.push({
                name: `Task ${i}`,
                Progress: isCompleted ? progressVal : null,
                Pending: !isCompleted ? 0 : null,
                'Current Progress': isCompleted ? progressVal : null,
                projectId: p.id,
            });
        }

        if (total === 0) {
            lineChartData = [{ name: 'No tasks', Progress: 0 }];
        }
    } else {
        // Line chart: each project as an x‑axis point
        lineChartData = allProjects.map((p) => {
            const total = p.task_total || 0;
            const completed = p.task_completed || 0;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            // Shorten long names for the axis
            const shortName = p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name;
            return {
                name: shortName,
                fullName: p.name,
                Progress: progress,
                'Total Tasks': total,
                'Completed': completed,
                projectId: p.id,
            };
        }).sort((a, b) => {
            if (a.Progress !== b.Progress) {
                return a.Progress - b.Progress;
            }
            return a.fullName.localeCompare(b.fullName);
        });
    }

    // Task distribution pie
    const taskPieData = [
        { name: 'Completed', value: taskStats.completed || 0, color: '#10B981' },
        { name: 'In Progress', value: taskStats.in_progress || 0, color: '#2563EB' },
        { name: 'Not Started', value: taskStats.not_started || 0, color: '#9CA3AF' },
        { name: 'Overdue', value: taskStats.overdue || 0, color: '#EF4444' },
    ].filter(d => d.value > 0);

    const overallProgress = taskStats.total > 0
        ? Math.round((taskStats.completed / taskStats.total) * 100)
        : 0;

    // Click handler for chart elements
    const handleChartClick = (data) => {
        if (data?.activePayload?.[0]?.payload?.projectId) {
            navigate(`/projects/${data.activePayload[0].payload.projectId}`);
        }
    };

    return (
        <div className="fade-in">
            {/* ── Welcome Banner ── */}
            {showWelcome && (
                <div style={{
                    marginBottom: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '30px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '16px', flexWrap: 'wrap',
                }}>
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                            Welcome back, {user.first_name}!
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', marginTop: '6px', maxWidth: '600px' }}>
                            Track the ongoing progress of all your active projects and assignments securely from your client portal.
                        </p>
                    </div>
                    <button
                        onClick={dismissWelcome}
                        title="Dismiss"
                        style={{
                            background: 'rgba(255,255,255,0.2)', border: 'none',
                            color: '#fff', borderRadius: '999px',
                            padding: '6px 14px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600, flexShrink: 0,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* ── Stats Cards ── */}
            <div className="dashboard-stat-grid">
                {[
                    { label: 'Total Projects', value: counts.projects || 0, icon: <HiOutlineClipboardList />, color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
                    { label: 'Tasks Completed', value: taskStats.completed || 0, icon: <HiOutlineCheckCircle />, color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                    { label: 'In Progress', value: taskStats.in_progress || 0, icon: <HiOutlineClock />, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
                    { label: 'Overdue', value: taskStats.overdue || 0, icon: <HiOutlineExclamationCircle />, color: taskStats.overdue > 0 ? '#EF4444' : '#9CA3AF', bg: taskStats.overdue > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(156,163,175,0.08)' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                        padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
                        transition: 'all 0.25s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        borderTop: `3px solid ${stat.color}`,
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: stat.bg, color: stat.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '22px', flexShrink: 0,
                        }}>{stat.icon}</div>
                        <div>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0d131b', lineHeight: 1.1 }}>{stat.value}</div>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Charts Row: Line Chart + Task Distribution ── */}
            {allProjects.length > 0 && (
                <div className="dashboard-chart-grid">
                    {/* Line/Area Chart */}
                    <div style={{
                        background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                        padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.08)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <HiOutlineTrendingUp />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0d131b', margin: 0 }}>
                                    {isSingleProject ? 'Project Completion Trajectory' : 'Project Progress Overview'}
                                </h3>
                                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
                                    {isSingleProject ? `Task-by-task progression for ${allProjects[0].name}` : 'Completion % across all projects'}
                                </p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={isMobileDashboard ? 180 : 260}>
                            <ComposedChart data={lineChartData} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                                <defs>
                                    <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tick={isSingleProject || isMobileDashboard ? false : { fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                                    axisLine={{ stroke: '#e4e8f0' }} tickLine={false}
                                    interval={0} angle={isSingleProject || isMobileDashboard ? 0 : -20} textAnchor={isSingleProject || isMobileDashboard ? 'middle' : 'end'}
                                    height={isSingleProject || isMobileDashboard ? 15 : 50}
                                />
                                <YAxis
                                    domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                    hide={isMobileDashboard}
                                    axisLine={false} tickLine={false}
                                    tickFormatter={v => `${v}%`}
                                />
                                <Tooltip content={<CustomLineTooltip />} />
                                <Area
                                    type="monotone" dataKey="Progress"
                                    stroke="#2563EB" strokeWidth={3}
                                    fill="url(#progressGradient)"
                                    dot={{ r: 5, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                                    activeDot={{ r: 7, fill: '#2563EB', stroke: '#fff', strokeWidth: 3 }}
                                    connectNulls={false}
                                />
                                {isSingleProject && (
                                    <Line
                                        type="stepAfter" dataKey="Pending"
                                        stroke="none"
                                        dot={{ r: 4, fill: '#cbd5e1', stroke: 'none' }}
                                        activeDot={false}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Task Distribution Donut */}
                    <div style={{
                        background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                        padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <HiOutlineChartPie />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0d131b', margin: 0 }}>Task Distribution</h3>
                                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Across all active projects</p>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {taskPieData.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={isMobileDashboard ? 190 : 200}>
                                        <PieChart>
                                            <Pie
                                                data={taskPieData} cx="50%" cy="50%"
                                                innerRadius="60%" outerRadius="85%"
                                                paddingAngle={3} dataKey="value"
                                                stroke="none"
                                            >
                                                {taskPieData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value, name) => [`${value} tasks`, name]}
                                                contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {/* Center label */}
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '50%',
                                        transform: 'translate(-50%, -50%)', textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#0d131b' }}>{overallProgress}%</div>
                                        <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>Overall</div>
                                    </div>
                                </>
                            ) : (
                                <p style={{ color: '#9CA3AF', fontSize: '13px' }}>No task data yet.</p>
                            )}
                        </div>

                        {/* Legend */}
                        <div className="dashboard-pie-legend">
                            {taskPieData.map((d, i) => (
                                <div className="dashboard-pie-legend-item" key={i}>
                                    <span style={{ width: 10, height: 10, borderRadius: '3px', background: d.color, display: 'inline-block' }} />
                                    {d.name} ({d.value})
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Project Gauge Cards ── */}
            {allProjects.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0d131b', margin: 0 }}>Project Progress</h3>
                        <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>
                            — Click any card to view details
                        </span>
                    </div>
                    <div className="dashboard-project-gauge-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(allProjects.length, 3)}, 1fr)`,
                        gap: '16px',
                    }}>
                        {allProjects.map((p) => (
                            <ProjectGaugeCard
                                key={p.id}
                                project={p}
                                assignments={assignments}
                                onClick={(id) => navigate(`/projects/${id}`)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Project Portfolio Table ── */}
            <div style={{
                background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px', borderBottom: '1px solid #e4e8f0',
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0d131b', margin: 0 }}>Project Portfolio</h2>
                    <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600, background: '#f1f5f9', padding: '4px 12px', borderRadius: '999px' }}>
                        {allProjects.length} project{allProjects.length !== 1 ? 's' : ''}
                    </span>
                </div>
                {allProjects.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Assignment</th>
                                <th>Service</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Tasks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allProjects.map((project) => {
                                const total = project.task_total || 0;
                                const completed = project.task_completed || 0;
                                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                                const parentAssignment = assignments.find((a) => a.projects?.some((p) => p.id === project.id));

                                return (
                                    <tr
                                        key={project.id}
                                        onClick={() => navigate(`/projects/${project.id}`)}
                                        style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <td style={{ fontWeight: 700, color: '#0d131b', fontSize: '14px' }}>
                                            {project.name}
                                        </td>
                                        <td style={{ color: '#64748b', fontSize: '13px' }}>{parentAssignment?.name || '—'}</td>
                                        <td><span className="badge badge-purple">{project.service_name}</span></td>
                                        <td><span className={`badge ${getWorkflowStatusBadge(project.status)}`}>{formatWorkflowStatus(project.status)}</span></td>
                                        <td style={{ minWidth: '140px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="progress-bar" style={{ flex: 1, height: '7px' }}>
                                                    <div className={`fill ${getProgressColor(progress)}`} style={{ width: `${progress}%` }} />
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: 800, minWidth: '36px', color: '#0d131b' }}>{progress}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '12px' }}>
                                                <span style={{ color: '#10B981', fontWeight: 700 }}>{completed}</span>
                                                <span style={{ color: '#9CA3AF' }}>/{total}</span>
                                                {project.task_overdue > 0 && (
                                                    <span style={{ color: '#EF4444', marginLeft: '6px', fontWeight: 600 }}>
                                                        ({project.task_overdue} overdue)
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state" style={{ padding: '60px 20px' }}>
                        <div className="icon" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                            <HiOutlineOfficeBuilding />
                        </div>
                        <h3>No projects assigned.</h3>
                        <p>When our team begins work on your assignments, their progress will appear here.</p>
                    </div>
                )}
            </div>

        </div>
    );
}

function ConsultingPortal({ user }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const isMobileDashboard = useMediaQuery('(max-width: 768px)');

    const todayKey = `welcome_dismissed_${user.id}_${new Date().toDateString()}`;
    const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(todayKey));
    const dismissWelcome = () => {
        localStorage.setItem(todayKey, '1');
        setShowWelcome(false);
    };

    useEffect(() => {
        api.get('/dashboard/my-portal')
            .then((res) => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const {
        assignments = [],
        counts = {},
        taskStats = { total: 0, completed: 0, in_progress: 0, overdue: 0, not_started: 0 },
        projectStatuses = [],
    } = data || {};

    const allProjects = assignments.flatMap((assignment) => assignment.projects || []);
    const activeProjects = allProjects.filter((project) => project.status === 'active' || project.status === 'not_started');

    const getProgressColor = (pct) => {
        return pct >= 50 ? 'green' : 'blue';
    };

    const consultantChartData = activeProjects.map((p) => {
        const total = p.task_total || 0;
        const completed = p.task_completed || 0;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
            name: (p.name || '').length > 18 ? `${p.name.slice(0, 16)}…` : p.name,
            fullName: p.name || '',
            Progress: progress,
            projectId: p.id,
        };
    }).sort((a, b) => {
        if (a.Progress !== b.Progress) return a.Progress - b.Progress;
        return a.fullName.localeCompare(b.fullName);
    });

    const consultantTaskPieData = [
        { name: 'Completed', value: taskStats.completed || 0, color: '#10B981' },
        { name: 'In Progress', value: taskStats.in_progress || 0, color: '#2563EB' },
        { name: 'Not Started', value: taskStats.not_started || 0, color: '#9CA3AF' },
        { name: 'Overdue', value: taskStats.overdue || 0, color: '#EF4444' },
    ].filter((d) => d.value > 0);

    const consultantOverallProgress = taskStats.total > 0
        ? Math.round((taskStats.completed / taskStats.total) * 100)
        : 0;

    return (
        <div className="fade-in">
            {showWelcome && (
                <div style={{
                    marginBottom: '24px',
                    background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                }}>
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: 0 }}>
                            Welcome back, {user.first_name}!
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '4px' }}>
                            Here's your overview for today as a <span style={{ fontWeight: 700, color: '#fff' }}>{user.role_name}</span>.
                        </p>
                    </div>
                    <button
                        onClick={dismissWelcome}
                        title="Dismiss"
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '999px',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            flexShrink: 0,
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <div className="stats-grid" style={{ marginBottom: '28px' }}>
                <div className="stat-card">
                    <div className="stat-icon blue"><HiOutlineCollection /></div>
                    <div className="stat-info"><h3>{counts.active_projects || 0}</h3><p>Active Projects</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue"><HiOutlineClock /></div>
                    <div className="stat-info"><h3>{taskStats.total || 0}</h3><p>Total Tasks</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><HiOutlineCheckCircle /></div>
                    <div className="stat-info"><h3>{taskStats.completed || 0}</h3><p>Completed Tasks</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon orange"><HiOutlineExclamationCircle /></div>
                    <div className="stat-info">
                        <h3 style={taskStats.overdue > 0 ? { color: 'var(--danger)' } : {}}>{taskStats.overdue || 0}</h3>
                        <p>Overdue Tasks</p>
                    </div>
                </div>
            </div>

            {activeProjects.length > 0 && (
                <div className="dashboard-chart-grid">
                    <div style={{
                        background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                        padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.08)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <HiOutlineTrendingUp />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0d131b', margin: 0 }}>Project Progress Overview</h3>
                                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Completion % across your active projects</p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={isMobileDashboard ? 180 : 260}>
                            <ComposedChart data={consultantChartData}>
                                <defs>
                                    <linearGradient id="consultantProgressGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tick={isMobileDashboard ? false : { fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                                    axisLine={{ stroke: '#e4e8f0' }}
                                    tickLine={false}
                                    interval={0}
                                    angle={isMobileDashboard ? 0 : -20}
                                    textAnchor={isMobileDashboard ? 'middle' : 'end'}
                                    height={isMobileDashboard ? 15 : 50}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                    hide={isMobileDashboard}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip content={<CustomLineTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="Progress"
                                    stroke="#2563EB"
                                    strokeWidth={3}
                                    fill="url(#consultantProgressGradient)"
                                    dot={{ r: 5, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                                    activeDot={{ r: 7, fill: '#2563EB', stroke: '#fff', strokeWidth: 3 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{
                        background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                        padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <HiOutlineChartPie />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0d131b', margin: 0 }}>Task Distribution</h3>
                                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Across your assignments</p>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {consultantTaskPieData.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={isMobileDashboard ? 190 : 200}>
                                        <PieChart>
                                            <Pie data={consultantTaskPieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" paddingAngle={3} dataKey="value" stroke="none">
                                                {consultantTaskPieData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value, name) => [`${value} tasks`, name]} contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#0d131b' }}>{consultantOverallProgress}%</div>
                                        <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>Overall</div>
                                    </div>
                                </>
                            ) : (
                                <p style={{ color: '#9CA3AF', fontSize: '13px' }}>No task data yet.</p>
                            )}
                        </div>

                        <div className="dashboard-pie-legend">
                            {consultantTaskPieData.map((d, i) => (
                                <div className="dashboard-pie-legend-item" key={i}>
                                    <span style={{ width: 10, height: 10, borderRadius: '3px', background: d.color, display: 'inline-block' }} />
                                    {d.name} ({d.value})
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="dashboard-secondary-grid">
                <div className="card dashboard-task-overview-card">
                    <div className="card-header">
                        <span className="card-title">Task Overview</span>
                    </div>
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon blue" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineClock /></div>
                            <div><div style={{ fontSize: '22px', fontWeight: 800 }}>{taskStats.total}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Tasks</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon green" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineCheckCircle /></div>
                            <div><div style={{ fontSize: '22px', fontWeight: 800 }}>{taskStats.completed}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon orange" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineClock /></div>
                            <div><div style={{ fontSize: '22px', fontWeight: 800 }}>{taskStats.in_progress}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>In Progress</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon red" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineExclamationCircle /></div>
                            <div><div style={{ fontSize: '22px', fontWeight: 800 }}>{taskStats.overdue}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Overdue</div></div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Project Status Breakdown</span>
                    </div>
                    {projectStatuses.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {projectStatuses.map((projectStatus) => (
                                <div key={projectStatus.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className={`badge ${getWorkflowStatusBadge(projectStatus.status)}`}>
                                        {formatWorkflowStatus(projectStatus.status).toUpperCase()}
                                    </span>
                                    <span style={{ fontWeight: 700, fontSize: '18px' }}>{projectStatus.count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No projects yet.</p>
                    )}
                </div>
            </div>

            <div className="table-container" style={{ marginBottom: '28px' }}>
                <div className="table-header">
                    <h2>Active Projects ({activeProjects.length})</h2>
                </div>
                {activeProjects.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Assignment</th>
                                <th>Service</th>
                                <th>Status</th>
                                <th>Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeProjects.map((project) => {
                                const total = project.task_total || 0;
                                const completed = project.task_completed || 0;
                                const progress = total > 0 ? ((completed / total) * 100).toFixed(0) : 0;
                                const parentAssignment = assignments.find((assignment) => assignment.projects?.some((assignmentProject) => assignmentProject.id === project.id));
                                return (
                                    <tr key={project.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{parentAssignment?.name || '-'}</td>
                                        <td><span className="badge badge-purple">{project.service_name}</span></td>
                                        <td><span className={`badge ${getWorkflowStatusBadge(project.status)}`}>{formatWorkflowStatus(project.status)}</span></td>
                                        <td style={{ minWidth: '120px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="progress-bar" style={{ flex: 1 }}>
                                                    <div className={`fill ${getProgressColor(parseFloat(progress))}`} style={{ width: `${progress}%` }} />
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '36px' }}>{progress}%</span>
                                            </div>
                                            {project.task_overdue > 0 && <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>{project.task_overdue} overdue</div>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                        <div className="icon"><HiOutlineClipboardList /></div>
                        <h3>No active projects</h3>
                        <p>You have no in-progress or pending projects at the moment.</p>
                    </div>
                )}
            </div>

            {(taskStats.not_started > 0 || taskStats.in_progress > 0 || taskStats.overdue > 0) && (
                <div className="card">
                    <div className="card-header"><span className="card-title">Pending Tasks Summary</span></div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '140px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <div className="stat-icon blue" style={{ width: '36px', height: '36px', fontSize: '16px' }}><HiOutlineClock /></div>
                            <div><div style={{ fontSize: '20px', fontWeight: 800 }}>{taskStats.in_progress}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>In Progress</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '140px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <div className="stat-icon orange" style={{ width: '36px', height: '36px', fontSize: '16px' }}><HiOutlineClipboardList /></div>
                            <div><div style={{ fontSize: '20px', fontWeight: 800 }}>{taskStats.not_started}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not Started</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '140px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <div className="stat-icon red" style={{ width: '36px', height: '36px', fontSize: '16px' }}><HiOutlineExclamationCircle /></div>
                            <div><div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)' }}>{taskStats.overdue}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Overdue</div></div>
                        </div>
                    </div>
                </div>
            )}

            {assignments.length === 0 && (
                <div className="empty-state" style={{ paddingTop: '60px' }}>
                    <div className="icon">Tasks</div>
                    <h3>No assignments yet</h3>
                    <p>You haven't been added to any assignments. Your manager will add you when a project begins.</p>
                </div>
            )}
        </div>
    );
}

function FullDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const isMobileDashboard = useMediaQuery('(max-width: 768px)');

    useEffect(() => {
        api.get('/dashboard/stats')
            .then((res) => setStats(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!stats) return null;

    const getProgressColor = (pct) => {
        return pct >= 50 ? 'green' : 'blue';
    };

    return (
        <div className="fade-in">
            <div className="dashboard-stat-grid dashboard-kpi-grid">
                <div className="stat-card"><div className="dashboard-kpi-main"><div className="stat-icon purple"><HiOutlineOfficeBuilding /></div><div className="stat-info"><h3>{stats.counts.organizations}</h3><p>Organizations</p></div></div></div>
                <div className="stat-card"><div className="dashboard-kpi-main"><div className="stat-icon blue"><HiOutlineCollection /></div><div className="stat-info"><h3>{stats.counts.assignments}</h3><p>Assignments</p></div></div></div>
                <div className="stat-card"><div className="dashboard-kpi-main"><div className="stat-icon green"><HiOutlineClipboardList /></div><div className="stat-info"><h3>{stats.counts.projects}</h3><p>Projects</p></div></div></div>
                <div className="stat-card"><div className="dashboard-kpi-main"><div className="stat-icon orange"><HiOutlineUsers /></div><div className="stat-info"><h3>{stats.counts.users}</h3><p>Team Members</p></div></div></div>
            </div>

            {/* ── Charts Row: Project Progress Line Chart + Task Distribution Pie ── */}
            {stats.recentProjects.length > 0 && (() => {
                // Prepare line chart data from recent projects
                const lineChartData = stats.recentProjects.map((p) => {
                    const progress = parseFloat(p.progress_percentage) || 0;
                    const shortName = p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name;
                    return {
                        name: shortName,
                        fullName: p.name,
                        Progress: Math.round(progress),
                        projectId: p.id,
                    };
                }).sort((a, b) => {
                    if (a.Progress !== b.Progress) return a.Progress - b.Progress;
                    return a.fullName.localeCompare(b.fullName);
                });

                // Task distribution pie data
                const taskPieData = [
                    { name: 'Completed', value: stats.taskStats.completed || 0, color: '#10B981' },
                    { name: 'In Progress', value: stats.taskStats.in_progress || 0, color: '#2563EB' },
                    { name: 'Not Started', value: stats.taskStats.not_started || 0, color: '#9CA3AF' },
                    { name: 'Overdue', value: stats.taskStats.overdue || 0, color: '#EF4444' },
                ].filter(d => d.value > 0);

                const overallProgress = stats.taskStats.total > 0
                    ? Math.round((stats.taskStats.completed / stats.taskStats.total) * 100)
                    : 0;

                return (
                    <div className="dashboard-chart-grid">
                        {/* Line/Area Chart */}
                        <div style={{
                            background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                            padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.08)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                    <HiOutlineTrendingUp />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0d131b', margin: 0 }}>Project Progress Overview</h3>
                                    <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Completion % across all projects</p>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={isMobileDashboard ? 180 : 260}>
                                <ComposedChart data={lineChartData}>
                                    <defs>
                                        <linearGradient id="dirProgressGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tick={isMobileDashboard ? false : { fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                                        axisLine={{ stroke: '#e4e8f0' }} tickLine={false}
                                        interval={0} angle={isMobileDashboard ? 0 : -20} textAnchor={isMobileDashboard ? 'middle' : 'end'}
                                        height={isMobileDashboard ? 15 : 50}
                                    />
                                    <YAxis
                                        domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                        hide={isMobileDashboard}
                                        axisLine={false} tickLine={false}
                                        tickFormatter={v => `${v}%`}
                                    />
                                    <Tooltip content={<CustomLineTooltip />} />
                                    <Area
                                        type="monotone" dataKey="Progress"
                                        stroke="#2563EB" strokeWidth={3}
                                        fill="url(#dirProgressGradient)"
                                        dot={{ r: 5, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                                        activeDot={{ r: 7, fill: '#2563EB', stroke: '#fff', strokeWidth: 3 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Task Distribution Donut */}
                        <div style={{
                            background: '#fff', border: '1px solid #e4e8f0', borderRadius: '14px',
                            padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                            display: 'flex', flexDirection: 'column',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                    <HiOutlineChartPie />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0d131b', margin: 0 }}>Task Distribution</h3>
                                    <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Across all active projects</p>
                                </div>
                            </div>

                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                {taskPieData.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={isMobileDashboard ? 190 : 200}>
                                            <PieChart>
                                                <Pie
                                                    data={taskPieData} cx="50%" cy="50%"
                                                    innerRadius="60%" outerRadius="85%"
                                                    paddingAngle={3} dataKey="value"
                                                    stroke="none"
                                                >
                                                    {taskPieData.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value, name) => [`${value} tasks`, name]}
                                                    contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Center label */}
                                        <div style={{
                                            position: 'absolute', top: '50%', left: '50%',
                                            transform: 'translate(-50%, -50%)', textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0d131b' }}>{overallProgress}%</div>
                                            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>Overall</div>
                                        </div>
                                    </>
                                ) : (
                                    <p style={{ color: '#9CA3AF', fontSize: '13px' }}>No task data yet.</p>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="dashboard-pie-legend">
                                {taskPieData.map((d, i) => (
                                    <div className="dashboard-pie-legend-item" key={i}>
                                        <span style={{ width: 10, height: 10, borderRadius: '3px', background: d.color, display: 'inline-block' }} />
                                        {d.name} ({d.value})
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="dashboard-secondary-grid">
                <div className="card dashboard-task-overview-card">
                    <div className="card-header"><span className="card-title">Task Overview</span></div>
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div className="stat-icon blue" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineClock /></div><div><div style={{ fontSize: '22px', fontWeight: 800 }}>{stats.taskStats.total}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Tasks</div></div></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div className="stat-icon green" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineCheckCircle /></div><div><div style={{ fontSize: '22px', fontWeight: 800 }}>{stats.taskStats.completed}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed</div></div></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div className="stat-icon orange" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineClock /></div><div><div style={{ fontSize: '22px', fontWeight: 800 }}>{stats.taskStats.in_progress}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>In Progress</div></div></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div className="stat-icon red" style={{ width: '40px', height: '40px', fontSize: '18px' }}><HiOutlineExclamationCircle /></div><div><div style={{ fontSize: '22px', fontWeight: 800 }}>{stats.taskStats.overdue}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Overdue</div></div></div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header"><span className="card-title">Project Status Breakdown</span></div>
                    {stats.projectStatuses.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {stats.projectStatuses.map((projectStatus) => (
                                <div key={projectStatus.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className={`badge ${getWorkflowStatusBadge(projectStatus.status)}`}>{formatWorkflowStatus(projectStatus.status).toUpperCase()}</span>
                                    <span style={{ fontWeight: 700, fontSize: '18px' }}>{projectStatus.count}</span>
                                </div>
                            ))}
                        </div>
                    ) : <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No projects yet.</p>}
                </div>
            </div>

            <div className="table-container">
                <div className="table-header"><h2>Recent Projects</h2></div>
                {stats.recentProjects.length > 0 ? (
                    <table className="recent-projects-table">
                        <thead>
                            <tr><th>Project</th><th>Organization</th><th>Service</th><th>Status</th><th>Progress</th></tr>
                        </thead>
                        <tbody>
                            {stats.recentProjects.map((project) => (
                                <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="clickable-row">
                                    <td className="rp-project-name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</td>
                                    <td className="rp-org-name">{project.organization_name}<span className="assignment-text"> / {project.assignment_name}</span></td>
                                    <td className="rp-service-name"><span className="badge badge-purple">{project.service_name}</span></td>
                                    <td className="rp-status"><span className={`badge ${getWorkflowStatusBadge(project.status)}`}>{formatWorkflowStatus(project.status)}</span></td>
                                    <td className="rp-progress" style={{ minWidth: '120px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="progress-bar" style={{ flex: 1 }}>
                                                <div className={`fill ${getProgressColor(parseFloat(project.progress_percentage))}`} style={{ width: `${project.progress_percentage}%` }} />
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '36px' }}>{parseFloat(project.progress_percentage).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="icon"><HiOutlineClipboardList /></div>
                        <h3>No projects yet</h3>
                        <p>Create your first organization, then add assignments and projects to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const roleName = user?.role_name || '';

    if (roleName === 'Consultant') return <ConsultingPortal user={user} />;
    if (roleName === 'Senior Consultant') return <ConsultingPortal user={user} />;
    if (roleName === 'Client') return <ClientPortal user={user} />;

    return <FullDashboard />;
}
