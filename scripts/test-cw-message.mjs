const TOKEN = process.env.CW_TOKEN || 'zAjRaYLuSRfA3FZjF3dPYv4H';
const CONV = process.env.CONV || '59';
const body = {
  content: 'test from node',
  message_type: 'incoming',
  content_type: 'text',
  source_id: 'wamid.test123',
};

const res = await fetch(`http://chatwoot:3000/api/v1/accounts/1/conversations/${CONV}/messages`, {
  method: 'POST',
  headers: {
    api_access_token: TOKEN,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(res.status, text);
