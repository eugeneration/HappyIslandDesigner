import { install } from './install';
import { zoom } from './paper-zoom';
import { drawer } from './drawer';
import './index.scss';

import browserUpdate from 'browser-update';
import i18next from 'i18next';
import { strings } from './strings';

browserUpdate({required:{i:79,f:45,o:45,s:-2,c:60},insecure:true,api:2020.03});
i18next.init({
  lng: 'en',
  debug: true,
  resources: strings,
});

/*eslint-disable */
(async () => {
  await install();
  drawer();
  zoom();
})();
/*eslint-enable */
