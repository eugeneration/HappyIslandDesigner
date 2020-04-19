import { install } from './install';
import { multitouch } from './paper-multitouch';
import { zoom } from './paper-zoom';
import { drawer } from './drawer';
import './index.scss';

(async () => {
  await install();

  multitouch();

  drawer();

  zoom();
})();
