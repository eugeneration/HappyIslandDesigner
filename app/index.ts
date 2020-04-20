import { install } from './install';
import { multitouch } from './paper-multitouch';
import { zoom } from './paper-zoom';
import { drawer } from './drawer';
import browserUpdate from 'browser-update';
import './index.scss';

browserUpdate({required:{i:79,f:45,o:45,s:-2,c:60},insecure:true,api:2020.03});

(async () => {
  await install();
  multitouch();
  drawer();
  zoom();
})();
