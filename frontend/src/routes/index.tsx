import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ROUTES } from './paths';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AccountsPage } from '../pages/AccountsPage';
import { ExcelManagementPage } from '../pages/ExcelManagementPage';
import { ResultsPage } from '../pages/ResultsPage';
import { ReviewPage } from '../pages/ReviewPage';
import { ExportPage } from '../pages/ExportPage';
import { AboutPage } from '../pages/AboutPage';
import { HistoryPage } from '../pages/HistoryPage';
import { FoundationHome } from './FoundationHome';
import { PlaceholderScreen } from './PlaceholderScreen';
import { PublicAuthRoute } from '../components/auth/PublicAuthRoute';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RootRedirect } from '../components/auth/RootRedirect';

export const router = createBrowserRouter([
  // Primary entry point (Root /) - dynamically checks active session
  {
    path: ROUTES.HOME,
    element: <RootRedirect />,
  },

  // Authentication Routes (In Demo Mode: automatically redirect to /dashboard. In Normal Mode: full auth screens)
  {
    path: ROUTES.LOGIN,
    element: (
      <PublicAuthRoute>
        <LoginPage />
      </PublicAuthRoute>
    ),
  },
  {
    path: ROUTES.REGISTER,
    element: (
      <PublicAuthRoute>
        <RegisterPage />
      </PublicAuthRoute>
    ),
  },
  {
    path: ROUTES.SIGNUP,
    element: (
      <PublicAuthRoute>
        <RegisterPage />
      </PublicAuthRoute>
    ),
  },
  {
    path: ROUTES.FORGOT_PASSWORD,
    element: (
      <PublicAuthRoute>
        <LoginPage initialShowRecovery={true} />
      </PublicAuthRoute>
    ),
  },
  {
    path: ROUTES.RESET_PASSWORD,
    element: (
      <PublicAuthRoute>
        <LoginPage initialShowRecovery={true} />
      </PublicAuthRoute>
    ),
  },
  {
    path: '/__/auth/action',
    element: (
      <PublicAuthRoute>
        <LoginPage initialShowRecovery={true} />
      </PublicAuthRoute>
    ),
  },

  // Core Application Routes (Protected by auth session)
  {
    path: ROUTES.DASHBOARD,
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.ACCOUNTS,
    element: (
      <ProtectedRoute>
        <AccountsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.EXCEL,
    element: (
      <ProtectedRoute>
        <ExcelManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.RESULTS,
    element: (
      <ProtectedRoute>
        <ResultsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/results-preview',
    element: (
      <ProtectedRoute>
        <ResultsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/review',
    element: (
      <ProtectedRoute>
        <ResultsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/export',
    element: (
      <ProtectedRoute>
        <ResultsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.ABOUT,
    element: (
      <ProtectedRoute>
        <AboutPage />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.SETTINGS,
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },
  {
    path: ROUTES.HISTORY,
    element: (
      <ProtectedRoute>
        <HistoryPage />
      </ProtectedRoute>
    ),
  },

  // Foundation Setup Overview
  {
    path: ROUTES.OVERVIEW,
    element: <FoundationHome />,
  },

  // Fallback 404 Route
  {
    path: '*',
    element: (
      <PlaceholderScreen
        title="Page Not Found"
        path="*"
        phase="404"
        description="The requested route does not exist in EasyList."
      />
    ),
  },
]);

export default router;