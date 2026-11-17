import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#2563eb',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
        };
      case 'secondary':
        return {
          backgroundColor: '#0f172a',
          color: '#ffffff',
          border: 'none',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: '#334155',
          border: '1.5px solid #cbd5e1',
        };
      case 'danger':
        return {
          backgroundColor: '#ef4444',
          color: '#ffffff',
          border: 'none',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#475569',
          border: 'none',
        };
      case 'success':
        return {
          backgroundColor: '#10b981',
          color: '#ffffff',
          border: 'none',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '0.4rem 0.8rem', fontSize: '0.82rem', borderRadius: '6px' };
      case 'md':
        return { padding: '0.65rem 1.25rem', fontSize: '0.92rem', borderRadius: '8px' };
      case 'lg':
        return { padding: '0.85rem 1.75rem', fontSize: '1rem', borderRadius: '10px' };
    }
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontWeight: 600,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.65 : 1,
        transition: 'all 150ms ease',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      className={`easy-btn ${className}`}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
