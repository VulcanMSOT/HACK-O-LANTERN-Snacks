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

      showToast(`Snack given to ${team.name}!`);
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
      <div className="min-h-screen bg-[#080808] flex items-center justify-center text-neutral-400 text-sm">
        Loading snacks session...
      </div>
    );
  }

  const currentSlot = slots.find((s) => s.id === selectedSlotId);
  const percentGiven = stats.total > 0 ? Math.round((stats.given / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#ff7a1a] text-black font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#121212]/90 backdrop-blur-md border-b border-[#222222] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="font-bold text-[#ff7a1a] text-sm tracking-tight">{'{V}'}</span>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-wider text-white">
                HACK-O-LANTERN 2026 • Snacks
              </h1>
              <div className="text-[11px] text-neutral-400">
                Volunteer: <span className="text-white font-medium">{user.name}</span>
                {user.role === 'admin' && <span className="ml-1 text-[#ff7a1a]">(Admin)</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={`/api/snacks/export?slot=${selectedSlotId}`}
              download
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={handleLogout}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Slot Switcher Tabs */}
      <div className="bg-[#0e0e0e] border-b border-[#1f1f1f] px-4 py-2 sticky top-[57px] z-20">
        <div className="max-w-2xl mx-auto flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {slots.map((s) => {
            const isSelected = s.id === selectedSlotId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSlotId(s.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-[#ff7a1a] text-black shadow-sm shadow-[#ff7a1a]/30'
                    : 'bg-[#181818] text-neutral-300 hover:bg-[#202020]'
                }`}
              >
                {s.name}
              </button>
            );
          })}

          {user.role === 'admin' && (
            <button
              onClick={() => setNewSlotModal(true)}
              className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#181818] text-neutral-400 hover:text-white hover:bg-[#202020] flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Slot</span>
            </button>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Progress Banner */}
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-400">
                {currentSlot?.name || 'Snacks'}
              </div>
              <div className="text-lg font-bold text-white mt-0.5">
                Given to <span className="text-[#ff7a1a] font-extrabold">{stats.given}</span> of{' '}
                {stats.total} teams
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white">{percentGiven}%</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#202020] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#ff7a1a] h-full transition-all duration-300"
              style={{ width: `${percentGiven}%` }}
            />
          </div>
        </div>

        {/* Scan & Search Bar */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex-shrink-0 inline-flex items-center space-x-2 bg-[#ff7a1a] hover:bg-[#e5680d] active:scale-[0.98] text-black font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-[#ff7a1a]/20"
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
              className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff7a1a]"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 border-b border-[#1f1f1f] pb-2 text-xs">
          {[
            { id: 'all', label: `All (${stats.total})` },
            { id: 'pending', label: `Pending (${stats.pending})` },
            { id: 'given', label: `Given (${stats.given})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                filter === tab.id
                  ? 'bg-neutral-800 text-white'
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
          <div className="p-8 rounded-xl bg-[#121212] border border-[#222222] text-center text-xs text-neutral-500">
            No teams match the current filter.
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  team.is_given
                    ? 'bg-[#101010] border-[#1e1e1e] opacity-80'
                    : 'bg-[#141414] border-[#262626] hover:border-[#ff7a1a]/40'
                }`}
              >
                <div className="flex-1 min-w-0 mr-2">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                    <span className="font-mono text-xs font-bold text-[#ff7a1a] flex-shrink-0">{team.id}</span>
                    <span className="text-xs sm:text-sm font-bold text-white break-words">{team.name}</span>
                  </div>

                  <div className="mt-1">
                    {team.is_given ? (
                      <span className="text-[11px] text-green-400 flex items-center space-x-1 break-words">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        <span>
                          Given by {team.given_by} at{' '}
                          {new Date(team.given_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-neutral-500 flex-shrink-0" />
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
                        className="text-[11px] text-neutral-400 hover:text-red-400 p-1.5 rounded-lg border border-[#333] hover:border-red-800 flex items-center space-x-1"
                        title="Admin Undo"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undo</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-green-500 bg-green-950/60 border border-green-800/80 px-2.5 py-1 rounded-lg">
                        Given
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => handleGiveSnack(team)}
                      className="bg-[#ff7a1a] hover:bg-[#e5680d] active:scale-[0.98] text-black font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm shadow-[#ff7a1a]/20"
                    >
                      Give
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
          <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative">
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
                  value={undoReason}
                  onChange={(e) => setUndoReason(e.target.value)}
                  placeholder="e.g. Accidental scan"
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUndoModal(null)}
                  className="flex-1 bg-[#202020] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
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
          <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">Create New Snack Slot</h2>

            <form onSubmit={handleCreateSlot} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Slot Name
                </label>
                <input
                  type="text"
                  required
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  placeholder="e.g. Morning Breakfast"
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewSlotModal(false)}
                  className="flex-1 bg-[#202020] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#ff7a1a] text-black font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

