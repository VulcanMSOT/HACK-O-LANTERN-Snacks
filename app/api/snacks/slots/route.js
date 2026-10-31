import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    await requireAuth();
    const res = await pool.query('SELECT id, name, active, created_at FROM snack_slots ORDER BY id ASC');
    return NextResponse.json({ slots: res.rows });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not load slots.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const { name } = await request.json();
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return NextResponse.json({ error: 'Slot name is required.' }, { status: 400 });
    }

    const res = await pool.query(
      'INSERT INTO snack_slots (name) VALUES ($1) RETURNING id, name, active, created_at',
      [cleanName]
    );

    return NextResponse.json({ ok: true, slot: res.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not create slot.' }, { status: 500 });
  }
}
