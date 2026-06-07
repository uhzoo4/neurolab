/**
 * NeuroLab — Pure TypeScript Neural Network Engine
 *
 * A self-contained feedforward MLP with backpropagation and SGD.
 * Zero dependencies. Uses Float64Array for all numeric state.
 *
 * Architecture compatibility: Consumed by simulation hooks (useTrainingLoop,
 * useSimulationState). Returns TrainingSnapshot on every step for the
 * Canvas renderer and React UI.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported activation functions per layer.
 *  - sigmoid:   smooth 0→1, good for output layers
 *  - tanh:      smooth −1→1, zero-centered
 *  - relu:      max(0,x), fast, avoids vanishing gradients
 *  - leakyRelu: max(αx,x), small slope for negatives
 *  - linear:    identity, for regression output layers
 */
export type ActivationName = "sigmoid" | "tanh" | "relu" | "leakyRelu" | "linear";

/** Supported loss functions.
 *  - mse:              mean squared error (regression)
 *  - binaryCrossEntropy: log loss for single-output binary classification
 */
export type LossName = "mse" | "binaryCrossEntropy";

/** Network topology — immutable after construction for MVP. */
export interface NetworkConfig {
  /** Number of neurons in each layer, e.g. [2, 4, 1] */
  layerSizes: number[];
  /** Activation for each layer (length === layerSizes.length).
   *  Index 0 is the input layer (usually "linear"). */
  activations: ActivationName[];
  /** Loss function for the output layer. */
  loss: LossName;
  /** Learning rate for SGD. Default: 0.5 */
  learningRate: number;
  /** Seed for reproducible weight init. undefined = random. */
  seed?: number;
}

/** Mutable network parameters — weights and biases. */
export interface NetworkParameters {
  /** weights[l][i * layerSizes[l+1] + j] = W_l[i][j] */
  weights: Float64Array[];
  /** biases[l][j] = bias of neuron j in layer l */
  biases: Float64Array[];
}

/** Snapshot returned by every training step.
 *  The canvas renderer reads this at 60fps via snapshotRef. */
export interface TrainingSnapshot {
  /** Pre-activation values (z = Wx + b) for each layer. */
  preActivations: Float64Array[];
  /** Post-activation values (a = activate(z)) for each layer. */
  activations: Float64Array[];
  /** Gradients ∂L/∂z for each layer (from backprop). */
  deltas: Float64Array[];
  /** Current input vector. */
  input: Float64Array;
  /** Expected output vector. */
  target: Float64Array;
  /** Network prediction (output layer activation). */
  prediction: Float64Array;
  /** Scalar loss value. */
  lossValue: number;
  /** Flattened weights for inspection. */
  weights: Float64Array[];
  /** Flattened weight gradients for inspection. */
  weightGradients: Float64Array[];
  /** Bias gradients for inspection. */
  biasGradients: Float64Array[];
}

