const phone = process.env.WA_PHONE || '+15556712440';
const phoneNumberId = process.env.WA_PNID || '1236816386176073';

const payload = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '0',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: {
          display_phone_number: phone.replace(/^\+/, ''),
          phone_number_id: phoneNumberId,
        },
        contacts: [{ profile: { name: 'Test User' }, wa_id: '923158205910' }],
        messages: [{
          from: '923158205910',
          id: `wamid.test.${Date.now()}`,
          timestamp: String(Math.floor(Date.now() / 1000)),
          type: 'text',
          text: { body: 'Hello from webhook test' },
        }],
      },
      field: 'messages',
    }],
  }],
};

const url = `http://chatwoot:3000/webhooks/whatsapp/${encodeURIComponent(phone)}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log(res.status, text);
