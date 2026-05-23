import ivr from './ivr.routes';
import routing from './routing.routes';
import telephony from './telephony.routes';
import sla from './sla.routes';
import escalation from './escalation.routes';
import ai from './ai.routes';
import platform from './platform.routes';
import branding from './branding.routes';
import billing from './billing.routes';
import integration from './integration.routes';

export default {
  routes: [
    ...ivr.routes,
    ...routing.routes,
    ...telephony.routes,
    ...sla.routes,
    ...escalation.routes,
    ...ai.routes,
    ...platform.routes,
    ...branding.routes,
    ...billing.routes,
    ...integration.routes,
  ],
};
