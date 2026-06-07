import React from 'react';

interface NeuronInspectorProps {
  selectedNeuron: {
    layer: number;
    index: number;
  } | null;
}

const NeuronInspector: React.FC<NeuronInspectorProps> = ({ selectedNeuron }) => {
  if (selectedNeuron === null) {
    return (
      <div style={{ backgroundColor: '#1e1e1e', color: '#e0e0e0', padding: '16px', borderRadius: '8px' }}>
        Click a neuron to inspect it
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#1e1e1e', color: '#e0e0e0', padding: '16px', borderRadius: '8px' }}>
      <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Neuron Inspector</h2>
      <div style={{ marginBottom: '8px' }}>Layer: {selectedNeuron.layer}</div>
      <div>Neuron Index: {selectedNeuron.index}</div>
    </div>
  );
};

export default NeuronInspector;