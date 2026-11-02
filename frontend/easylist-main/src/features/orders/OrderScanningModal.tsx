import React from 'react';
import { ScanProgressUpdate } from '../../services/ocrService';
import { Sparkles } from 'lucide-react';

interface OrderScanningModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  progress: ScanProgressUpdate;
}

export const OrderScanningModal: React.FC<OrderScanningModalProps> = ({
  isOpen,
  imageSrc,
  progress,
}) => {
  if (!isOpen) return null;

  return (
    <div className="scanner-modal-backdrop">
      <div className="scanner-modal-content">
        {/* Animated Scanning Area */}
        <div className="scanner-preview-wrapper">
          {imageSrc ? (
            <img src={imageSrc} alt="Scanning Handwritten Order" className="scanner-preview-image" />
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Analyzing Image...</div>
          )}
          {/* Laser Scan line */}
          <div className="scanner-laser-line" />
        </div>

        {/* Progress Information */}
        <div className="scanner-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="scanner-stage-badge">
              Step {progress.stageNumber} of 5
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                color: '#6366f1',
                fontWeight: 600,
              }}
            >
              <Sparkles size={14} /> AI OCR Engine
            </div>
          </div>

          <h3 className="scanner-stage-name">{progress.stageName}</h3>
          <p className="scanner-stage-detail">{progress.detail}</p>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.5rem',
              fontSize: '0.78rem',
              color: '#94a3b8',
            }}
          >
            <span>Handwritten Text Recognition</span>
            <span style={{ fontWeight: 600, color: '#2563eb' }}>{progress.percent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
