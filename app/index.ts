import * as store from './store';
import { init } from './init';
import { multitouch } from './paper-multitouch';
import { drawer } from './drawer';
import './index.scss';

(async () => {
  await init();

  multitouch();

  drawer();
})();
