export class AsyncObjectDefinition {
  value: Record<string, any> = {};
  loadingCallbacks: any = [];
  loadedCount: number = 0;

  constructor() {}

  onLoad() {
    this.loadedCount++;
    if (this.loadedCount == this.targetCount()) {
      this.loadingCallbacks.forEach((callback) => {
        callback(this.value);
      });
      this.loadingCallbacks = [];
    }
  }

  targetCount() {
    return Object.keys(this.value).length;
  }

  getAsyncValue(callback) {
    if (this.loadedCount == this.targetCount()) {
      callback(this.value);
      return true; // returns whether the value was returned immediately
    }
    this.loadingCallbacks.push(callback);
    return false;
  }
}
