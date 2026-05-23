import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPECS = [
  { name: 'integration', path: join(__dirname, '../openapi.yaml') },
  { name: 'billing', path: join(__dirname, '../../billing/openapi.yaml') },
  { name: 'tenant', path: join(__dirname, '../../tenant/openapi.yaml') },
  { name: 'ai', path: join(__dirname, '../../ai/openapi.yaml') },
];

export function loadAggregatedOpenApi() {
  const paths = {};
  const tags = [];
  for (const spec of SPECS) {
    if (!existsSync(spec.path)) continue;
    const raw = readFileSync(spec.path, 'utf8');
    if (spec.path.endsWith('.yaml')) {
      paths[`/${spec.name}`] = { description: `${spec.name} service (see ${spec.name}/openapi.yaml)` };
      tags.push({ name: spec.name });
    }
  }
  return {
    openapi: '3.1.0',
    info: { title: 'BlinkOne API', version: '1.0.0', description: 'Aggregated sidecar APIs (TR-46, TR-50)' },
    paths,
    tags,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-BlinkOne-Api-Key' },
      },
    },
  };
}

export function docsHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BlinkOne API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/></head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/v1/docs/openapi.json', dom_id: '#swagger-ui' });</script>
<p style="font-family:sans-serif;padding:1rem">Code samples: <code>curl -H "Authorization: Bearer $TOKEN"</code> · Node <code>fetch</code> · Python <code>requests</code></p>
</body></html>`;
}
