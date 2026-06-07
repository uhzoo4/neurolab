# NeuroLab MVP — Frontend Architecture Specification

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · HTML5 Canvas
**ML Engine:** `src/simulation/neuralNetwork.ts` (existing, pure TypeScript)
**Target:** Desktop-first responsive web, dark dashboard

---

## 1. Complete Folder Structure

```
neurolab/
├── index.html                              # Vite entry HTML
├── package.json                            # React 18, TypeScript, Tailwind, Vite, Vitest
├── tsconfig.json                           # Strict mode, path aliases: @/*
├── vite.config.ts                          # Vitest plugin, @/ alias → src/
├── tailwind.config.ts                      # Dark tokens, custom colors
├── postcss.config.js                       # Tailwind + autoprefixer
├── vitest.config.ts                        # Test config, coverage thresholds
├── .gitignore
├──
├── public/
│   └── favicon.svg                         # Neural network icon
│
├── src/
│   ├── main.tsx                            # React root: <StrictMode><App /></StrictMode>
│   ├── App.tsx                             # Top-level: <Dashboard> + keyboard shortcuts
│   ├── index.css                           # @tailwind directives + global dark tokens + scrollbar
│   │
│   ├── simulation/                         # ═══════════════════════════════════════════
│   │   │                                     # YOUR ENGINE (already implemented)
│   │   ├── neuralNetwork.ts                # NeuralNetwork class — THE CORE ENGINE
│   │   │                                     #   · Feedforward + backprop + SGD
│   │   │                                     #   · Float64Array throughout, zero allocations
│   │   │                                     #   · Exports: NeuralNetwork, Datasets, createDefaultXORNetwork
│   │   │
│   │   ├── useSimulationState.ts           # Single useReducer — owns network, snapshot, history
│   │   │                                     #   · Returns: state + dispatch + snapshotRef
│   │   │                                     #   · snapshotRef.current is MUTABLE — canvas reads this
│   │   │                                     #   · Actions: INIT, TRAIN_STEP, SET_STATUS, SET_SPEED,
│   │   │                                     #            SELECT_NEURON, RESET, SET_EPOCHS
│   │   │
│   │   ├── useTrainingLoop.ts              # requestAnimationFrame loop
│   │   │                                     #   · Reads: state.training.status, state.training.speed
│   │   │                                     #   · Calls: net.trainStep() × stepsPerFrame
│   │   │                                     #   · Dispatches: TRAIN_STEP action
│   │   │                                     #   · Pauses on: 'paused' | 'idle' | 'complete' | 'error'
│   │   │
│   │   └── useKeyboardShortcuts.ts         # Space = play/pause, R = reset, Escape = deselect
│   │
│   ├── types/                              # ═══════════════════════════════════════════
│   │   ├── simulation.ts                   # State shape, action union, ring buffer types
│   │   ├── visualization.ts              # NodePosition, EdgeRender, Viewport, HitTestResult
│   │   └── ui.ts                           # Theme tokens, PanelId, ToastMessage
│   │
│   ├── components/                         # ═══════════════════════════════════════════
│   │   │
│   │   ├── Dashboard.tsx                   # Root layout shell — 3-column CSS grid
│   │   │                                     #   · Left:   w-72 sidebar
│   │   │                                     #   · Center: flex-1 canvas area
│   │   │                                     #   · Right:  w-80 metrics panel
│   │   │                                     #   · Reads simulation status for global styling
│   │   │
│   │   ├── Layout/
│   │   │   ├── Header.tsx                  # NeuroLab logo + status dot + epoch badge
│   │   │   └── Sidebar.tsx                 # Left panel container (scrollable, custom scrollbar)
│   │   │
│   │   ├── NetworkGraph/                   # ═══════════════════════════════════════════
│   │   │   │                                 # THE CORE VISUALIZATION — Canvas 2D
│   │   │   ├── NetworkGraph.tsx            # React shell: mounts <canvas>, wires everything
│   │   │   │                                 #   · Owns: canvas ref, resize observer, hit-test
│   │   │   │                                 #   · Subscribes: snapshotRef (mutable), selectedNeuron
│   │   │   │                                 #   · Emits: onSelectNeuron(layer, index)
│   │   │   │                                 #   · Draw loop: independent rAF at 60fps
│   │   │   │
│   │   │   ├── layout.ts                   # Topology → screen-space coordinates
│   │   │   │                                 #   · Column layout: input left → output right
│   │   │   │                                 #   · Vertical centering, configurable padding
│   │   │   │                                 #   · Returns: Map<layer: number, Map<index: number, {x, y}>>
│   │   │   │                                 #   · Caches result until topology changes
│   │   │   │
│   │   │   ├── renderer.ts                 # Pure draw functions (no React)
│   │   │   │                                 #   · clearCanvas(canvas, theme)
│   │   │   │                                 #   · drawEdges(ctx, positions, weights, theme, selectedNeuron)
│   │   │   │                                 #   · drawNodes(ctx, positions, activations, theme, selectedNeuron)
│   │   │   │                                 #   · drawPulse(ctx, from, to, progress, theme)
│   │   │   │                                 #   · drawGrid(ctx, width, height, theme) — subtle background
│   │   │   │                                 #   · All color decisions driven by theme tokens
│   │   │   │
│   │   │   └── hitTest.ts                  # Mouse → neuron detection
│   │   │                                     #   · pointInNode(mouseX, mouseY, positions, radius)
│   │   │                                     #   · Returns: { layer, index } | null
│   │   │                                     #   · Radius = NODE_RADIUS + HIT_PADDING (4px)
│   │   │
│   │   ├── Controls/
│   │   │   ├── PlayPauseReset.tsx          # Train lifecycle: [▶ Play] [⏸ Pause] [↺ Reset]
│   │   │   │                                 #   · Disabled states based on training.status
│   │   │   │                                 #   · Play disabled when 'complete' or 'error'
│   │   │   │
│   │   │   └── SpeedControl.tsx            # Segmented control: 1× 2× 5× 10× MAX
│   │   │                                     #   · MAX = stepsPerFrame = 1000 (batch)
│   │   │                                     #   · Debounced dispatch to avoid storming
│   │   │
│   │   ├── ConfigPanel/
│   │   │   ├── NetworkSummary.tsx          # Read-only: "[2] → [4] → [1]" + neuron count + param count
│   │   │   ├── DatasetSelector.tsx         # XOR (default) | Circle boundary
│   │   │   ├── EpochConfig.tsx             # Total epochs input + auto-stop toggle
│   │   │   └── HyperParameters.tsx         # Learning rate slider + activation display
│   │   │
│   │   ├── Metrics/
│   │   │   ├── LossChart.tsx               # SVG real-time line chart
│   │   │   │                                 #   · Reads: history ring buffer
│   │   │   │                                 #   · Viewport: last N visible samples
│   │   │   │                                 #   · Auto-scrolls with training
│   │   │   │                                 #   · Y-axis: 0 to max loss in window
│   │   │   │                                 #   · X-axis: epoch number
│   │   │   │
│   │   │   ├── StatusBadge.tsx             # Pill badge: Running | Paused | Complete | Error | Idle
│   │   │   │                                 #   · Color-coded: green/yellow/blue/red/gray
│   │   │   │                                 #   · Shows: status + current epoch + last loss
│   │   │   │
│   │   │   └── EpochCounter.tsx            # "Epoch 1,247 / 10,000" progress indicator
│   │   │
│   │   └── Inspector/
│   │       └── NeuronInspector.tsx         # Right panel detail view
│   │                                         #   · Shows when selectedNeuron !== null
│   │                                         #   · Header: "Layer 2, Neuron 3"
│   │                                         #   · Table: incoming weights from all prev-layer neurons
│   │                                         #   · Bias value + activation bar
│   │                                         #   · Gradient bar for each weight
│   │                                         #   · Empty state: "Click a neuron to inspect"
│   │
│   └── utils/                              # ═══════════════════════════════════════════
│       ├── ringBuffer.ts                   # Fixed-capacity circular array for loss history
│       │                                     #   · Pre-allocated Float64Array, no GC
│       │                                     #   · append(value) + iterate(start, end)
│       │                                     #   · Used by useSimulationState for history
│       │
│       ├── colorScale.ts                   # Value → color mapping for heatmap visualization
│       │                                     #   · activationColor(value): 0=blue → 1=orange
│       │                                     #   · weightColor(value): negative=red → positive=green
│       │                                     #   · All colors from Tailwind palette mapped to hex
│       │
│       └── throttle.ts                     # requestAnimationFrame throttler
│                                             #   · throttleRAF(callback): runs at most once per frame
│                                             #   · Used by canvas draw loop for resize handling
│
└── tests/
    ├── simulation/
    │   ├── useSimulationState.test.ts        # Reducer action tests
    │   └── useTrainingLoop.test.ts           # Loop start/stop timing tests
    ├── components/
    │   ├── Dashboard.test.tsx                # Layout render test
    │   ├── Controls.test.tsx                 # Button interaction tests
    │   └── NetworkGraph.test.tsx             # Canvas mount + hitTest tests
    └── utils/
        ├── ringBuffer.test.ts                # Ring buffer correctness
        └── neuralNetwork.test.ts             # XOR convergence (your existing engine)
```

