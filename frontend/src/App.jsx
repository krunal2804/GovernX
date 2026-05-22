import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrganizationsPage from './pages/OrganizationsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import AssignmentsPage from './pages/AssignmentsPage';
import AssignmentDetailPage from './pages/AssignmentDetailPage';
import AssignmentInfoPage from './pages/AssignmentInfoPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectCCTsPage from './pages/ProjectCCTsPage';
import UsersPage from './pages/UsersPage';
import MyProjectsPage from './pages/MyProjectsPage';
import MyAssignmentsPage from './pages/MyAssignmentsPage';
import SettingsPage from './pages/SettingsPage';
import ServicesPage from './pages/ServicesPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  return user ? <Navigate to="/" /> : children;
}

function RoleRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  const roleName = user.role_name || '';
  if (!roles.includes(roleName)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        {/* Old /organizations path redirects to /clients */}
        <Route path="organizations" element={<Navigate to="/clients" replace />} />
        <Route path="services" element={<RoleRoute roles={['Director', 'Manager']}><ServicesPage /></RoleRoute>} />
        <Route path="clients" element={<RoleRoute roles={['Director', 'Manager']}><OrganizationsPage /></RoleRoute>} />
        <Route path="clients/:id" element={<RoleRoute roles={['Director', 'Manager']}><ClientDetailPage /></RoleRoute>} />
        <Route path="assignments" element={<RoleRoute roles={['Director', 'Manager', 'Client']}><AssignmentsPage /></RoleRoute>} />
        <Route path="assignments/:id" element={<RoleRoute roles={['Director', 'Manager', 'Senior Consultant', 'Consultant', 'Client']}><AssignmentDetailPage /></RoleRoute>} />
        <Route path="assignments/:id/info" element={<RoleRoute roles={['Director', 'Manager', 'Senior Consultant', 'Consultant', 'Client']}><AssignmentInfoPage /></RoleRoute>} />
        <Route path="projects" element={<RoleRoute roles={['Director', 'Manager', 'Client']}><ProjectsPage /></RoleRoute>} />
        <Route path="projects/:id" element={<RoleRoute roles={['Director', 'Manager', 'Senior Consultant', 'Consultant', 'Client']}><ProjectDetailPage /></RoleRoute>} />
        <Route path="projects/:id/ccts" element={<RoleRoute roles={['Director', 'Manager', 'Senior Consultant', 'Consultant', 'Client']}><ProjectCCTsPage /></RoleRoute>} />
        <Route path="users" element={<RoleRoute roles={['Director', 'Manager']}><UsersPage /></RoleRoute>} />
        <Route path="my-assignments" element={<RoleRoute roles={['Senior Consultant', 'Consultant']}><MyAssignmentsPage /></RoleRoute>} />
        <Route path="my-projects" element={<RoleRoute roles={['Senior Consultant', 'Consultant']}><MyProjectsPage /></RoleRoute>} />
        <Route path="announcements" element={<RoleRoute roles={['Senior Consultant', 'Consultant']}><AnnouncementsPage /></RoleRoute>} />
        <Route path="announcements/:id" element={<RoleRoute roles={['Senior Consultant', 'Consultant']}><AnnouncementDetailPage /></RoleRoute>} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
