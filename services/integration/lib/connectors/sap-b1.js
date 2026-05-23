/** SAP Business One — skeleton (Service Calls push). */
export const sapB1Connector = {
  type: 'sap_b1',
  async connect(ctx) {
    if (!ctx.config?.serviceLayerUrl) return { ok: false, detail: 'serviceLayerUrl required' };
    return { ok: true, detail: 'skeleton — confirm SAP B1 API with LABBIK' };
  },
  async disconnect() {},
  async push(_ctx, event) {
    if (event.type === 'conversation.created' || event.type === 'ticket.created') {
      return { ok: true, detail: 'stub: would POST ServiceCalls' };
    }
    return { ok: true, detail: 'ignored' };
  },
  async pull() {
    return { items: [] };
  },
  async healthcheck() {
    return { ok: true, detail: 'skeleton' };
  },
};