---

## 2. Component Hierarchy

```
<App>                                                    [root — keyboard shortcuts]
  │
  └── <Dashboard>                                        [3-column grid layout]
        │
        ├── <Sidebar>                                    [left column — w-72]
        │     ├── <Header>                               [logo + status dot]
        │     ├── <NetworkSummary>                       ["[2] → [4] → [1]"]
        │     ├── <DatasetSelector>                      [XOR | Circle]
        │     ├── <EpochConfig>                          [epochs input]
        │     ├── <HyperParameters>                      [learning rate]
        │     ├── <PlayPauseReset>                       [▶ ⏸ ↺]
        │     └── <SpeedControl>                         [1× 2× 5× 10× MAX]
        │
        ├── <main>                                       [center — flex-1]
        │     └── <NetworkGraph>                         [<canvas> — 60fps draw loop]
        │           ├── layout.ts    (imported)           [topology → positions]
        │           ├── renderer.ts  (imported)           [draw edges, nodes, pulses]
        │           └── hitTest.ts   (imported)           [mouse → neuron detection]
        │
        └── <aside>                                      [right column — w-80]
              ├── <StatusBadge>                          [Running | Paused | ...]
              ├── <EpochCounter>                         ["1,247 / 10,000"]
              ├── <LossChart>                            [SVG line graph]
              │
              └── <NeuronInspector>                      [conditional render]
                    ├── empty state: "Click a neuron"
                    └── selected state:
                          ├── Header: "Layer L, Neuron N"
                          ├── Activation bar
                          ├── Bias value
                          └── Weight table (incoming edges)
```

