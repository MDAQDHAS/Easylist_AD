import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Layers } from 'lucide-react';
import { ROUTES } from './paths';

interface PlaceholderScreenProps {
  title: string;
  path: string;
  phase: string;
  description: string;
  isProtected?: boolean;
}

export const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  title,
  path,
  phase,
  description,
  isProtected = false,
}) => {
  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[var(--color-input-border)] p-8 shadow-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-page-bg)] text-[var(--color-primary-blue)] mb-5">
          <Layers className="w-6 h-6" />
        </div>

        <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[var(--color-primary-blue)] mb-3">
          {phase}
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-primary-navy)] mb-2">
          {title}
        </h1>

        <div className="text-xs font-mono text-[var(--color-secondary-text)] bg-slate-50 py-1 px-2.5 rounded-md inline-block mb-4">
          Route: {path} {isProtected && '• [Protected Route Guard Ready]'}
        </div>

        <p className="text-sm text-[var(--color-secondary-text)] mb-6 leading-relaxed">
          {description}
        </p>

        <div className="border-t border-slate-100 pt-5 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Phase 1 Foundation Setup Active
          </span>
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary-blue)] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Overview
          </Link>
        </div>
      </div>
    </div>
  );
};
