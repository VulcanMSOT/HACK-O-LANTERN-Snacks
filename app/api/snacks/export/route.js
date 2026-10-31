import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function GET(request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const slotId = Number(searchParams.get('slot') || 1);

    const slotRes = await pool.query('SELECT name FROM snack_slots WHERE id = $1', [slotId]);
    const slotName = slotRes.rows[0]?.name || `Slot ${slotId}`;

    const query = `
      SELECT 
        t.id AS team_id,
        t.name AS team_name,
        sg.given_by,
        sg.given_at,
        CASE WHEN sg.id IS NOT NULL THEN 'Given' ELSE 'Pending' END AS status
      FROM teams t
      LEFT JOIN snack_given sg ON sg.team_id = t.id AND sg.slot_id = $1
      ORDER BY t.id ASC
    `;

    const res = await pool.query(query, [slotId]);

    const headers = ['Slot Name', 'Team ID', 'Team Name', 'Status', 'Given By', 'Timestamp'];
    const rows = res.rows.map((r) => [
      `"${slotName}"`,
      `"${r.team_id}"`,
      `"${r.team_name.replace(/"/g, '""')}"`,
      r.status,
      r.given_by ? `"${r.given_by.replace(/"/g, '""')}"` : '""',
      r.given_at ? `"${new Date(r.given_at).toISOString()}"` : '""',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hackolantern_snacks_${slotName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv"`,
      },
    });
  } catch (err) {
    console.error('Snacks export error:', err);
    return NextResponse.json({ error: err.message || 'Could not export CSV.' }, { status: 500 });
  }
}

