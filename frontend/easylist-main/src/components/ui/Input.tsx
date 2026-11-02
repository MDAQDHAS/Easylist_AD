import React, { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconClick,
  className = '',
  id,
  style,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-group ${className}`} style={{ width: '100%' }}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <div className="input-with-icon">
        {leftIcon && <span className="input-icon-left">{leftIcon}</span>}
        <input
          id={inputId}
          className="form-control-input"
          style={{
            paddingLeft: leftIcon ? '2.75rem' : '1rem',
            paddingRight: rightIcon ? '2.75rem' : '1rem',
            borderColor: error ? '#ef4444' : undefined,
            ...style,
          }}
          {...props}
        />
        {rightIcon && (
          <button
            type="button"
            className="input-icon-right"
            onClick={onRightIconClick}
            tabIndex={-1}
          >
            {rightIcon}
          </button>
        )}
      </div>
      {error && (
        <span style={{ display: 'block', fontSize: '0.8rem', color: '#ef4444', marginTop: '0.35rem' }}>
          {error}
        </span>
      )}
    </div>
  );
};
