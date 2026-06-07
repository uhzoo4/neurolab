import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { SimulationState, SimulationAction } from "../types/simulation";
import { Datasets } from "./neuralNetwork";

interface UseTrainingLoopProps {
  state: SimulationState;
  dispatch: Dispatch<SimulationAction>;
}

export function useTrainingLoop({ state, dispatch }: UseTrainingLoopProps): void {
  const requestRef = useRef<number | null>(null);

  // Keep the latest state accessible in the rAF without re-binding the loop
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // Only run when explicitly in "running" status
    if (state.training.status !== "running") {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      return;
    }

    // Default to XOR dataset for the MVP
    const dataset = Datasets.xor();

    const loop = () => {
      const currentState = stateRef.current;
      const { network, training } = currentState;

      // Failsafe exit
      if (!network || training.status !== "running") return;

      // Stop if we've reached the total epochs limit
      if (training.currentEpoch >= training.totalEpochs) {
        dispatch({ type: "TRAINING_COMPLETE" });
        return;
      }

      const steps = training.stepsPerFrame;

      try {
        for (let i = 0; i < steps; i++) {
          // Prevent exceeding total epochs during a multi-step frame
          if (currentState.training.currentEpoch + i >= training.totalEpochs) {
            break;
          }

          // Select a random sample from the dataset for SGD
          const sample = dataset[Math.floor(Math.random() * dataset.length)];

          // Execute training step
          const snapshot = network.trainStep(sample.input, sample.target);

          // Dispatch mutation action
          dispatch({ type: "TRAIN_STEP", snapshot });
        }
      } catch (error) {
        dispatch({ type: "TRAINING_ERROR", error: error instanceof Error ? error : new Error(String(error)) });
        return;
      }

      // Queue next frame
      requestRef.current = requestAnimationFrame(loop);
    };

    // Start loop
    requestRef.current = requestAnimationFrame(loop);

    // Cleanup on unmount or status change
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [state.training.status, dispatch]);
}
