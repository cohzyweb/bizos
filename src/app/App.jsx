import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import LoginPage from '../features/auth/LoginPage'
import SignupPage from '../features/auth/SignupPage'
import AppShell from '../components/AppShell'
import Toaster from '../components/Toaster'
import UpgradePrompt from '../features/plans/UpgradePrompt'
import PlanPage from '../features/plans/PlanPage'
import DashboardPage from '../pages/DashboardPage'
import SetupPage from '../pages/SetupPage'
import MorePage from '../pages/MorePage'
import NewSalePage from '../pages/NewSalePage'
import ProductsPage from '../pages/ProductsPage'
import CustomersPage from '../pages/CustomersPage'
import SalesHistoryPage from '../pages/SalesHistoryPage'
import ReportsPage from '../pages/ReportsPage'
import SettingsPage from '../pages/SettingsPage'
import LandingPage from '../features/landing/LandingPage'
import { FullPageSpinner } from '../components/ui'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

// Logged-out visitors only (login, signup)
function PublicOnly() {
  const { session, loading, business } = useAuth()
  if (loading) return <FullPageSpinner />
  if (session) return <Navigate to={business ? '/' : '/setup'} replace />
  return <Outlet />
}

// Must be logged in
function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

// "/" shows the marketing landing page to logged-out visitors;
// logged-in users fall through to the app (RequireBusiness handles setup).
function HomeRoute() {
  const { session, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!session) return <LandingPage />
  return <Outlet />
}

// Must be logged in AND have a business
function RequireBusiness() {
  const { session, loading, business } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!business) return <Navigate to="/setup" replace />
  return <Outlet />
}

function SetupRoute() {
  const { business } = useAuth()
  if (business) return <Navigate to="/" replace />
  return <SetupPage />
}

function OwnerOnly() {
  const { isOwner } = useAuth()
  if (!isOwner) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route path="/setup" element={<SetupRoute />} />
            </Route>

            <Route element={<HomeRoute />}>
              <Route element={<RequireBusiness />}>
                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="sale/new" element={<NewSalePage />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="sales" element={<SalesHistoryPage />} />
                  <Route path="more" element={<MorePage />} />
                  <Route element={<OwnerOnly />}>
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="settings/plan" element={<PlanPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
          <UpgradePrompt />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
