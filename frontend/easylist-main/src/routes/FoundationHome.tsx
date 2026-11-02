import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Layers,
  FileCode2,
  Palette,
  Terminal,
} from 'lucide-react';
import { ROUTES } from './paths';

export const FoundationHome: React.FC = () => {
  const publicRoutes = [
    { name: 'Login Screen', path: ROUTES.LOGIN, phase: 'Phase 2' },
    { name: 'Register / Create Account', path: ROUTES.REGISTER, phase: 'Phase 2' },
    { name: 'Forgot Password', path: ROUTES.FORGOT_PASSWORD, phase: 'Phase 2' },
    { name: 'Reset Password', path: ROUTES.RESET_PASSWORD, phase: 'Phase 2' },
  ];

  const protectedRoutes = [
    { name: 'Dashboard Screen', path: ROUTES.DASHBOARD, phase: 'Phase 3' },
    { name: 'Extract & Review Screen', path: ROUTES.REVIEW, phase: 'Phase 5' },
    { name: 'Export Order Screen', path: ROUTES.EXPORT, phase: 'Phase 6' },
    { name: 'Shop Settings Screen', path: ROUTES.SETTINGS, phase: 'Phase 6' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Brand Header */}
        <div className="bg-white rounded-2xl border border-[var(--color-input-border)] p-6 sm:p-8 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src="/images/EasyList logo.png"
                alt="EasyList Logo"
                className="h-10 w-auto object-contain"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-primary-navy)] tracking-tight">
                  EasyList <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--color-primary-blue)] align-middle">Phase 1 Complete</span>
                </h1>
                <p className="text-xs text-[var(--color-secondary-text)]">
                  A product by Avenzo Technologies • Production Frontend Setup
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Frontend Foundation Ready
            </div>
          </div>

          <p className="text-sm text-[var(--color-secondary-text)] mt-4 leading-relaxed">
            The foundation setup for EasyList is successfully configured. As mandated by Phase 1, all production tooling,
            Tailwind CSS tokens, Google Fonts, route architecture, HTTP client foundations, and strict TypeScript configurations
            are established without prematurely building actual product screens or inventing backend endpoints.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-[var(--color-input-border)] shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[var(--color-primary-blue)] flex items-center justify-center mb-3">
              <Palette className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[var(--color-primary-navy)] mb-1">Design System</h2>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              Tokens for Navy (#111C35), Blue (#087BFA), Accent (#3B9BFF), Plus Jakarta Sans, and Inter active.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[var(--color-input-border)] shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <FileCode2 className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[var(--color-primary-navy)] mb-1">API Readiness</h2>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              Reusable fetch client with AbortSignal cancellation and unified error formatting ready for backend endpoints.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[var(--color-input-border)] shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-[var(--color-primary-navy)] flex items-center justify-center mb-3">
              <Terminal className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[var(--color-primary-navy)] mb-1">Tooling & Strict TS</h2>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              TypeScript strict mode, React Router v7, Vite 8, and ESLint flat config verified passing.
            </p>
          </div>
        </div>

        {/* Architecture Routes Registry */}
        <div className="bg-white rounded-2xl border border-[var(--color-input-border)] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Layers className="w-5 h-5 text-[var(--color-primary-blue)]" />
            <h2 className="text-lg font-bold text-[var(--color-primary-navy)]">
              Configured Application Routes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Public Routes */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary-text)] mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Public Authentication Routes
              </div>
              <ul className="space-y-2">
                {publicRoutes.map((route) => (
                  <li key={route.path}>
                    <Link
                      to={route.path}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors group"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-primary-navy)] group-hover:text-[var(--color-primary-blue)]">
                          {route.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{route.path}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        {route.phase}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Protected Routes */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary-text)] mb-3 flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-amber-500" />
                Protected Core Routes (Auth Ready)
              </div>
              <ul className="space-y-2">
                {protectedRoutes.map((route) => (
                  <li key={route.path}>
                    <Link
                      to={route.path}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors group"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-primary-navy)] group-hover:text-amber-800">
                          {route.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{route.path}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        {route.phase}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
