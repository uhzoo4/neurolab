import React from 'react';

interface StatsPanelProps {
  currentEpoch: number;
  totalEpochs: number;
  loss: number | null;
  speedMultiplier: number | "MAX";
  status: string;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  currentEpoch,
  totalEpochs,
  loss,
  speedMultiplier,
  status,
}) => {
  // Styles designed for the premium, high-tech "NeuroLab" dark aesthetic
  const containerStyle: React.CSSProperties = {
    backgroundColor: '#070a13',
    padding: '24px',
    borderRadius: '16px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e2e8f0',
    border: '1px solid #1e293b',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  };

  const cardStyle = (color: string): React.CSSProperties => ({
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    padding: '20px',
    borderLeft: `4px solid ${color}`,
    borderTop: '1px solid #1e293b',
    borderRight: '1px solid #1e293b',
    borderBottom: '1px solid #1e293b',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#94a3b8',
    fontWeight: 600,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '1.75rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  };

  const secondaryValueStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: '#64748b',
    fontWeight: 500,
  };

  // Safe formatting helpers
  const formatLoss = (val: number | null): string => {
    if (val === null) return '0.0000';
    return val.toFixed(4);
  };

  const formatSpeed = (val: number | "MAX"): string => {
    if (val === 'MAX') return 'MAX';
    return `${val}x`;
  };

  return (
    <div style={containerStyle}>
      <div style={gridStyle}>
        {/* Epoch Card */}
        <div style={cardStyle('#38bdf8')}>
          <div style={labelStyle}>Epoch</div>
          <div style={valueStyle}>
            <span>{currentEpoch}</span>
            <span style={secondaryValueStyle}>/ {totalEpochs}</span>
          </div>
        </div>

        {/* Loss Card */}
        <div style={cardStyle('#f43f5e')}>
          <div style={labelStyle}>Loss</div>
          <div style={valueStyle}>
            {formatLoss(loss)}
          </div>
        </div>

        {/* Speed Card */}
        <div style={cardStyle('#a855f7')}>
          <div style={labelStyle}>Speed</div>
          <div style={valueStyle}>
            {formatSpeed(speedMultiplier)}
          </div>
        </div>

        {/* Status Card */}
        <div style={cardStyle('#34d399')}>
          <div style={labelStyle}>Status</div>
          <div style={{ ...valueStyle, color: '#34d399', fontSize: '1.5rem' }}>
            {status}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;