### React Re-render Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard — re-renders on: simulation.status, selectedNeuron           │
│  (shallow: only layout shell, children are stable)                      │
│                                                                         │
│  ├── Sidebar — re-renders on: topology, training config changes         │
│  │   └── Children: each subscribes to their own slice                   │
│  │                                                                      │
│  ├── <main> — NEVER re-renders (static container)                       │
│  │   └── NetworkGraph — React mount only, rAF loop after                │
│  │       Draw loop reads snapshotRef.current (mutable, not state)       │
│  │       Hit test → dispatch SELECT_NEURON (only user interaction)      │
│  │                                                                      │
│  └── <aside> — re-renders on: history, snapshot, selectedNeuron         │
│      └── LossChart — re-renders when history head changes (throttled)   │
│      └── NeuronInspector — re-renders only on SELECT_NEURON             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Decision: Canvas is React-Mount-Only

`NetworkGraph.tsx` renders once. After `useEffect` mount, all rendering happens via a dedicated `requestAnimationFrame` loop reading `snapshotRef.current`. The component never triggers a React re-render for visual updates. This is the single most important performance decision in the entire architecture.

---

## 3. React State Architecture

### Single Reducer Design

One `useReducer` with a flat state tree. No context, no external library. The state graph is narrow enough that prop-drilling is not a problem (Dashboard → direct children only).

```
SimulationState
├── topology:    { layerSizes, weights, biases }      ← read-only after INIT
├── training:    { status, currentEpoch, totalEpochs,
│                   speedMultiplier, stepsPerFrame }   ← UI-driven mutations
├── snapshot:    TrainingSnapshot | null               ← updated every train step
├── history:     RingBuffer                            ← pre-allocated, 1000 samples
└── ui:          { selectedNeuron }                    ← user interaction
```

### Why Not Context?

