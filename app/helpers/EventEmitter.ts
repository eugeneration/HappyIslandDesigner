type Callback = (data?: any) => void;

export class EventEmitter {
  callbacks: Record<string, Callback[]> = {};

  on(event: string, cb: Callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(cb);
  }

  emit(event: string, data?: any) {
    const cbs = this.callbacks[event];
    if (cbs) {
      cbs.forEach((cb) => {
        return cb(data);
      });
    }
  }
}
