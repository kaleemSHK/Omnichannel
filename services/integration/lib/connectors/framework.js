/** @typedef {object} ConnectorContext
 * @property {string} tenantId
 * @property {object} config
 * @property {object} secrets
 */

/**
 * @typedef {object} BlinkOneConnector
 * @property {string} type
 * @property {(ctx: ConnectorContext) => Promise<{ ok: boolean }>} connect
 * @property {(ctx: ConnectorContext) => Promise<void>} disconnect
 * @property {(ctx: ConnectorContext, event: object) => Promise<{ ok: boolean, detail?: string }>} push
 * @property {(ctx: ConnectorContext) => Promise<object>} pull
 * @property {(ctx: ConnectorContext) => Promise<{ ok: boolean, latencyMs?: number }>} healthcheck
 */

import { genericRestConnector } from './generic-rest.js';
import { sapB1Connector } from './sap-b1.js';
import { dynamicsConnector } from './dynamics.js';
import { oracleConnector } from './oracle.js';

const REGISTRY = {
  generic_rest: genericRestConnector,
  sap_b1: sapB1Connector,
  microsoft_dynamics: dynamicsConnector,
  oracle_fusion: oracleConnector,
  tasdeeq: {
    type: 'tasdeeq',
    async connect() {
      return { ok: false, detail: 'Tasdeeq connector spec TBD' };
    },
    async disconnect() {},
    async push() {
      return { ok: false, detail: 'not implemented' };
    },
    async pull() {
      return {};
    },
    async healthcheck() {
      return { ok: false };
    },
  },
};

export function getConnector(type) {
  return REGISTRY[type] ?? null;
}

export function listConnectorTypes() {
  return Object.keys(REGISTRY);
}
