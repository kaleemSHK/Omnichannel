import { getPool } from './db.js';

function mapRow(row) {
  return {
    id: String(row.id),
    field_key: row.field_key,
    label: row.label,
    field_type: row.field_type,
    options: row.options ?? undefined,
    required: Boolean(row.required),
    sort_order: Number(row.sort_order),
  };
}

export async function listFieldDefinitions(tenantId) {
  const { rows } = await getPool().query(
    `SELECT * FROM ticket_field_definitions WHERE tenant_id = $1 ORDER BY sort_order, created_at`,
    [tenantId],
  );
  return rows.map(mapRow);
}

export async function createFieldDefinition(tenantId, body) {
  const { rows } = await getPool().query(
    `INSERT INTO ticket_field_definitions (tenant_id, field_key, label, field_type, options, required, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      tenantId,
      body.field_key,
      body.label,
      body.field_type,
      body.options ?? null,
      body.required ?? false,
      body.sort_order ?? 0,
    ],
  );
  return mapRow(rows[0]);
}

export async function deleteFieldDefinition(tenantId, id) {
  await getPool().query(`DELETE FROM ticket_field_definitions WHERE id = $1 AND tenant_id = $2`, [
    Number(id),
    tenantId,
  ]);
}
