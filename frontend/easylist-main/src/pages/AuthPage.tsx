import React, { useState } from 'react';
import { LoginForm } from '../features/auth/LoginForm';
import { RegisterForm } from '../features/auth/RegisterForm';

interface AuthPageProps {
  onLoginSuccess: (email: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="auth-page-container">
      {mode === 'login' ? (
        <LoginForm
          onSuccess={onLoginSuccess}
          onSwitchToRegister={() => setMode('register')}
        />
      ) : (
        <RegisterForm
          onSuccess={onLoginSuccess}
          onSwitchToLogin={() => setMode('login')}
        />
      )}
    </div>
  );
};
