import { useEffect } from "react";
import { useSimulationState } from "./simulation/useSimulationState";
import { useTrainingLoop } from "./simulation/useTrainingLoop";
import { NetworkGraph } from "./components/NetworkGraph";
import { useTilt } from "./hooks/useTilt";
import{ LossGraph } from "./components/LossGraph";
import "./App.css";

function App() {
  const { state, dispatch } = useSimulationState();
  const tiltRef = useTilt<HTMLDivElement>({ maxTilt: 8 });

  // Initialize network on mount
  useEffect(() => {
    if (!state.network) {
      dispatch({ type: "INIT_NETWORK" });
    }
  }, [state.network, dispatch]);

  // Hook up the training loop
  useTrainingLoop({ state, dispatch });

  const { training } = state;
  console.log(...state.history.getValues());

  return (
    <div className="container">
      <header className="header">
        <h1>NeuroLab</h1>
        <p className="subtitle">Real-time Neural Network Simulation</p>
      </header>

      <main className="dashboard">
        <section className="panel controls-panel">
          <h2>Controls</h2>
          <div className="button-group">
            {training.status !== "running" ? (
              <button 
                className="btn primary"
                onClick={() => dispatch({ type: "SET_STATUS", status: "running" })}
              >
                Start Training
              </button>
            ) : (
              <button 
                className="btn secondary"
                onClick={() => dispatch({ type: "SET_STATUS", status: "paused" })}
              >
                Pause
              </button>
            )}
            <button 
              className="btn outline"
              onClick={() => dispatch({ type: "RESET" })}
            >
              Reset
            </button>
          </div>
          
          <div className="speed-control">
            <label>Speed Multiplier</label>
            <label htmlFor="speed-select">
  Speed Multiplier
</label>

<select
  id="speed-select"
  value={training.speedMultiplier}
  onChange={(e) => {
    const val =
      e.target.value === "MAX"
        ? "MAX"
        : Number(e.target.value);

    dispatch({
      type: "SET_SPEED",
      speedMultiplier: val,
    });
  }}
> 
              <option value={1}>1x</option>
              <option value={10}>10x</option>
              <option value={100}>100x</option>
              <option value="MAX">MAX</option>
            </select>
          </div>
        </section>

        <div ref={tiltRef} className="network-card">
          <section className="panel graph-panel" style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            {state.topology ? (
              <NetworkGraph 
                snapshot={state.snapshot} 
                topology={state.topology.layerSizes} 
                dispatch={dispatch}
                selectedNeuron={state.ui.selectedNeuron}
              />
            ) : (
              <p style={{ color: '#9ca3af' }}>Loading network topology...</p>
            )}
          </section>
        </div>
      </main>

      <section className="panel loss-panel">
        <h2>Training Loss</h2>
        <LossGraph 
        history={state.history.getValues()}
         />
      </section>
    </div>
  );
}

export default App;