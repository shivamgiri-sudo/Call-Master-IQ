import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FiltersProvider } from './context/FiltersContext';
import AppShell from './layout/AppShell';
import Login from './pages/Login';
import ExecutiveCommandCenter from './pages/ExecutiveCommandCenter';
import QualityIntelligence from './pages/QualityIntelligence';
import SalesFunnelIntelligence from './pages/SalesFunnelIntelligence';
import RiskComplianceQueue from './pages/RiskComplianceQueue';
import TniCoachingHeatmap from './pages/TniCoachingHeatmap';
import AnalystPerformance from './pages/AnalystPerformance';
import EvidenceDrilldown from './pages/EvidenceDrilldown';
import SettingsFilters from './pages/SettingsFilters';

function ProtectedRoutes() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <FiltersProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/command-center" replace />} />
          <Route path="/command-center" element={<ExecutiveCommandCenter />} />
          <Route path="/quality" element={<QualityIntelligence />} />
          <Route path="/sales-funnel" element={<SalesFunnelIntelligence />} />
          <Route path="/risk" element={<RiskComplianceQueue />} />
          <Route path="/tni" element={<TniCoachingHeatmap />} />
          <Route path="/analysts" element={<AnalystPerformance />} />
          <Route path="/evidence" element={<EvidenceDrilldown />} />
          <Route path="/settings" element={<SettingsFilters />} />
          <Route path="*" element={<Navigate to="/command-center" replace />} />
        </Routes>
      </AppShell>
    </FiltersProvider>
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