/** Per-step metadata for history tracking. */
export interface StepMetrics {
  epoch: number;
  loss: number;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeded PRNG (Mulberry32) — reproducible weight initialization
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultRng(): () => number {
  return () => Math.random();
}

// ─────────────────────────────────────────────────────────────────────────────
// Activation functions and their derivatives
// ─────────────────────────────────────────────────────────────────────────────

function activate(x: number, name: ActivationName): number {
  switch (name) {
    case "sigmoid":
      // Numerically stable sigmoid
      return x >= 0
        ? 1 / (1 + Math.exp(-x))
        : Math.exp(x) / (1 + Math.exp(x));
    case "tanh":
      return Math.tanh(x);
    case "relu":
      return x > 0 ? x : 0;
    case "leakyRelu":
      return x > 0 ? x : 0.01 * x;
    case "linear":
      return x;
  }
}

/** Derivative dy/dx where y = activate(x). Requires the *output* y for
 *  sigmoid and tanh (more efficient). */
function activateDerivative(y: number, name: ActivationName): number {
  switch (name) {
    case "sigmoid":
      return y * (1 - y);
    case "tanh":
      return 1 - y * y;
    case "relu":
      return y > 0 ? 1 : 0;
    case "leakyRelu":
      return y > 0 ? 1 : 0.01;
    case "linear":
      return 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loss functions and their derivatives
// ─────────────────────────────────────────────────────────────────────────────

function computeLoss(pred: Float64Array, target: Float64Array, name: LossName): number {
  let sum = 0;
  const n = pred.length;
  switch (name) {
    case "mse": {
      for (let i = 0; i < n; i++) {
        const diff = pred[i] - target[i];
        sum += diff * diff;
      }
      return sum / n;
    }
    case "binaryCrossEntropy": {
      // Add epsilon to avoid log(0)
      const eps = 1e-7;
      for (let i = 0; i < n; i++) {
        const p = Math.max(eps, Math.min(1 - eps, pred[i]));
        sum -= target[i] * Math.log(p) + (1 - target[i]) * Math.log(1 - p);
      }
      return sum / n;
    }
  }
}

/**
 * Derivative of loss with respect to the *prediction* (output activation).
 * For backprop: ∂L/∂a_last.
 */
function lossDerivative(pred: Float64Array, target: Float64Array, name: LossName, outGrad: Float64Array): void {
  const n = pred.length;
  switch (name) {
    case "mse": {
      // d/dp [(p-t)²] = 2(p-t); averaged → 2(p-t)/n
      const scale = 2 / n;
      for (let i = 0; i < n; i++) {
        outGrad[i] = (pred[i] - target[i]) * scale;
      }
      break;
    }
    case "binaryCrossEntropy": {
      const eps = 1e-7;
      for (let i = 0; i < n; i++) {
        const p = Math.max(eps, Math.min(1 - eps, pred[i]));
        outGrad[i] = (p - target[i]) / (p * (1 - p));
      }
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NeuralNetwork class
// ─────────────────────────────────────────────────────────────────────────────

export class NeuralNetwork {
  /** Immutable topology configuration. */
  readonly config: Readonly<NetworkConfig>;

  /** Mutable weights and biases. */
  readonly params: NetworkParameters;

  /** Number of layers (including input). */
  readonly numLayers: number;

  private readonly _rng: () => number;
  private _epoch: number = 0;
  private _stepCount: number = 0;

  /** Reusable buffers to avoid GC during training. */
  private _bufPre: Float64Array[];
  private _bufAct: Float64Array[];
  private _bufDelta: Float64Array[];
  private _bufWGrad: Float64Array[];
  private _bufBGrad: Float64Array[];
  private _bufOutputGrad: Float64Array;

  constructor(config: NetworkConfig) {
    // Validate
    if (config.layerSizes.length < 2) {
      throw new Error(
        `Network must have at least 2 layers (input + output), got ${config.layerSizes.length}`
      );
    }
    if (config.activations.length !== config.layerSizes.length) {
      throw new Error(
        `activations length (${config.activations.length}) must match layerSizes length (${config.layerSizes.length})`
      );
    }
    for (let i = 0; i < config.layerSizes.length; i++) {
      if (config.layerSizes[i] <= 0) {
        throw new Error(`Layer ${i} size must be positive, got ${config.layerSizes[i]}`);
      }
    }
    if (config.learningRate <= 0) {
      throw new Error(`learningRate must be positive, got ${config.learningRate}`);
    }

    this.config = { ...config };
    this.numLayers = config.layerSizes.length;
    this._rng = config.seed !== undefined ? mulberry32(config.seed) : defaultRng();

    // Initialize weights and biases
    const weights: Float64Array[] = [];
    const biases: Float64Array[] = [];

    for (let l = 0; l < this.numLayers - 1; l++) {
      const rows = config.layerSizes[l];      // neurons in current layer
      const cols = config.layerSizes[l + 1];  // neurons in next layer
      const w = new Float64Array(rows * cols);
      const b = new Float64Array(cols);

      // Xavier initialization: scale by sqrt(2 / (fan_in + fan_out))
      // For ReLU/LeakyReLU use He init (sqrt(2/fan_in)) — detect via next layer activation
      const nextAct = config.activations[l + 1];
      const useHe = nextAct === "relu" || nextAct === "leakyRelu";
      const fanIn = rows;
      const fanOut = cols;
      const stdDev = useHe
        ? Math.sqrt(2.0 / fanIn)
        : Math.sqrt(2.0 / (fanIn + fanOut));

      for (let i = 0; i < w.length; i++) {
        // Box-Muller approximation via central limit for speed
        // Actually, uniform is fine with Xavier scaling
        w[i] = (this._rng() * 2 - 1) * stdDev;
      }
      for (let j = 0; j < cols; j++) {
        b[j] = 0; // Biases initialized to zero
      }

      weights.push(w);
      biases.push(b);
    }

    this.params = { weights, biases };

    // Pre-allocate reusable buffers for the forward/backward pass
    this._bufPre = [];
    this._bufAct = [];
    this._bufDelta = [];
    this._bufWGrad = [];
    this._bufBGrad = [];

    // Layer 0 = input (no weights leading to it, but we store activations)
    for (let l = 0; l < this.numLayers; l++) {
      const size = config.layerSizes[l];
      this._bufAct.push(new Float64Array(size));
      if (l > 0) {
        // Pre-activations, deltas, gradients for non-input layers
        this._bufPre.push(new Float64Array(size));
        this._bufDelta.push(new Float64Array(size));
        this._bufBGrad.push(new Float64Array(size));
      }
      if (l < this.numLayers - 1) {
        this._bufWGrad.push(new Float64Array(config.layerSizes[l] * config.layerSizes[l + 1]));
      }
    }
    // Shift arrays to align with layer indexing (layer 0 = input, no pre/delta)
    this._bufPre = [new Float64Array(0), ...this._bufPre];     // index 0 unused
    this._bufDelta = [new Float64Array(0), ...this._bufDelta]; // index 0 unused
    this._bufBGrad = [new Float64Array(0), ...this._bufBGrad]; // index 0 unused

    this._bufOutputGrad = new Float64Array(config.layerSizes[this.numLayers - 1]);
  }

  /** Current epoch count. */
  get epoch(): number {
    return this._epoch;
  }

  /** Total training steps executed. */
  get stepCount(): number {
    return this._stepCount;
  }

  /**
   * Forward pass: input → output activations.
   *
   * @param input  Input vector (length === layerSizes[0]). Not modified.
   * @returns      Output activations (length === layerSizes[-1]).
   */
  forward(input: Float64Array): Float64Array {
    this._validateInput(input);

    // Copy input into layer 0 activations
    const inputLayerSize = this.config.layerSizes[0];
    const act0 = this._bufAct[0];
    for (let i = 0; i < inputLayerSize; i++) {
      act0[i] = input[i];
    }

    // Propagate through each weight layer
    for (let l = 0; l < this.numLayers - 1; l++) {
      const currentSize = this.config.layerSizes[l];
      const nextSize = this.config.layerSizes[l + 1];
      const w = this.params.weights[l];
      const b = this.params.biases[l];
      const currentAct = this._bufAct[l];
      const pre = this._bufPre[l + 1];
      const nextAct = this._bufAct[l + 1];
      const actName = this.config.activations[l + 1];

      for (let j = 0; j < nextSize; j++) {
        // z_j = b_j + Σ_i (a_i * W_ij)
        let z = b[j];
        for (let i = 0; i < currentSize; i++) {
          z += currentAct[i] * w[i * nextSize + j];
        }
        pre[j] = z;
        nextAct[j] = activate(z, actName);
      }
    }

    // Return a copy of the output
    const outputSize = this.config.layerSizes[this.numLayers - 1];
    const output = new Float64Array(outputSize);
    const outputAct = this._bufAct[this.numLayers - 1];
    for (let i = 0; i < outputSize; i++) {
      output[i] = outputAct[i];
    }
    return output;
  }

  /**
   * Full training step: forward → loss → backward → SGD update.
   *
   * @param input   Input vector.
   * @param target  Expected output vector.
   * @returns       TrainingSnapshot with activations, gradients, loss.
   */
  trainStep(input: Float64Array, target: Float64Array): TrainingSnapshot {
    this._validateInput(input);
    this._validateTarget(target);

    // ── Forward pass ─────────────────────────────────────────────────────
    this.forward(input); // populates _bufAct and _bufPre

    const outputLayer = this.numLayers - 1;
    const outputAct = this._bufAct[outputLayer];
    const outputSize = this.config.layerSizes[outputLayer];

    // Copy output for snapshot
    const prediction = new Float64Array(outputSize);
    for (let i = 0; i < outputSize; i++) {
      prediction[i] = outputAct[i];
    }

    // ── Loss ─────────────────────────────────────────────────────────────
    const lossValue = computeLoss(outputAct, target, this.config.loss);

    // Check for NaN — this is a safety net per the risk register
    if (Number.isNaN(lossValue)) {
      throw new NeuralNetworkError(
        "Loss became NaN. Possible causes: learning rate too high, exploding gradients, or bad input data.",
        "nan_loss",
        { epoch: this._epoch, input: Array.from(input), target: Array.from(target) }
      );
    }

    // ── Backward pass ────────────────────────────────────────────────────

    // Output layer: ∂L/∂z = ∂L/∂a * ∂a/∂z
    lossDerivative(outputAct, target, this.config.loss, this._bufOutputGrad);
    const lossGrad = this._bufOutputGrad;
    const outputDelta = this._bufDelta[outputLayer];
    const outputPre = this._bufPre[outputLayer];
    const outputActName = this.config.activations[outputLayer];

    for (let j = 0; j < outputSize; j++) {
      // Use pre-activation for derivative (more accurate for some activations)
      // But for sigmoid/tanh we can use outputAct for efficiency
      let dadz: number;
      if (outputActName === "sigmoid" || outputActName === "tanh") {
        dadz = activateDerivative(outputAct[j], outputActName);
      } else {
        dadz = activateDerivative(outputPre[j], outputActName);
      }
      outputDelta[j] = lossGrad[j] * dadz;
    }

    // Hidden layers: propagate error backward
    for (let l = outputLayer - 1; l >= 1; l--) {
      const currentSize = this.config.layerSizes[l];
      const nextSize = this.config.layerSizes[l + 1];
      const w = this.params.weights[l]; // W_l: current → next
      const nextDelta = this._bufDelta[l + 1];
      const currentDelta = this._bufDelta[l];
      const currentPre = this._bufPre[l];
      const currentActName = this.config.activations[l];

      for (let i = 0; i < currentSize; i++) {
        // δ_i = (Σ_j δ_j * W_ij) * f'(z_i)
        let sum = 0;
        for (let j = 0; j < nextSize; j++) {
          sum += nextDelta[j] * w[i * nextSize + j];
        }
        let dadz: number;
        if (currentActName === "sigmoid" || currentActName === "tanh") {
          dadz = activateDerivative(this._bufAct[l][i], currentActName);
        } else {
          dadz = activateDerivative(currentPre[i], currentActName);
        }
        currentDelta[i] = sum * dadz;
      }
    }

    // ── Compute gradients ────────────────────────────────────────────────

    for (let l = 0; l < this.numLayers - 1; l++) {
      const currentSize = this.config.layerSizes[l];
      const nextSize = this.config.layerSizes[l + 1];
      const currentAct = this._bufAct[l];
      const nextDelta = this._bufDelta[l + 1];
      const wGrad = this._bufWGrad[l];
      const bGrad = this._bufBGrad[l + 1];

      for (let j = 0; j < nextSize; j++) {
        bGrad[j] = nextDelta[j];
        for (let i = 0; i < currentSize; i++) {
          wGrad[i * nextSize + j] = currentAct[i] * nextDelta[j];
        }
      }
    }

    // ── SGD Update ───────────────────────────────────────────────────────

    const lr = this.config.learningRate;
    for (let l = 0; l < this.numLayers - 1; l++) {
      const wSize = this.params.weights[l].length;
      const bSize = this.params.biases[l].length;
      const wGrad = this._bufWGrad[l];
      const bGrad = this._bufBGrad[l + 1];

      for (let i = 0; i < wSize; i++) {
        this.params.weights[l][i] -= lr * wGrad[i];
      }
      for (let j = 0; j < bSize; j++) {
        this.params.biases[l][j] -= lr * bGrad[j];
      }
    }

    // ── Build snapshot ───────────────────────────────────────────────────
    this._epoch++;
    this._stepCount++;

    return this._buildSnapshot(input, target, prediction, lossValue);
  }

  /**
   * Predict without training — pure forward pass returning a copy.
   */
  predict(input: Float64Array): Float64Array {
    return this.forward(input);
  }

  /**
   * Run training for multiple epochs over a dataset.
   *
   * @param dataset    Array of {input, target} pairs.
   * @param epochs     Number of epochs to train.
   * @param onEpoch    Optional callback fired after each epoch.
   * @returns          Array of per-epoch metrics.
   */
  trainEpochs(
    dataset: { input: Float64Array; target: Float64Array }[],
    epochs: number,
    onEpoch?: (metrics: StepMetrics) => void
  ): StepMetrics[] {
    if (epochs <= 0) {
      throw new Error(`epochs must be positive, got ${epochs}`);
    }
    if (dataset.length === 0) {
      throw new Error("dataset must not be empty");
    }

    const metrics: StepMetrics[] = [];

    for (let e = 0; e < epochs; e++) {
      let epochLoss = 0;

      // Shuffle dataset each epoch (Fisher-Yates)
      const shuffled = [...dataset];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(this._rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      for (const sample of shuffled) {
        const snap = this.trainStep(sample.input, sample.target);
        epochLoss += snap.lossValue;
      }

      const avgLoss = epochLoss / dataset.length;
      const m: StepMetrics = {
        epoch: this._epoch,
        loss: avgLoss,
        timestamp: performance.now(),
      };
      metrics.push(m);

      if (onEpoch) {
        onEpoch(m);
      }
    }

    return metrics;
  }

  /**
   * Serialize network parameters to a JSON-friendly object.
   */
  serialize(): {
    config: NetworkConfig;
    weights: number[][];
    biases: number[][];
    stepCount: number;
  } {
    return {
      config: { ...this.config },
      weights: this.params.weights.map((w) => Array.from(w)),
      biases: this.params.biases.map((b) => Array.from(b)),
      stepCount: this._stepCount,
    };
  }

  /**
   * Deserialize and restore a network from a serialized object.
   */
  static deserialize(data: {
    config: NetworkConfig;
    weights: number[][];
    biases: number[][];
    stepCount?: number;
  }): NeuralNetwork {
    const net = new NeuralNetwork(data.config);

    for (let l = 0; l < net.numLayers - 1; l++) {
      if (data.weights[l]) {
        net.params.weights[l].set(data.weights[l]);
      }
      if (data.biases[l]) {
        net.params.biases[l].set(data.biases[l]);
      }
    }
    net._stepCount = data.stepCount ?? 0;

    return net;
  }

  /**
   * Human-readable architecture summary, e.g. "[2] → [4] → [1]".
   */
  architectureString(): string {
    return this.config.layerSizes.map((s) => `[${s}]`).join(" → ");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private _validateInput(input: Float64Array): void {
    const expected = this.config.layerSizes[0];
    if (input.length !== expected) {
      throw new Error(
        `Input size mismatch: expected ${expected}, got ${input.length}`
      );
    }
  }

  private _validateTarget(target: Float64Array): void {
    const expected = this.config.layerSizes[this.numLayers - 1];
    if (target.length !== expected) {
      throw new Error(
        `Target size mismatch: expected ${expected}, got ${target.length}`
      );
    }
  }

  private _buildSnapshot(
    input: Float64Array,
    target: Float64Array,
    prediction: Float64Array,
    lossValue: number
  ): TrainingSnapshot {
    // Deep-copy all buffer contents into the snapshot so the canvas
    // and UI can read them without aliasing mutable buffers.
    const preActivations: Float64Array[] = [];
    const activations: Float64Array[] = [];
    const deltas: Float64Array[] = [];
    const weights: Float64Array[] = [];
    const weightGradients: Float64Array[] = [];
    const biasGradients: Float64Array[] = [];

    for (let l = 0; l < this.numLayers; l++) {
      const actCopy = new Float64Array(this._bufAct[l]);
      activations.push(actCopy);

      const preCopy = new Float64Array(this._bufPre[l]);
      preActivations.push(preCopy);

      const deltaCopy = new Float64Array(this._bufDelta[l]);
      deltas.push(deltaCopy);

      const bGradCopy = new Float64Array(this._bufBGrad[l]);
      biasGradients.push(bGradCopy);

      if (l < this.numLayers - 1) {
        const wCopy = new Float64Array(this.params.weights[l]);
        weights.push(wCopy);
        const wGradCopy = new Float64Array(this._bufWGrad[l]);
        weightGradients.push(wGradCopy);
      }
    }

    return {
      preActivations,
      activations,
      deltas,
      input: new Float64Array(input),
      target: new Float64Array(target),
      prediction,
      lossValue,
      weights,
      weightGradients,
      biasGradients,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom error class for network-specific failures
// ─────────────────────────────────────────────────────────────────────────────

export class NeuralNetworkError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "NeuralNetworkError";
    this.code = code;
    this.context = context;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, NeuralNetworkError.prototype);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset utilities (built-in datasets for the simulation)
// ─────────────────────────────────────────────────────────────────────────────

export const Datasets = {
  /** XOR dataset — 4 samples, classic non-linear problem.
   *  Network: [2, 4, 1] with sigmoid can solve this. */
  xor(): { input: Float64Array; target: Float64Array }[] {
    return [
      { input: new Float64Array([0, 0]), target: new Float64Array([0]) },
      { input: new Float64Array([0, 1]), target: new Float64Array([1]) },
      { input: new Float64Array([1, 0]), target: new Float64Array([1]) },
      { input: new Float64Array([1, 1]), target: new Float64Array([0]) },
    ];
  },

  /** Circle boundary classification dataset.
   *  Points inside radius ~0.6 are class 1, outside are class 0. */
  circle(n: number = 100): { input: Float64Array; target: Float64Array }[] {
    const data: { input: Float64Array; target: Float64Array }[] = [];
    const rng = defaultRng();
    for (let i = 0; i < n; i++) {
      const x = rng() * 2 - 1;
      const y = rng() * 2 - 1;
      const r = Math.sqrt(x * x + y * y);
      data.push({
        input: new Float64Array([x, y]),
        target: new Float64Array([r < 0.6 ? 1 : 0]),
      });
    }
    return data;
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Default network factory — matches MVP default (2 → 4 → 1 XOR solver)
// ─────────────────────────────────────────────────────────────────────────────

export function createDefaultXORNetwork(overrides?: Partial<NetworkConfig>): NeuralNetwork {
  return new NeuralNetwork({
    layerSizes: [2, 4, 1],
    activations: ["linear", "sigmoid", "sigmoid"],
    loss: "binaryCrossEntropy",
    learningRate: 0.5,
    ...overrides,
  });
}
