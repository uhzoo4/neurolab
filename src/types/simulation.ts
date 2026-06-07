import type { NeuralNetwork, TrainingSnapshot, NetworkConfig } from "../simulation/neuralNetwork";
import type { RingBuffer } from "../utils/ringBuffer";

export type TrainingStatus =
  | "idle"
  | "running"
  | "paused"
  | "complete"
  | "error";

export interface SimulationState {
  network: NeuralNetwork | null;
  topology: { layerSizes: number[] } | null;
  training: {
    status: TrainingStatus;
    currentEpoch: number;
    totalEpochs: number;
    speedMultiplier: number | "MAX";
    stepsPerFrame: number;
    errorMessage?: string;
  };
  snapshot: TrainingSnapshot | null;
  history: RingBuffer;
  ui: {
    selectedNeuron: string | null;
  };
}

export type SimulationAction =
  | { type: "INIT_NETWORK"; config?: NetworkConfig }
  | { type: "TRAIN_STEP"; snapshot: TrainingSnapshot }
  | { type: "SET_STATUS"; status: TrainingStatus }
  | { type: "SET_SPEED"; speedMultiplier: number | "MAX" }
  | { type: "SET_EPOCHS"; totalEpochs: number }
  | { type: "SELECT_NEURON"; payload: string | null }
  | { type: "RESET" }
  | { type: "TRAINING_COMPLETE" }
  | { type: "TRAINING_ERROR"; error: Error };