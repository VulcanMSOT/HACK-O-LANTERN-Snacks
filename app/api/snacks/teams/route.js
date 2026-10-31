import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function GET(request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const slotId = Number(searchParams.get('slot') || 1);

    const query = `
      SELECT 
        t.id,
        t.name,
        t.normalised_name,
        sg.id AS snack_given_id,
        sg.given_by,
        sg.created_at AS given_at,
        CASE WHEN sg.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_given
      FROM teams t
      LEFT JOIN snack_given sg ON sg.team_id = t.id AND sg.slot_id = $1
      ORDER BY 
        CASE WHEN sg.id IS NULL THEN 0 ELSE 1 END,
        t.id ASC
    `;

    const res = await pool.query(query, [slotId]);
    const teams = res.rows;

    const total = teams.length;
    const given = teams.filter((t) => t.is_given).length;
    const pending = total - given;

    return NextResponse.json({
      slotId,
      stats: { total, given, pending },
      teams,
    });
  } catch (err) {
    console.error('Fetch snack teams error:', err);
    return NextResponse.json({ error: err.message || 'Could not load teams.' }, { status: 500 });
  }
}
