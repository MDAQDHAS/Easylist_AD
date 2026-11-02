import React from 'react';
import { RegisterForm } from '../features/auth/RegisterForm';

export const RegisterPage: React.FC = () => {
  return (
    <main className="min-h-screen w-full bg-[var(--color-page-bg)] flex items-center justify-center py-4 px-3 sm:py-6 sm:px-4 lg:py-8 lg:px-6 font-sans">
      <RegisterForm />
    </main>
  );
};

export default RegisterPage;