import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Sparkles, Camera, Scan, ArrowRight } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';

interface OrderUploadProps {
  onFileUpload: (file: File) => void;
  onUseSampleChit: () => void;
}

export const OrderUpload: React.FC<OrderUploadProps> = ({
  onFileUpload,
  onUseSampleChit,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div>
      {/* Dashboard Page Hero */}
      <div className="dashboard-hero">
        <div className="scanner-accent-icon">
          <Scan size={32} strokeWidth={2.2} />
        </div>

        <h1 className="hero-heading">
          Upload Your <span>Order</span>
        </h1>

        <div className="hero-subtitle-pill">
          <Sparkles size={14} />
          Convert handwritten orders into editable product lists
        </div>
      </div>

      {/* Main Upload Card matching Dashboard-EasyBill.png */}
      <div className="main-feature-card">
        {/* Header */}
        <div className="feature-card-header">
          <div className="feature-title-wrap">
            <div className="feature-badge-icon">
              <FileText size={20} />
            </div>
            <div>
              <div className="feature-heading">New Order</div>
              <div className="feature-subheading">Upload your handwritten order images.</div>
            </div>
          </div>

          <Badge variant="ready">Ready to upload</Badge>
        </div>

        {/* Dropzone Container */}
        <div
          className={`dropzone-container ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div className="cloud-icon-circle">
            <UploadCloud size={36} strokeWidth={2.2} />
          </div>

          <div className="dropzone-title">Drag & drop your order images here</div>
          <div className="dropzone-subtitle">or choose images from your device</div>

          <button
            type="button"
            className="btn-choose-images"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <ImageIcon size={18} />
            <span>Choose Images</span>
          </button>

          <div className="dropzone-formats">JPG, PNG, WEBP · Multiple images supported</div>
        </div>

        {/* Quick Action Presets Bar */}
        <div className="sample-presets-bar">
          <div className="sample-presets-title">
            <Sparkles size={16} color="#6366f1" />
            <span>Quick Start with Demo Samples:</span>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="sample-preset-btn"
              onClick={onUseSampleChit}
              style={{
                backgroundColor: '#eff6ff',
                borderColor: '#bfdbfe',
                color: '#1d4ed8',
                fontWeight: 600,
              }}
            >
              <FileText size={15} />
              <span>Use Tamil Grocery Chit Sample (22 items)</span>
              <ArrowRight size={14} />
            </button>

            <button
              type="button"
              className="sample-preset-btn"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera size={15} />
              <span>Capture via Camera</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
