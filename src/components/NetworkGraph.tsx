import { useMemo } from 'react';
import type { TrainingSnapshot } from '../simulation/neuralNetwork';
import './NetworkGraph.css';

interface NetworkGraphProps {
  snapshot: TrainingSnapshot | null;
  topology: number[];
}

export function NetworkGraph({ snapshot, topology }: NetworkGraphProps) {
  const width = 800;
  const height = 600;
  const padding = 50;

  const nodes = useMemo(() => {
    const numLayers = topology.length;
    const layerPositions = [];
    
    for (let l = 0; l < numLayers; l++) {
      const layerSize = topology[l];
      // Space layers evenly horizontally
      const x = padding + l * ((width - 2 * padding) / Math.max(1, numLayers - 1));
      
      const layerNodes = [];
      const ySpacing = (height - 2 * padding) / layerSize;
      
      for (let i = 0; i < layerSize; i++) {
        // Center nodes vertically in their slice
        const y = padding + (i + 0.5) * ySpacing;
        layerNodes.push({ x, y });
      }
      layerPositions.push(layerNodes);
    }
    return layerPositions;
  }, [topology]);

  return (
    <svg 
      className="network-graph" 
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <style>
          {`
            @keyframes pulse-glow {
              0% { opacity: 0.8; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.05); }
              100% { opacity: 0.8; transform: scale(1); }
            }
          `}
        </style>
      </defs>

      {/* Draw Connections */}
      <g strokeWidth="2">
        {nodes.map((layer, l) => {
          if (l === nodes.length - 1) return null;
          const nextLayer = nodes[l + 1];
          // 2. Connection opacity = absolute weight value
          const weights = snapshot?.weights?.[l];

          return layer.map((node, i) => (
            nextLayer.map((nextNode, j) => {
              const nextSize = topology[l + 1];
              const weight = weights ? weights[i * nextSize + j] : 0;
              
              const absWeight = Math.abs(weight);
              const opacity = snapshot ? Math.max(0.05, Math.min(absWeight, 1)) : 0.1;
              const colorClass = weight > 0 ? 'connection-positive' : 'connection-negative';

              return (
                <line
                  key={`line-${l}-${i}-${j}`}
                  x1={node.x}
                  y1={node.y}
                  x2={nextNode.x}
                  y2={nextNode.y}
                  className={`network-connection ${colorClass}`}
                  style={{ strokeOpacity: opacity, transition: 'stroke-opacity 0.2s ease-out' }}
                />
              );
            })
          ));
        })}
      </g>

      {/* Draw Neurons */}
      <g>
        {nodes.map((layer, l) => {
          const activations = snapshot?.activations?.[l];
          // 5. Output neuron should glow brightest
          const isOutputLayer = l === nodes.length - 1;
          const glowMultiplier = isOutputLayer ? 2 : 1;

          return layer.map((node, i) => {
            // 1. Neuron glow intensity = activation value
            const rawActivation = activations ? activations[i] : 0;
            const intensity = Math.min(Math.max(Math.abs(rawActivation), 0), 1);
            
            const baseRadius = 15;
            const glowRadius = baseRadius + (intensity * 12 * glowMultiplier);
            
            // 4. Active neurons pulse slightly
            const isActive = intensity > 0.5;
            const pulseStyle = isActive ? { animation: 'pulse-glow 2s infinite ease-in-out', transformOrigin: `${node.x}px ${node.y}px` } : {};

            return (
              <g key={`node-${l}-${i}`} className={isActive ? 'neuron-active' : ''}>
                {/* Glow effect */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={glowRadius}
                  className="neuron-glow"
                  style={{ 
                    fillOpacity: Math.max(0.1, intensity * 0.8),
                    transition: 'r 0.2s ease-out, fill-opacity 0.2s ease-out',
                    ...pulseStyle
                  }}
                />
                {/* Core neuron */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={baseRadius}
                  className="neuron-core"
                  style={{
                    filter: isOutputLayer && isActive ? `drop-shadow(0 0 15px rgba(88, 166, 255, 0.9))` : undefined
                  }}
                />
              </g>
            );
          });
        })}
      </g>
    </svg>
  );
}
