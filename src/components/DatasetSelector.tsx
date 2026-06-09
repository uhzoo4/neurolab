import React, { useState } from 'react';

interface DatasetSelectorProps {
  currentDataset: "xor" | "circle";
  onChange: (dataset: "xor" | "circle") => void;
}

const DatasetSelector: React.FC<DatasetSelectorProps> = ({ currentDataset, onChange }) => {
  const [hoveredButton, setHoveredButton] = useState<"xor" | "circle" | null>(null);

  const containerStyle: React.CSSProperties = {
    backgroundColor: '#070a13',
    padding: '20px',
    borderRadius: '12px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e2e8f0',
    border: '1px solid #1e293b',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
    maxWidth: '100%',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#94a3b8',
    fontWeight: 600,
    marginBottom: '12px',
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
  };

  const getButtonStyle = (dataset: "xor" | "circle"): React.CSSProperties => {
    const isActive = currentDataset === dataset;
    const isHovered = hoveredButton === dataset;

    return {
      flex: 1,
      padding: '12px 16px',
      fontSize: '0.875rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderRadius: '8px',
      border: '1px solid',
      borderColor: isActive ? '#38bdf8' : isHovered ? '#475569' : '#1e293b',
      backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : isHovered ? '#1e293b' : '#0f172a',
      color: isActive ? '#38bdf8' : '#94a3b8',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      textAlign: 'center',
      boxShadow: isActive ? '0 0 16px rgba(56, 189, 248, 0.2)' : 'none',
      outline: 'none',
    };
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Dataset Selector</div>
      <div style={buttonContainerStyle}>
        <button
          style={getButtonStyle("xor")}
          onClick={() => onChange("xor")}
          onMouseEnter={() => setHoveredButton("xor")}
          onMouseLeave={() => setHoveredButton(null)}
        >
          XOR
        </button>
        <button
          style={getButtonStyle("circle")}
          onClick={() => onChange("circle")}
          onMouseEnter={() => setHoveredButton("circle")}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Circle
        </button>
      </div>
    </div>
  );
};

export default DatasetSelector;