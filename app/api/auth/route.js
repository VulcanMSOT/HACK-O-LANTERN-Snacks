import { NextResponse } from 'next/server';
import { getSession, signSession, SESSION_COOKIE } from '@/lib/auth';

const VOLUNTEER_PASSCODE = process.env.SNACKS_VOLUNTEER_PASSCODE || 'snacks2026';
const ADMIN_PASSCODE = process.env.SNACKS_ADMIN_PASSCODE || 'snacksadmin2026';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: session });
}

export async function POST(request) {
  try {
    const { passcode, name } = await request.json();
    const cleanPasscode = String(passcode || '').trim();
    const cleanName = String(name || 'Volunteer').trim();

    let role = null;
    if (cleanPasscode === ADMIN_PASSCODE) {
      role = 'admin';
    } else if (cleanPasscode === VOLUNTEER_PASSCODE) {
      role = 'volunteer';
    } else {
      return NextResponse.json({ error: 'Invalid passcode.' }, { status: 401 });
    }

    const payload = {
      name: cleanName,
      role,
      exp: Date.now() + 1000 * 60 * 60 * 16, // 16 hours
    };

    const token = signSession(payload);

    const res = NextResponse.json({
      ok: true,
      user: { name: cleanName, role },
    });

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 16,
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

