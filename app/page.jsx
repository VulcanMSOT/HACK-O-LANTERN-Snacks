'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coffee,
  QrCode,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  LogOut,
  Download,
  Plus,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });

export default function SnacksDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(1);
  const [teams, setTeams] = useState([]);
  const [stats, setStats] = useState({ total: 33, given: 0, pending: 33 });
  const [filter, setFilter] = useState('all'); // all | pending | given
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Undo modal
  const [undoModal, setUndoModal] = useState(null); // { team }
  const [undoReason, setUndoReason] = useState('');
  const [undoError, setUndoError] = useState('');

  // New slot modal
  const [newSlotModal, setNewSlotModal] = useState(false);
  const [newSlotName, setNewSlotName] = useState('');

  // Toast
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // 1. Authenticate user
  useEffect(() => {
    fetch('/api/auth')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => router.push('/login'));
  }, [router]);

  // 2. Fetch slots
  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/snacks/slots');
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
        if (data.slots?.length > 0 && !selectedSlotId) {
          setSelectedSlotId(data.slots[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch slots err:', err);
    }
  }, [selectedSlotId]);

  // 3. Fetch teams for current slot
  const fetchTeams = useCallback(async (slotId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/snacks/teams?slot=${slotId}`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
        setStats(data.stats || { total: 33, given: 0, pending: 33 });
      }
    } catch (err) {
      console.error('Fetch teams err:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSlots();
    }
  }, [user, fetchSlots]);

  useEffect(() => {
    if (user && selectedSlotId) {
      fetchTeams(selectedSlotId);
    }
  }, [user, selectedSlotId, fetchTeams]);

  // Filter & Search
  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.normalised_name && t.normalised_name.includes(q.replace(/\s+/g, '')));

      if (!matchesSearch) return false;
      if (filter === 'pending') return !t.is_given;
      if (filter === 'given') return t.is_given;
      return true;
    });
  }, [teams, search, filter]);

  // Give Snack Action
  const handleGiveSnack = async (team) => {
    try {
      const res = await fetch('/api/snacks/give', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlotId, teamId: team.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record snack');
      }

      showToast(`Snack recorded for ${team.name}!`);
      fetchTeams(selectedSlotId);
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle QR Scan
  const handleQrScan = (decodedText) => {
    setScannerOpen(false);
    const raw = String(decodedText || '').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

    const match = teams.find(
      (t) =>
        t.name.toLowerCase() === raw.toLowerCase() ||
        t.normalised_name.replace(/[^a-z0-9]/g, '') === clean ||
        t.id.toLowerCase() === raw.toLowerCase()
    );

    if (match) {
      if (match.is_given) {
        alert(`${match.name} (${match.id}) has ALREADY received snacks for this slot!`);
      } else {
        if (confirm(`Confirm snack distribution for ${match.name} (${match.id})?`)) {
          handleGiveSnack(match);
        }
      }
    } else {
      alert(`Scanned "${raw}" could not be matched to an active team.`);
    }
  };

  // Undo Snack Action
  const handleUndoSubmit = async (e) => {
    e.preventDefault();
    if (!undoModal) return;
    setUndoError('');

    try {
      const res = await fetch('/api/snacks/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlotId,
          teamId: undoModal.id,
          reason: undoReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undo failed');

      showToast(`Undone snack for ${undoModal.name}`);
      setUndoModal(null);
      setUndoReason('');
      fetchTeams(selectedSlotId);
    } catch (err) {
      setUndoError(err.message);
    }
  };

  // Create New Slot
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/snacks/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSlotName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create slot');

      setNewSlotModal(false);
      setNewSlotName('');
      fetchSlots();
      if (data.slot) setSelectedSlotId(data.slot.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center text-neutral-400 text-sm">
        <div className="w-6 h-6 border-2 border-[#ff7a1a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentSlot = slots.find((s) => s.id === selectedSlotId);
  const percentGiven = stats.total > 0 ? Math.round((stats.given / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#060606] text-white pb-24 relative overflow-x-hidden">
      {/* Ambient Lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-gradient-to-b from-[#ff7a1a]/15 via-transparent to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#ff7a1a] text-black font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-2xl shadow-[#ff7a1a]/40 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0c0c0c]/85 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#181818] border border-white/10 flex items-center justify-center font-black text-[#ff7a1a] text-sm shadow-sm">
              {'{V}'}
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-white">
                HACK-O-LANTERN 2026
              </h1>
              <div className="text-[10px] text-neutral-400 flex items-center space-x-1.5">
                <span>Volunteer:</span>
                <span className="text-white font-bold">{user.name}</span>
                {user.role === 'admin' && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-[#ff7a1a]/20 text-[#ff7a1a] border border-[#ff7a1a]/40">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <a
              href={`/api/snacks/export?slot=${selectedSlotId}`}
              download
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={handleLogout}
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Slot Switcher Tabs */}
      <div className="bg-[#090909] border-b border-white/[0.06] px-4 py-2 sticky top-[53px] z-20">
        <div className="max-w-2xl mx-auto flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {slots.map((s) => {
            const isSelected = s.id === selectedSlotId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSlotId(s.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#ff7a1a] text-black shadow-md shadow-[#ff7a1a]/20'
                    : 'bg-[#141414] text-neutral-300 hover:bg-[#1a1a1a] border border-white/5'
                }`}
              >
                {s.name}
              </button>
            );
          })}

          {user.role === 'admin' && (
            <button
              onClick={() => setNewSlotModal(true)}
              className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#141414] text-neutral-400 hover:text-white hover:bg-[#1a1a1a] border border-white/5 flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Slot</span>
            </button>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Progress & Stat Widget */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#121212] to-[#0a0a0a] border border-white/10 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#ff7a1a]">
                {currentSlot?.name || 'Snacks Delivery'}
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-0.5 flex items-baseline space-x-1.5">
                <span>{stats.given}</span>
                <span className="text-neutral-500 text-sm font-semibold">/ {stats.total} teams</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-white">{percentGiven}%</span>
              <div className="text-[10px] text-neutral-400 uppercase font-semibold">Delivered</div>
            </div>
          </div>

          {/* Progress Bar with Glow */}
          <div className="w-full bg-[#1c1c1c] h-2.5 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="bg-gradient-to-r from-[#ff7a1a] to-amber-500 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(255,122,26,0.5)]"
              style={{ width: `${percentGiven}%` }}
            />
          </div>
        </div>

        {/* Scan Button & Quick Search */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex-shrink-0 inline-flex items-center space-x-2 bg-[#ff7a1a] hover:bg-[#e5680d] active:scale-[0.98] text-black font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-[#ff7a1a]/25"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Pass</span>
          </button>

          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team ID or name..."
              className="w-full bg-[#121212] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/40 transition-all"
            />
          </div>
        </div>

        {/* Segmented Filter Control */}
        <div className="bg-[#101010] p-1 rounded-xl border border-white/[0.08] flex items-center space-x-1 text-xs">
          {[
            { id: 'all', label: `All (${stats.total})` },
            { id: 'pending', label: `Pending (${stats.pending})` },
            { id: 'given', label: `Given (${stats.given})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all ${
                filter === tab.id
                  ? 'bg-neutral-800 text-white shadow-sm border border-white/10'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Teams List */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500 text-xs">Loading teams...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#0e0e0e] border border-white/5 text-center text-xs text-neutral-500">
            No teams match the current filter.
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  team.is_given
                    ? 'bg-[#0d0d0d] border-white/[0.05] opacity-80'
                    : 'bg-[#121212] border-white/10 hover:border-[#ff7a1a]/40 shadow-sm'
                }`}
              >
                <div className="flex-1 min-w-0 mr-2">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                    <span className="font-mono text-xs font-black text-[#ff7a1a] flex-shrink-0 bg-[#ff7a1a]/10 px-1.5 py-0.5 rounded border border-[#ff7a1a]/20">
                      {team.id}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white break-words">
                      {team.name}
                    </span>
                  </div>

                  <div className="mt-1">
                    {team.is_given ? (
                      <span className="text-[11px] text-emerald-400 flex items-center space-x-1 break-words font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          Given by {team.given_by} at{' '}
                          {new Date(team.given_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-400 flex items-center space-x-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                        <span>Awaiting delivery</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {team.is_given ? (
                    user.role === 'admin' ? (
                      <button
                        onClick={() => setUndoModal(team)}
                        className="text-[11px] text-neutral-400 hover:text-red-400 px-2 py-1 rounded-lg border border-white/10 hover:border-red-800/80 flex items-center space-x-1 transition-colors"
                        title="Admin Undo"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undo</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
                        Delivered
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => handleGiveSnack(team)}
                      className="bg-[#ff7a1a] hover:bg-[#e5680d] active:scale-[0.96] text-black font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-md shadow-[#ff7a1a]/20 transition-all"
                    >
                      Give Snack
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* QR Scanner */}
      {scannerOpen && <QrScanner onScan={handleQrScan} onClose={() => setScannerOpen(false)} />}

      {/* Admin Undo Modal */}
      {undoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121212] border border-white/15 rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">Undo Snack Delivery</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Team: <span className="text-white font-semibold">{undoModal.name}</span> ({undoModal.id})
            </p>

            {undoError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
                {undoError}
              </div>
            )}

            <form onSubmit={handleUndoSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Reason for Undo (Required)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={undoReason}
                  onChange={(e) => setUndoReason(e.target.value)}
                  placeholder="e.g. Accidental scan"
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff7a1a]"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUndoModal(null)}
                  className="flex-1 bg-[#1e1e1e] hover:bg-[#252525] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Confirm Undo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Slot Modal */}
      {newSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121212] border border-white/15 rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">Create New Snack Slot</h2>

            <form onSubmit={handleCreateSlot} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Slot Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  placeholder="e.g. Morning Breakfast"
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff7a1a]"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewSlotModal(false)}
                  className="flex-1 bg-[#1e1e1e] hover:bg-[#252525] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#ff7a1a] hover:bg-[#e5680d] text-black font-extrabold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Create Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
