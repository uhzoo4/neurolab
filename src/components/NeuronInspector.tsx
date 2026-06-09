import type React from 'react';
import type { TrainingSnapshot } from '../simulation/neuralNetwork';

interface NeuronInspectorProps {
  selectedNeuron: {
    layer: number;
    index: number;
  } | null;
  snapshot: TrainingSnapshot | null;
}

const NeuronInspector: React.FC<NeuronInspectorProps> = ({ selectedNeuron, snapshot }) => {
  if (selectedNeuron === null) {
    return (
      <div style={{ backgroundColor: '#1e1e1e', color: '#e0e0e0', padding: '16px', borderRadius: '8px' }}>
        Click a neuron to inspect it
      </div>
    );
  }

  const activation = snapshot?.activations?.[selectedNeuron.layer]?.[selectedNeuron.index];
  const formattedActivation = typeof activation === 'number' ? activation.toFixed(4) : 'N/A';

  return (
    <div style={{ backgroundColor: '#1e1e1e', color: '#e0e0e0', padding: '16px', borderRadius: '8px' }}>
      <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Neuron Inspector</h2>
      <div style={{ marginBottom: '8px' }}>Layer: {selectedNeuron.layer}</div>
      <div style={{ marginBottom: '8px' }}>Neuron Index: {selectedNeuron.index}</div>
      <div>Activation: {formattedActivation}</div>
    </div>
  );
};

export default NeuronInspector;