# HACK-O-LANTERN 2026 - Snacks & Refreshments Tracker

Volunteer mobile app for tracking snack distributions for **HACK-O-LANTERN 2026** (31 Oct - 1 Nov 2026, Mirai Floor, hosted by Vulcan Club).

## Features
- **All 33 Teams Protected**: All teams stay eligible for snacks regardless of hackathon elimination status.
- **Double-Serving Prevention**: Unique database constraint `(slot_id, team_id)` rejects duplicate servings across concurrent volunteers with status 409.
- **Camera QR Scanner**: Reads printed team passes (which encode the team name).
- **Multi-Slot Distribution**: Midnight snacks, morning breakfast, etc.
- **Admin Undo with Audit Log**: Full reason-tracked undo logging in `snack_undo_log`.
- **CSV Export**: Instant download of delivery records per slot.

## Environment Variables
```bash
cp .env.example .env.local
# Set DATABASE_URL, SNACKS_VOLUNTEER_PASSCODE, SNACKS_ADMIN_PASSCODE
npm install
npm run build
npm start
```
