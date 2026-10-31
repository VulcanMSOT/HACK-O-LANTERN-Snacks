import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST(request) {
  try {
    const user = await requireAuth();
    const { slotId, teamId } = await request.json();

    const cleanTeamId = String(teamId || '').trim();
    const numSlotId = Number(slotId || 1);

    if (!cleanTeamId) {
      return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 });
    }

    // Check team exists
    const teamRes = await pool.query('SELECT id, name FROM teams WHERE id = $1', [cleanTeamId]);
    if (teamRes.rows.length === 0) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }
    const team = teamRes.rows[0];

    try {
      const insertRes = await pool.query(
        `INSERT INTO snack_given (slot_id, team_id, given_by)
         VALUES ($1, $2, $3)
         RETURNING id, given_at`,
        [numSlotId, cleanTeamId, user.name || 'Volunteer']
      );

      return NextResponse.json({
        ok: true,
        message: `Snacks marked as given to ${team.name} (${team.id}).`,
        record: insertRes.rows[0],
      });
    } catch (dbErr) {
      // 23505 is PostgreSQL unique_violation code
      if (dbErr.code === '23505') {
        return NextResponse.json(
          { error: 'This team has already been given snacks for this slot.' },
          { status: 409 }
        );
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('Give snack error:', err);
    return NextResponse.json({ error: err.message || 'Could not record snack.' }, { status: 500 });
  }
}

