const tenantToken = process.env.TENANT_TOKEN || '';
const ticketToken = process.env.TICKET_TOKEN || '';

async function hit(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  console.log(url, res.status, text.slice(0, 200));
}

await hit('http://tenant:8802/v1/tenants/1/features', tenantToken);
await hit('http://127.0.0.1:8787/api/tenant/v1/tenants/1/features', tenantToken);
await hit('http://tickets:8791/v1/tickets/by-conversation/58?chatwoot_account_id=1', ticketToken);
