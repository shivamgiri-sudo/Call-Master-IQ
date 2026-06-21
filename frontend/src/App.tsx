import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FiltersProvider } from './context/FiltersContext';
import AppShell from './layout/AppShell';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import ExecutiveCommandCenter from './pages/ExecutiveCommandCenter';
import QualityIntelligence from './pages/QualityIntelligence';
import SalesFunnelIntelligence from './pages/SalesFunnelIntelligence';
import RiskComplianceQueue from './pages/RiskComplianceQueue';
import TniCoachingHeatmap from './pages/TniCoachingHeatmap';
import AnalystPerformance from './pages/AnalystPerformance';
import EvidenceDrilldown from './pages/EvidenceDrilldown';
import SettingsFilters from './pages/SettingsFilters';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleGuard from './routes/RoleGuard';
import { ROUTE_PERMISSIONS } from './routes/permissions';

function ProtectedRoutes() {
  const { defaultRoute } = useAuth();
  return (
    <ProtectedRoute>
      <FiltersProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to={defaultRoute} replace />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/profile" element={<RoleGuard permission={ROUTE_PERMISSIONS['/profile']}><Profile /></RoleGuard>} />
            <Route path="/command-center" element={<RoleGuard permission={ROUTE_PERMISSIONS['/command-center']}><ExecutiveCommandCenter /></RoleGuard>} />
            <Route path="/quality" element={<RoleGuard permission={ROUTE_PERMISSIONS['/quality']}><QualityIntelligence /></RoleGuard>} />
            <Route path="/sales-funnel" element={<RoleGuard permission={ROUTE_PERMISSIONS['/sales-funnel']}><SalesFunnelIntelligence /></RoleGuard>} />
            <Route path="/risk" element={<RoleGuard permission={ROUTE_PERMISSIONS['/risk']}><RiskComplianceQueue /></RoleGuard>} />
            <Route path="/tni" element={<RoleGuard permission={ROUTE_PERMISSIONS['/tni']}><TniCoachingHeatmap /></RoleGuard>} />
            <Route path="/analysts" element={<RoleGuard permission={ROUTE_PERMISSIONS['/analysts']}><AnalystPerformance /></RoleGuard>} />
            <Route path="/evidence" element={<RoleGuard permission={ROUTE_PERMISSIONS['/evidence']}><EvidenceDrilldown /></RoleGuard>} />
            <Route path="/settings" element={<RoleGuard permission={ROUTE_PERMISSIONS['/settings']}><SettingsFilters /></RoleGuard>} />
            <Route path="/admin" element={<RoleGuard permission={ROUTE_PERMISSIONS['/admin']}><AdminPanel /></RoleGuard>} />
            <Route path="*" element={<Navigate to={defaultRoute} replace />} />
          </Routes>
        </AppShell>
      </FiltersProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}
