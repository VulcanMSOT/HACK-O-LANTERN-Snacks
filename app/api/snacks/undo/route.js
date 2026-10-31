import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST(request) {
  let client;
  try {
    const admin = await requireAdmin();
    const { slotId, teamId, reason } = await request.json();

    const cleanTeamId = String(teamId || '').trim();
    const numSlotId = Number(slotId || 1);
    const cleanReason = String(reason || '').trim();

    if (!cleanTeamId) {
      return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 });
    }
    if (!cleanReason) {
      return NextResponse.json({ error: 'A reason is required to undo snack status.' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Ensure audit table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS snack_undo_log (
        id SERIAL PRIMARY KEY,
        slot_id INT NOT NULL,
        team_id VARCHAR(32) NOT NULL,
        undone_by VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Verify existing record
    const existing = await client.query(
      'SELECT id FROM snack_given WHERE slot_id = $1 AND team_id = $2',
      [numSlotId, cleanTeamId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No snack record found for this team and slot.' }, { status: 404 });
    }

    // Record in undo log
    await client.query(
      `INSERT INTO snack_undo_log (slot_id, team_id, undone_by, reason)
       VALUES ($1, $2, $3, $4)`,
      [numSlotId, cleanTeamId, admin.name || 'Admin', cleanReason]
    );

    // Delete given record
    await client.query(
      'DELETE FROM snack_given WHERE slot_id = $1 AND team_id = $2',
      [numSlotId, cleanTeamId]
    );

    await client.query('COMMIT');
    return NextResponse.json({
      ok: true,
      message: `Snack status undone for team ${cleanTeamId}.`,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Undo snack error:', err);
    return NextResponse.json({ error: err.message || 'Could not undo snack status.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
