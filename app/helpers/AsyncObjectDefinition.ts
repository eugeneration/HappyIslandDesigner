import paper from 'paper';
import { loadSvg } from './svgLoad';

export class AsyncObjectDefinition {
  value: Record<string, any> = {};

  loadingCallbacks: any = [];

  loadedCount: number = 0;

  expectedCount: number = 0;

  onLoadStart() {
    this.expectedCount += 1;
  }

  onLoad() {
    this.loadedCount += 1;
    if (this.expectedCount > 0 && this.loadedCount === this.expectedCount) {
      this.loadingCallbacks.forEach((callback) => {
        callback(this.value);
      });
      this.loadingCallbacks = [];
    }
  }

  getAsyncValue(callback) {
    if (this.expectedCount > 0 && this.loadedCount === this.expectedCount) {
      callback(this.value);
      return true; // returns whether the value was returned immediately
    }
    this.loadingCallbacks.push(callback);
    return false;
  }

  loadItemAsset(type: string) {
    const def = this.value[type];
    if (!def || def._assetLoading || def.icon) return;
    def._assetLoading = true;
    this.onLoadStart();

    const onLoaded = (icon) => {
      def.icon = icon;
      if (def._onIconLoaded) {
        def._onIconLoaded.forEach(cb => cb());
        delete def._onIconLoaded;
      }
      this.onLoad();
    };

    if (def.svg) {
      loadSvg(def.svg, onLoaded);
    } else if (def.img) {
      const img = new paper.Raster(def.img);
      img.remove();
      img.onLoad = () => onLoaded(img);
    }
  }

  loadAllAssets() {
    Object.keys(this.value).forEach((type) => {
      const def = this.value[type];
      if (def.hidden || def.legacy || def.legacyCategory) return;
      this.loadItemAsset(type);
    });
  }
}
