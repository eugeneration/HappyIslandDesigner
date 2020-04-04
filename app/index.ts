import { install } from './install';
// import { multitouch } from './paper-multitouch';
import { drawer } from './drawer';
import './index.scss';

(async () => {
  await install();

  // multitouch();

  drawer();
})();
