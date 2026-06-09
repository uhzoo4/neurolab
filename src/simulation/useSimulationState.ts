import { useReducer, useRef } from "react";
import type { RefObject, Dispatch } from "react";
import { NeuralNetwork } from "./neuralNetwork";
import type { TrainingSnapshot } from "./neuralNetwork";
import { RingBuffer } from "../utils/ringBuffer";
import type { SimulationState, SimulationAction } from "../types/simulation";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Initialization
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TOTAL_EPOCHS = 10000;
const HISTORY_CAPACITY = 1000;

const computeStepsPerFrame = (speed: number | "MAX"): number => {
  if (speed === "MAX") return 1000;
  return speed;
};

// We pass this to useReducer to lazily initialize the state once.
const createInitialState = (): SimulationState => ({
  network: null,
  topology: null,
  training: {
    status: "idle",
    currentEpoch: 0,
    totalEpochs: DEFAULT_TOTAL_EPOCHS,
    speedMultiplier: 1,
    stepsPerFrame: 1,
  },
  snapshot: null,
  history: new RingBuffer(HISTORY_CAPACITY),
  ui: {
    selectedNeuron: null,
  },
  dataset: "xor",
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure Reducer
// ─────────────────────────────────────────────────────────────────────────────

// The reducer must remain mathematically pure to satisfy React Strict Mode.
// Side-effects (mutating refs/buffers) are handled in the dispatch wrapper below.
const reducer = (state: SimulationState, action: SimulationAction): SimulationState => {
  switch (action.type) {
    case "INIT_NETWORK": {
      const network = action.config
        ? new NeuralNetwork(action.config)
        : new NeuralNetwork({
          layerSizes: [2, 4, 1],
          activations: ["linear", "tanh", "sigmoid"],
          loss: "binaryCrossEntropy",
          learningRate: 0.1,
          seed: 42,
        });

      return {
        ...state,
        network,
        topology: { layerSizes: network.config.layerSizes },
        training: {
          ...state.training,
          status: "idle",
          currentEpoch: 0,
          errorMessage: undefined,
        },
        snapshot: null,
        history: new RingBuffer(HISTORY_CAPACITY),
        ui: { selectedNeuron: null },
      };
    }

    case "TRAIN_STEP": {
      const newEpoch = state.training.currentEpoch + 1;
      const isComplete = newEpoch >= state.training.totalEpochs;

      return {
        ...state,
        snapshot: action.snapshot,
        training: {
          ...state.training,
          currentEpoch: newEpoch,
          status: isComplete ? "complete" : state.training.status,
        },
      };
    }

    case "SET_STATUS":
      return {
        ...state,
        training: { ...state.training, status: action.status },
      };

    case "SET_SPEED":
      return {
        ...state,
        training: {
          ...state.training,
          speedMultiplier: action.speedMultiplier,
          stepsPerFrame: computeStepsPerFrame(action.speedMultiplier),
        },
      };

      case "SET_DATASET":
  return {
    ...state,
    dataset: action.dataset,
  };

    case "SET_EPOCHS":
      return {
        ...state,
        training: { ...state.training, totalEpochs: action.totalEpochs },
      };

    case "SELECT_NEURON":
      return {
        ...state,
        ui: { ...state.ui, selectedNeuron: action.payload },
      };

    case "RESET": {
      if (!state.network) return state;

      const network = new NeuralNetwork(state.network.config);

      return {
        ...state,
        network,
        training: {
          ...state.training,
          status: "idle",
          currentEpoch: 0,
          errorMessage: undefined,
        },
        snapshot: null,
        history: new RingBuffer(HISTORY_CAPACITY),
      };
    }

    case "TRAINING_COMPLETE":
      return {
        ...state,
        training: { ...state.training, status: "complete" },
      };

    case "TRAINING_ERROR":
      return {
        ...state,
        training: {
          ...state.training,
          status: "error",
          errorMessage: action.error.message,
        },
      };

    default:
      return state;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useSimulationState(): {
  state: SimulationState;
  dispatch: Dispatch<SimulationAction>;
  snapshotRef: RefObject<TrainingSnapshot | null>;
} {
  const snapshotRef = useRef<TrainingSnapshot | null>(null);

  // useReducer takes the pure reducer, a dummy initial state argument (null), 
  // and the initializer function to create the state safely.
  const [state, rawDispatch] = useReducer(reducer, undefined, createInitialState);

  // We wrap the raw dispatch to intercept actions that require high-performance 
  // mutations. This keeps the reducer pure while satisfying our MVP architecture.
  const dispatch = (action: SimulationAction) => {
    if (action.type === "TRAIN_STEP") {
      // Bridge mutation for the Canvas rAF loop
      snapshotRef.current = action.snapshot;
      // In-place mutation of the RingBuffer to avoid GC overhead at 60fps
      state.history.push(action.snapshot.lossValue);
    } else if (action.type === "INIT_NETWORK" || action.type === "RESET") {
      snapshotRef.current = null;
    }

    rawDispatch(action);
  };

  return { state, dispatch, snapshotRef };
}