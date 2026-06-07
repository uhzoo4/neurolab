export class RingBuffer {
  private data: number[] = [];
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  push(value: number) {
    if (this.data.length >= this.capacity) {
      this.data.shift();
    }

    this.data.push(value);
  }

  getValues() {
    return this.data;
  }
}