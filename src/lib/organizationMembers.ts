import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Users can belong to several organizations, each with its own role.
// The backfill converts every legacy users.organization_id/role pair into a
// membership row, so existing accounts keep all their access. Idempotent.
export async function ensureMembershipSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS organization_members (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, organization_id)
    );
  `;

  await sql`
    INSERT INTO organization_members (user_id, organization_id, role)
    SELECT id, organization_id, COALESCE(role, 'user')
    FROM users
    WHERE organization_id IS NOT NULL
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  `;
}

export interface MembershipRow {
  organization_id: number;
  role: string;
  name: string;
  domain: string | null;
}

export async function getMemberships(userId: number): Promise<MembershipRow[]> {
  const rows = await sql`
    SELECT m.organization_id, m.role, o.name, o.domain
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ${userId}
    ORDER BY o.name ASC;
  `;
  return rows.map(row => ({
    organization_id: Number(row.organization_id),
    role: row.role,
    name: row.name,
    domain: row.domain
  }));
}
