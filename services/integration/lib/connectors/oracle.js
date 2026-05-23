export const oracleConnector = {
  type: 'oracle_fusion',
  async connect() {
    return { ok: true, detail: 'skeleton' };
  },
  async disconnect() {},
  async push() {
    return { ok: true, detail: 'skeleton' };
  },
  async pull() {
    return {};
  },
  async healthcheck() {
    return { ok: true, detail: 'skeleton' };
  },
};