Context would force re-render of all consumers on every `TRAIN_STEP`. Instead:
- **Dashboard** receives `state` and `dispatch` via props (it's the immediate parent)
- **Canvas** reads `snapshotRef.current` (a mutable ref, not state) — zero React cost
- **LossChart** receives only `history` slice via props
- **Controls** receive only `training` slice via props

### Action Types

| Action | Payload | Effect |
|---|---|---|
| `INIT_NETWORK` | `{ config: NetworkConfig }` | Create NeuralNetwork, set topology, reset history |
| `TRAIN_STEP` | `{ snapshot: TrainingSnapshot }` | Replace snapshot, append to ring buffer, increment epoch |
| `SET_STATUS` | `{ status: TrainingStatus }` | idle → running → paused → complete → error |
| `SET_SPEED` | `{ speedMultiplier: number }` | Recalculate stepsPerFrame |
| `SET_EPOCHS` | `{ totalEpochs: number }` | Update target epoch count |
| `SELECT_NEURON` | `{ layer: number, index: number } \| null` | Highlight neuron + show inspector |
| `RESET` | — | Re-init weights, clear history, set status idle |
| `TRAINING_COMPLETE` | — | Auto-fired when epoch ≥ totalEpochs |
| `TRAINING_ERROR` | `{ error: NeuralNetworkError }` | Set status 'error', show message |

### snapshotRef Pattern

```typescript
// In useSimulationState.ts
const snapshotRef = useRef<TrainingSnapshot | null>(null);

// In the reducer, TRAIN_STEP action:
case "TRAIN_STEP":
  snapshotRef.current = action.snapshot;   // ← MUTATES REF (no re-render)
  return { ...state, snapshot: action.snapshot }; // ← state for React UI

// In NetworkGraph.tsx draw loop:
function draw() {
  const snap = snapshotRef.current;
  if (!snap) return;
  // draw edges with snap.activations
  // draw nodes with snap.activations
  requestAnimationFrame(draw);
}
```

The canvas reads from `snapshotRef.current` (instant, no React overhead). React UI reads from `state.snapshot` (triggers re-render for non-canvas components). This dual-read pattern is the bridge between the 60fps render world and the React state world.

### Ring Buffer for History

```typescript
class RingBuffer {
  private buffer: Float64Array;    // pre-allocated, length = capacity
  private timestamps: Float64Array; // parallel array
  private head: number = 0;         // next write index
  private length: number = 0;       // actual item count
  readonly capacity: number = 1000;

  append(loss: number, timestamp: number): void {
    this.buffer[this.head] = loss;
    this.timestamps[this.head] = timestamp;
    this.head = (this.head + 1) % this.capacity;
    if (this.length < this.capacity) this.length++;
  }

  // Returns a copy for React/SVG consumption
  toArray(): { losses: number[]; timestamps: number[] } { ... }
}
```

Pre-allocated, zero GC pressure. The LossChart calls `toArray()` at its own cadence (throttled to ~10fps, not 60fps).

---

## 4. Canvas Rendering Architecture

### Rendering Pipeline (per frame)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         rAF DRAW LOOP                                │
│                         ~60 fps (16.6ms budget)                      │
│                                                                      │
│  1. Resize Check                                                     │
│     └─ If canvas尺寸 ≠ container尺寸 → resize + recalculate layout  │
│                                                                      │
│  2. Clear                                                            │
│     └─ fillRect with bg color (slate-900)                            │
│     └─ Optional: subtle grid overlay                                 │
│                                                                      │
│  3. Draw Edges (bottom layer)                                        │
│     └─ For each weight W[i][j]:                                      │
│        · Color:   positive = cyan (weight strength),                 │
│                   negative = rose                                    │
│        · Opacity: |weight| × scale (clamped 0.1–1.0)                │
│        · Width:   0.5px–3px based on |weight|                        │
│        · If selected neuron: highlight connected edges, dim others   │
│                                                                      │
│  4. Draw Pulse Animation                                             │
│     └─ Forward pass propagation: a traveling glow along edges        │
│     └─ Simple: interpolate a glowing circle position over ~300ms     │
│     └─ Only when snapshot changes (new train step)                   │
│                                                                      │
│  5. Draw Nodes (top layer)                                           │
│     └─ Circle per neuron:                                            │
│        · Radius:   12px (input), 10px (hidden), 14px (output)       │
│        · Fill:     activationColor(activation) — blue → orange       │
│        · Stroke:   2px, color varies by layer                        │
│        · If selected: 3px white stroke + glow shadow                 │
│                                                                      │
│  6. Draw Labels                                                      │
│     └─ Layer index above first column                                │
│     └─ Small activation value below selected neuron                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout Algorithm

```typescript
// Pseudocode for layout.ts
function computeLayout(
  topology: number[],      // e.g. [2, 4, 1]
  canvasWidth: number,
  canvasHeight: number,
  padding: Padding = { top: 40, bottom: 40, left: 60, right: 60 }
): NodePosition[][] {
  // Distribute layers horizontally
  const layerCount = topology.length;
  const usableWidth = canvasWidth - padding.left - padding.right;
  const usableHeight = canvasHeight - padding.top - padding.bottom;
  const colSpacing = usableWidth / (layerCount - 1);

  const positions: NodePosition[][] = [];

  for (let l = 0; l < layerCount; l++) {
    const x = padding.left + l * colSpacing;
    const neuronCount = topology[l];
    const rowSpacing = usableHeight / Math.max(neuronCount - 1, 1);

    const layerPositions: NodePosition[] = [];
    for (let n = 0; n < neuronCount; n++) {
      const y = neuronCount === 1
        ? canvasHeight / 2                               // single neuron: center vertically
        : padding.top + n * rowSpacing;                  // multiple: distributed
      layerPositions.push({ layer: l, index: n, x, y });
    }
    positions.push(layerPositions);
  }

  return positions;
}
```

### Color System

All colors derived from Tailwind tokens, mapped to hex in `colorScale.ts`:

```typescript
const PALETTE = {
  // Background
  bg: "#0f172a",            // slate-900
  grid: "#1e293b",          // slate-800

  // Neuron activation (heatmap)
  activation: {
    0.0: "#3b82f6",         // blue-500   (inactive)
    0.5: "#8b5cf6",         // violet-500 (mid)
    1.0: "#f97316",         // orange-500 (active)
  },

  // Edge weights
  weight: {
    negative: "#f43f5e",    // rose-500
    positive: "#06b6d4",    // cyan-500
    zero: "#475569",        // slate-600
  },

  // Layer ring colors
  layers: ["#64748b", "#3b82f6", "#f59e0b"],  // slate, blue, amber
};
```

### Performance Budget

```
Target: 60fps = 16.67ms per frame
Budget allocation:
  · Edge drawing (worst case: 2×4 + 4×1 = 12 edges): ~1ms
  · Node drawing (worst case: 2+4+1 = 7 nodes): ~0.3ms
  · Pulse animation (optional): ~0.5ms
  · Clear + grid: ~0.2ms
  ─────────────────────────────────
  Total: ~2ms (well within 16.67ms budget)
  Headroom: 85% — safe for slower machines
```

### Responsive Behavior

- `ResizeObserver` on the canvas container (not `window.resize`)
- On resize: debounce 100ms → recalculate layout → next frame uses new positions
- Canvas `devicePixelRatio` aware: `canvas.width = cssWidth * dpr`

---

## 5. Training Loop Architecture

### Two-Loop System

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOOP 1: CANVAS RENDER LOOP                        │
│                    requestAnimationFrame @ 60fps                     │
│                    Owner: NetworkGraph.tsx                            │
│                                                                      │
│  Purpose: Visualize current state                                    │
│  Input:   snapshotRef.current (mutable)                              │
│  Output:  Painted canvas                                             │
│  Cost:    ~2ms/frame, never blocks                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  independent
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LOOP 2: TRAINING LOOP                             │
│                    requestAnimationFrame @ variable                   │
│                    Owner: useTrainingLoop.ts                          │
│                                                                      │
│  Purpose: Execute neural network training steps                      │
│  Input:   network instance, dataset, speed config                    │
│  Output:  TRAIN_STEP dispatch → state update → snapshotRef update    │
│  Cost:    Variable (depends on stepsPerFrame)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Training Loop Detailed Flow

```
useTrainingLoop.ts
│
├─ useEffect on [status, speedMultiplier]
│   └─ if status === 'running':
│       startLoop()
│   └─ if status === 'paused' | 'idle' | 'complete' | 'error':
│       stopLoop()
│
├─ startLoop()
│   └─ Define tick():
│       1. Compute stepsPerFrame from speedMultiplier
│          · 1× → 1 step
│          · 2× → 2 steps
│          · 5× → 5 steps
│          · 10× → 10 steps
│          · MAX → 1000 steps (batch mode, no visualization between)
│
│       2. Execute net.trainStep() × stepsPerFrame
│          · Iterate through dataset (round-robin)
│          · Catch NeuralNetworkError → dispatch TRAINING_ERROR
│          · Accumulate snapshots (only keep the last one for dispatch)
│
│       3. Dispatch TRAIN_STEP with final snapshot
│          · Reducer updates: state.snapshot, state.history, state.training.currentEpoch
│          · snapshotRef.current = action.snapshot (canvas picks it up)
│
│       4. Check completion:
│          · if currentEpoch ≥ totalEpochs:
│              dispatch TRAINING_COMPLETE → status 'complete'
│              stopLoop()
│
│       5. Schedule next tick:
│          · if still 'running': requestAnimationFrame(tick)
│
├─ stopLoop()
│   └─ cancelAnimationFrame(handle)
│   └─ handle = null
```

### Adaptive Frame Budget

```typescript
// In useTrainingLoop.ts — adaptive quality based on frame timing
function tick() {
  const startTime = performance.now();

  // Run training steps
  for (let i = 0; i < stepsPerFrame; i++) {
    // ... train step
  }

  const elapsed = performance.now() - startTime;

  // If we're consistently taking > 16ms, reduce steps
  if (elapsed > 16 && adaptiveMode) {
    stepsPerFrame = Math.max(1, Math.floor(stepsPerFrame * 0.8));
  }

  if (status === 'running') {
    rafHandle = requestAnimationFrame(tick);
  }
}
```

### Speed Multiplier Mapping

| Speed Label | stepsPerFrame | Typical Use Case |
|---|---|---|
| 1× | 1 | Watch every step, study dynamics |
| 2× | 2 | Slightly faster observation |
| 5× | 5 | Good balance of speed and visibility |
| 10× | 10 | Fast training, still see updates |
| MAX | 1000 | Batch mode, only final state matters |

At MAX speed, the canvas still renders at 60fps but only sees ~1 snapshot per 60 frames (the last one from the batch). The UI remains responsive because the dispatch is amortized.

---

## 6. Data Flow Diagram

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
│                                                                              │
│   ┌─────────────────────┐   ┌─────────────────────┐   ┌──────────────────┐ │
│   │ User Interaction    │   │ NeuralNetwork Engine │   │ Default Config   │ │
│   │ (clicks, keyboard)  │   │ (neuralNetwork.ts)  │   │ (XOR, 2→4→1)    │ │
│   └──────────┬──────────┘   └──────────┬──────────┘   └──────────┬───────┘ │
│              │                         │                         │         │
│              │   click neuron          │   trainStep()           │         │
│              │   click play/pause      │   → snapshot            │         │
│              │   drag speed slider     │                         │         │
│              ▼                         ▼                         ▼         │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIMULATION STATE (useReducer)                        │
│                         Owner: useSimulationState.ts                          │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  State Tree                                                         │   │
│   │  ├── topology        ←── INIT_NETWORK (from NetworkConfig)         │   │
│   │  ├── training        ←── SET_STATUS, SET_SPEED, SET_EPOCHS         │   │
│   │  ├── snapshot        ←── TRAIN_STEP (from engine)                  │   │
│   │  ├── history         ←── TRAIN_STEP (ring buffer append)           │   │
│   │  └── ui              ←── SELECT_NEURON                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Outputs:  { state, dispatch, snapshotRef }                                 │
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐   │
│   │ state        │  │ dispatch()   │  │ snapshotRef.current             │   │
│   │ (immutable)  │  │ (actions)    │  │ (mutable — for canvas only)     │   │
│   └──────┬───────┘  └──────┬───────┘  └──────────────┬──────────────────┘   │
└──────────┼─────────────────┼────────────────────────┼──────────────────────┘
           │                 │                        │
           │                 │                        │
     ┌─────┴─────┐   ┌──────┴──────┐          ┌──────┴────────┐
     │           │   │             │          │               │
     ▼           ▼   ▼             ▼          ▼               ▼
┌─────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────────┐
│ Sidebar │ │ Controls │ │ LossChart    │ │ Status   │ │ Canvas Draw   │
│ Panel   │ │ Buttons  │ │ (SVG)        │ │ Badge    │ │ Loop (rAF)    │
│         │ │          │ │              │ │          │ │               │
│ Reads:  │ │ Reads:   │ │ Reads:       │ │ Reads:   │ │ Reads:        │
│ topology│ │ training │ │ history      │ │ training │ │ snapshotRef   │
│         │ │ status   │ │ (toArray)    │ │ snapshot │ │ .current      │
│         │ │          │ │              │ │          │ │               │
│ Writes: │ │ Writes:  │ │              │ │          │ │               │
│ —       │ │ dispatch │ │              │ │          │ │               │
│         │ │ SET_*    │ │              │ │          │ │               │
└─────────┘ └──────────┘ └──────────────┘ └──────────┘ └───────────────┘
     │            │              │              │               │
     │            │              │              │               │
     └────────────┴──────────────┴──────────────┘               │
                          │                                     │
                          ▼                                     ▼
               ┌──────────────────────┐              ┌────────────────────┐
               │   React DOM Updates  │              │  Canvas 2D Paint   │
               │   (selective, 10fps) │              │  (60fps, direct)   │
               └──────────────────────┘              └────────────────────┘
```

### Critical Path: A Single Training Step

```
1. useTrainingLoop tick() fires
        │
        ▼
2. NeuralNetwork.trainStep(input, target)
   ├─ Forward pass  → preActivations[], activations[]
   ├─ Loss compute  → lossValue
   ├─ Backward pass → deltas[] (gradients)
   ├─ SGD update    → weights[] -= lr * grad
   └─ Returns TrainingSnapshot { activations, deltas, loss, ... }
        │
        ▼
3. dispatch({ type: "TRAIN_STEP", snapshot })
        │
        ▼
4. Reducer executes:
   ├─ state.snapshot = action.snapshot
   ├─ snapshotRef.current = action.snapshot   ← canvas bridge
   ├─ history.append(snapshot.lossValue, now)
   ├─ state.training.currentEpoch += 1
   └─ if epoch >= totalEpochs: status = 'complete'
        │
        ├───► Canvas rAF loop (next frame)
        │     reads snapshotRef.current → draws updated neurons/edges
        │
        ├───► LossChart (throttled ~10fps)
        │     reads history.toArray() → redraws SVG path
        │
        ├───► StatusBadge
        │     reads state.training → updates text + color
        │
        └───► NeuronInspector (if visible)
              reads state.snapshot + ui.selectedNeuron → updates weight table
```

### Anti-Pattern Prevented: React Re-render on Every Frame

```
WRONG (would kill performance):
  trainStep() → dispatch() → React re-render Dashboard
  → re-render Sidebar + Metrics + Inspector + NetworkGraph
  → NetworkGraph re-mounts canvas, starts new rAF loop
  → 60 re-renders/second × full component tree

CORRECT (this architecture):
  trainStep() → dispatch() → Reducer updates state
  → snapshotRef.current = newSnapshot   (MUTATION, no re-render)
  → Canvas rAF loop reads ref next frame (already running, continuous)
  → React UI components update on their own cadence
     · LossChart: throttled to 10fps
     · StatusBadge: every 5th frame
     · Inspector: only on SELECT_NEURON
```

---

## 7. Development Milestones

### Dependency Graph

```
M1 ──→ M2 ──→ M3 ──→ M4 ──→ M5
              │               │
              └──→ M3b ───────┘
```

### M1 — State Architecture + Engine Integration
**Effort:** 2–3 days  
**Goal:** The simulation layer exists and can train XOR end-to-end via console.

| Task | Files |
|---|---|
| Define `types/simulation.ts` — full state shape + action union | `types/simulation.ts` |
| Implement `useSimulationState.ts` — reducer with all actions | `simulation/useSimulationState.ts` |
| Implement `useTrainingLoop.ts` — rAF loop, speed control, error handling | `simulation/useTrainingLoop.ts` |
| Implement `RingBuffer` utility | `utils/ringBuffer.ts` |
| Wire App.tsx to mount Dashboard with state | `App.tsx` |
| Console smoke test: click Play → see epochs increment, loss decrease | — |

**Definition of Done:**
- `dispatch({ type: "INIT_NETWORK" })` creates a working network
- `dispatch({ type: "SET_STATUS", status: "running" })` starts training
- `state.training.currentEpoch` increments at ~60 steps/sec at 1× speed
- `state.history` contains loss samples after 5 seconds of training
- `dispatch({ type: "RESET" })` re-initializes everything

---

### M2 — Dashboard Shell + Controls
**Effort:** 2 days  
**Goal:** The UI structure is visible and interactive. No canvas yet.

| Task | Files |
|---|---|
| Dashboard.tsx — 3-column grid, dark theme | `components/Dashboard.tsx` |
| Header.tsx — logo + status dot | `components/Layout/Header.tsx` |
| Sidebar.tsx — left panel container | `components/Layout/Sidebar.tsx` |
| NetworkSummary.tsx — read-only topology display | `components/ConfigPanel/NetworkSummary.tsx` |
| DatasetSelector.tsx — XOR / Circle toggle | `components/ConfigPanel/DatasetSelector.tsx` |
| EpochConfig.tsx — epoch count input | `components/ConfigPanel/EpochConfig.tsx` |
| PlayPauseReset.tsx — train lifecycle buttons | `components/Controls/PlayPauseReset.tsx` |
| SpeedControl.tsx — speed segmented control | `components/Controls/SpeedControl.tsx` |
| StatusBadge.tsx — colored status pill | `components/Metrics/StatusBadge.tsx` |
| EpochCounter.tsx — "1,247 / 10,000" | `components/Metrics/EpochCounter.tsx` |
| Tailwind dark tokens + global CSS | `index.css`, `tailwind.config.ts` |

**Definition of Done:**
- Dashboard renders with correct 3-column layout
- Play/Pause/Reset buttons work and show correct disabled states
- Speed control switches between 1×–MAX
- Status badge changes color with training state
- All controls dispatch correct actions

---

### M3 — Network Graph (Canvas Visualization)
**Effort:** 4–5 days (the hardest milestone)  
**Goal:** The neural network is visible, animated, and interactive.

| Task | Files |
|---|---|
| NetworkGraph.tsx — canvas mount, rAF loop, resize observer | `components/NetworkGraph/NetworkGraph.tsx` |
| layout.ts — layer → (x, y) positioning | `components/NetworkGraph/layout.ts` |
| renderer.ts — drawEdges, drawNodes, drawPulse, clear | `components/NetworkGraph/renderer.ts` |
| colorScale.ts — value → color utilities | `utils/colorScale.ts` |
| hitTest.ts — mouse → neuron detection | `components/NetworkGraph/hitTest.ts` |
| Pulse animation on forward pass | `components/NetworkGraph/renderer.ts` |
| Hover highlight (connected edges glow) | `components/NetworkGraph/NetworkGraph.tsx` |
| Click → dispatch SELECT_NEURON | `components/NetworkGraph/NetworkGraph.tsx` |
| Edge color = weight sign + magnitude | `components/NetworkGraph/renderer.ts` |
| Node fill = activation heatmap | `components/NetworkGraph/renderer.ts` |
| Responsive canvas (ResizeObserver + devicePixelRatio) | `components/NetworkGraph/NetworkGraph.tsx` |

**Definition of Done:**
- Canvas fills the center column, crisp on Retina displays
- Neurons appear as circles in correct layered layout
- Edges connect all neurons between adjacent layers
- Node colors change as activations update during training
- Edge thickness/opacity reflects weight magnitude
- Hovering a neuron highlights its connected edges
- Clicking a neuron dispatches SELECT_NEURON and shows highlight ring
- Pulse animation plays briefly on each forward pass
- Canvas runs at 60fps with <5ms frame time

---

### M3b — Loss Chart + Neuron Inspector
**Effort:** 2–3 days (parallel with M3)  
**Goal:** Metrics are visible, neuron details are inspectable.

| Task | Files |
|---|---|
| LossChart.tsx — SVG polyline, auto-scroll | `components/Metrics/LossChart.tsx` |
| NeuronInspector.tsx — weight table + bias display | `components/Inspector/NeuronInspector.tsx` |
| Empty state for inspector | `components/Inspector/NeuronInspector.tsx` |
| Keyboard shortcuts (Space, R, Escape) | `simulation/useKeyboardShortcuts.ts` |

**Definition of Done:**
- LossChart renders a scrolling line that tracks training loss
- Chart auto-scrolls to show the most recent N epochs
- Y-axis scales to visible data range
- NeuronInspector shows correct weights for selected neuron
- Weight values are sortable or at least clearly tabulated
- Spacebar toggles play/pause
- R key resets
- Escape deselects neuron

---

### M4 — Integration + Polish
**Effort:** 2 days  
**Goal:** Everything works together smoothly.

| Task | Files |
|---|---|
| End-to-end: Play → train → loss < 0.01 → Complete | all |
| Error state: graceful NaN handling with toast message | `App.tsx` |
| Loading skeleton while engine initializes | `Dashboard.tsx` |
| Keyboard shortcut edge cases (no double rAF) | `useTrainingLoop.ts` |
| Ring buffer overflow handling (thinning) | `utils/ringBuffer.ts` |
| Component-level React.memo where beneficial | various |
| Cleanup: remove dead code, add comments | all |

**Definition of Done:**
- Full XOR training completes in < 30 seconds at MAX speed
- Loss reliably drops below 0.01
- No NaN errors in normal operation
- NaN detection works and shows user-friendly message
- All keyboard shortcuts work without edge cases
- No memory leaks (confirmed via DevTools Performance tab)

---

### M5 — Testing + Validation
**Effort:** 2 days  
**Goal:** Confidence in correctness and stability.

| Task | Files |
|---|---|
| Unit: RingBuffer append/iterate/wrap | `tests/utils/ringBuffer.test.ts` |
| Unit: Reducer each action type | `tests/simulation/useSimulationState.test.ts` |
| Unit: colorScale interpolation | `tests/utils/colorScale.test.ts` |
| Integration: Play → Pause → Resume flow | `tests/simulation/useTrainingLoop.test.ts` |
| Integration: XOR converges (existing engine test) | `tests/utils/neuralNetwork.test.ts` |
| Component: Dashboard renders without crash | `tests/components/Dashboard.test.tsx` |
| Component: Buttons dispatch correct actions | `tests/components/Controls.test.tsx` |
| E2E: Full train cycle via simulated clicks | manual |
| Performance: 60fps canvas confirmed | manual (DevTools) |

**Definition of Done:**
- All tests pass (`npm test`)
- Coverage ≥ 70% for simulation logic
- Manual QA: train, pause, resume, reset, select neuron, inspect, change speed
- No console errors or warnings

---

## Appendix A: Key Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Single `useReducer`, no external state lib** | State graph is narrow (~5 keys). Adding Zustand/Jotai is over-engineering for MVP. Revisit when > 10 action types or > 20 state keys. |
| **Canvas 2D, not WebGL** | A 2-layer MLP with ≤ 50 neurons draws < 100 edges. Canvas 2D handles this at < 5ms/frame. WebGL adds 500KB+ bundle and shader complexity for no gain. |
| **SVG for LossChart, not Canvas** | One polyline updating ~10×/second is trivial for SVG. Using Canvas would require a second rAF loop and more code. SVG gives free responsiveness and accessibility. |
| **snapshotRef dual-read pattern** | The canvas needs 60fps reads. React state updates trigger re-renders. By writing to a mutable ref, the canvas reads instantly without React overhead. React UI still gets state updates for its own render cycle. |
| **Float64Array everywhere** | 64-bit precision prevents accumulation error in backprop. Tighter memory layout than `number[]`. Zero GC allocations during training (buffers are reused). |
| **Ring buffer for history** | Pre-allocated, no array growth, no GC pauses. Fixed at 1000 samples — when full, old samples are overwritten. LossChart reads from this buffer. |
| **No `React.Context`** | Context triggers re-render of all consumers on any state change. With our reducer, we pass specific state slices as props, so only relevant components re-render. |
| **Xavier/He weight initialization** | Standard practice. Sigmoid/tanh use Xavier (preserves variance through layers). ReLU uses He (accounts for zeroed negatives). Prevents vanishing/exploding activations. |
| **Mulberry32 PRNG** | Seeded random enables reproducible demos. A reviewer can run the same seed and see identical training curves. Swappable with `Math.random` when seed not needed. |
| **Training loop and render loop are separate** | Decouples frame rate from training throughput. At MAX speed, the network runs 1000 steps per frame while the canvas still renders at 60fps. |

## Appendix B: Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| NaN loss from exploding gradients | Medium | Engine detects NaN and throws `NeuralNetworkError`. UI catches and shows toast. Default LR=0.5 with sigmoid is stable for XOR. |
| Canvas not keeping up at 60fps on low-end hardware | Low | Frame budget analysis shows 85% headroom. Adaptive step reduction if frame time > 16ms. |
| Memory leak from rAF loops | Low | `useEffect` cleanup always calls `cancelAnimationFrame`. Loop handle stored in ref, not state. |
| Ring buffer overflow | Very Low | Fixed 1000-sample capacity. At 60fps × 10× speed, fills in ~10 seconds. LossChart auto-thins when reading. |
| React state desync from canvas | Low | Single source of truth: snapshotRef is written by the reducer simultaneously with state. No separate update path. |
| Training loop stacks (multiple rAF) | Low | `startLoop` checks `if (rafHandle !== null) return;` before scheduling. `stopLoop` always cancels. |
| Neuron layout breaks on resize | Low | `ResizeObserver` + debounced layout recalculation. Positions recomputed before next draw frame. |
