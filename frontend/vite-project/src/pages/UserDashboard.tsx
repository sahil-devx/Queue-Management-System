// src/pages/UserDashboard.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';  // ← Add this import
import { Users, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { getImageUrl } from '../utils/imageUrl';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import CalledNotification from '../components/CalledNotification';
import ImageCrop from '../components/ImageCrop';

interface Queue {
  _id: string;
  title: string;
  adminId?: { name: string; profilePicture?: string };
  entryCount?: number;
}

interface SearchQueue {
  queueId: string;
  title: string;
  adminName?: string | null;
  adminProfilePicture?: string | null;
}

interface JoinedQueue {
  _id: string;
  joinedAt: string;
  position?: number;
  queueId: { _id: string; title: string; adminId?: { name: string; profilePicture?: string } };
}

interface QueueDetails {
  _id: string;
  title: string;
  adminName: string;
  adminEmail: string;
  adminProfilePicture?: string;
  contact: string;
  email: string;
  address: string;
  entryCount: number;
  createdAt: string;
}

export default function UserDashboard() {
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [joined, setJoined] = useState<JoinedQueue[]>([]);
  const [completed, setCompleted] = useState<JoinedQueue[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Queue[] | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinModalQueue, setJoinModalQueue] = useState<Queue | null>(null);
  const [joinName, setJoinName] = useState(user?.name || '');
  const [joinContact, setJoinContact] = useState(user?.phone || '');
  const [joinAddress, setJoinAddress] = useState('');
  const [joinSubject, setJoinSubject] = useState('');
  const [details, setDetails] = useState<QueueDetails | null>(null);
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [section, setSection] = useState<'dashboard' | 'my-queues' | 'settings'>('dashboard');
  const [settingsName, setSettingsName] = useState(user?.name || '');
  const [settingsPhone, setSettingsPhone] = useState(user?.phone || '');
  const [settingsEmail, setSettingsEmail] = useState(user?.email || '');
  const [settingsPicture, setSettingsPicture] = useState<File | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [editName, setEditName] = useState(false);
  const [editPhone, setEditPhone] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [calledNotification, setCalledNotification] = useState<{
    queueTitle: string;
    adminName: string;
    adminEmail: string;
  } | null>(null);

  const socket = useSocket(user?.id || '', 'user');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
    setRemovePicture(false);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], 'cropped-profile.jpg', { type: 'image/jpeg' });
    setSettingsPicture(croppedFile);
    setShowCropModal(false);
    setCropImageSrc(null);
    showSuccess('Profile picture cropped successfully');
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setCropImageSrc(null);
  };

  const loadData = async () => {
    try {
      const [queuesRes, joinedRes, completedRes] = await Promise.all([
        api.get('/queue/all'),
        api.get('/queue/joined'),
        api.get('/queue/completed')
      ]);
      setQueues(queuesRes.data.queues || []);
      setJoined(joinedRes.data.entries || []);
      setCompleted(completedRes.data.entries || []);
    } catch (err) {
      showError('Failed to load data');
    } finally {
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    console.log('Setting up socket event listeners for user');

    socket.on('userCalled', (data: { queueTitle: string; adminName: string; adminEmail: string }) => {
      console.log('Received userCalled event:', data);
      // Only show one notification at a time (no duplicate toast)
      if (!calledNotification) {
        setCalledNotification(data);
      }
    });

    socket.on('queueUpdate', () => {
      console.log('Received queueUpdate event, refreshing data');
      // Refresh queue data when there are updates
      void loadData();
    });

    return () => {
      console.log('Cleaning up socket event listeners for user');
      socket.off('userCalled');
      socket.off('queueUpdate');
    };
  }, [socket]);

  useEffect(() => {
    setSettingsName(user?.name || '');
    setSettingsPhone(user?.phone || '');
    setSettingsEmail(user?.email || '');
  }, [user]);

  useEffect(() => {
    const hash = location.hash || '';
    if (hash.includes('settings-section')) setSection('settings');
    else if (hash.includes('joined-section')) setSection('my-queues');
    else setSection('dashboard');

    const targetId = hash.replace('#', '');
    if (!targetId) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await api.get<{ queues: SearchQueue[] }>(`/queue/search?q=${encodeURIComponent(search)}`);
      const normalized = (res.data.queues || []).map((q) => ({
        _id: q.queueId,
        title: q.title,
        adminId: { 
          name: q.adminName || 'Unknown',
          profilePicture: q.adminProfilePicture || undefined
        }
      }));
      setSearchResults(normalized);
    } catch (err) {
      showError('Search failed');
    }
  };

  const openJoinModal = (queue: Queue) => {
    setJoinModalQueue(queue);
    setJoinName(user?.name || '');
    setJoinContact(user?.phone || '');
    setJoinAddress('');
    setJoinSubject('');
  };

  const closeJoinModal = () => {
    setJoinModalQueue(null);
  };

  const joinQueue = async (queueId: string) => {
    if (!queueId) {
      showError('Invalid queue selected');
      return;
    }
    setJoining(queueId);
    try {
      await api.post(`/queue/join/${queueId}`, {
        name: joinName.trim(),
        contact: joinContact.trim(),
        address: joinAddress.trim(),
        subject: joinSubject.trim()
      });
      showSuccess('Joined queue successfully');
      closeJoinModal();
      await loadData();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to join queue';
      showError(message);
    } finally {
      setJoining(null);
    }
  };

  const leaveQueue = async (queueId: string) => {
    try {
      await api.delete(`/queue/leave/${queueId}`);
      showSuccess('Left queue');
      await loadData();
    } catch (err) {
      showError('Failed to leave');
    }
  };

  const openDetails = async (queueId: string) => {
    if (!queueId) return;
    setDetailsLoading(true);
    try {
      const res = await api.get<{ queue: QueueDetails }>(`/queue/details/${queueId}`);
      setDetails(res.data.queue);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load details';
      showError(message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const removeCompleted = async (entryId: string) => {
    if (!entryId) return;
    try {
      await api.delete(`/queue/completed/${entryId}`);
      setCompleted((prev) => prev.filter((entry) => entry._id !== entryId));
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to remove completed queue';
      showError(message);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', settingsName);
      formData.append('phone', settingsPhone);
      formData.append('email', settingsEmail);
      formData.append('removeProfilePicture', String(removePicture));
      if (settingsPicture) formData.append('profilePicture', settingsPicture);
      const res = await api.put('/auth/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      showSuccess('Profile updated');
      setSettingsPicture(null);
      setRemovePicture(false);
      setEditName(false);
      setEditPhone(false);
      setEditEmail(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update profile';
      showError(message);
    }
  };

  const joinedIds = new Set(joined.map(j => j.queueId?._id));

  // Wrap everything with motion.div
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-7xl mx-auto"
    >
      {/* Header */}
      <div id="dashboard-section" className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">User Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, {user?.name}</p>
      </div>

      {section !== 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div whileHover={{ y: -2 }} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <Users className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{joined.length}</p>
            <p className="text-sm text-slate-500">Active Queues</p>
          </motion.div>
          
          <motion.div whileHover={{ y: -2 }} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold">{completed.length}</p>
            <p className="text-sm text-slate-500">Completed</p>
          </motion.div>
          
          <motion.div whileHover={{ y: -2 }} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <Clock className="w-5 h-5 text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{queues.length}</p>
            <p className="text-sm text-slate-500">Available Queues</p>
          </motion.div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {(section === 'dashboard' || section === 'my-queues') && (
        <>
      {/* Search */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8"
      >
        <h2 className="text-lg font-semibold mb-4">Find Queues</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="Search by queue or admin name"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
            Search
          </button>
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchResults(null); }}
            className="px-4 py-2 border rounded-lg hover:bg-slate-50"
          >
            Clear
          </button>
        </form>
      </motion.div>

      {/* Search Results */}
      {searchResults !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8"
        >
          <h3 className="font-semibold mb-4">Search Results</h3>
          <div className="grid gap-3">
            {searchResults.map((queue, idx) => (
              <motion.div
                key={queue._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex justify-between items-center p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={getImageUrl(queue.adminId?.profilePicture)} 
                    alt={queue.adminId?.name || 'Admin'} 
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <p className="font-medium">{queue.title}</p>
                    <p className="text-sm text-slate-500">Admin: {queue.adminId?.name || 'Unknown'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openJoinModal(queue)}
                    disabled={joinedIds.has(queue._id) || joining === queue._id}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {joining === queue._id ? <Loader2 className="w-4 h-4 animate-spin" /> : joinedIds.has(queue._id) ? 'Joined' : 'Join'}
                  </button>
                  <button
                    onClick={() => void openDetails(queue._id)}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Details
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Joined Queues */}
      <motion.div 
        id="joined-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8"
      >
        <h3 className="font-semibold mb-4">Joined Queues</h3>
        {joined.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No joined queues</p>
        ) : (
          <div className="space-y-3">
            {joined.map((entry, idx) => (
              <motion.div
                key={entry._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex justify-between items-center p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <img 
                    src={getImageUrl(entry.queueId?.adminId?.profilePicture)} 
                    alt={entry.queueId?.adminId?.name || 'Admin'} 
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <p className="font-medium">{entry.queueId?.title}</p>
                    <p className="text-sm text-slate-500">Admin: {entry.queueId?.adminId?.name || 'Unknown'}</p>
                    <p className="text-sm text-slate-500">Position: #{entry.position || '-'}</p>
                    <p className="text-xs text-slate-400 mt-1">Joined: {new Date(entry.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => leaveQueue(entry.queueId?._id)}
                    className="px-3 py-1 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    Leave
                  </button>
                  <button
                    onClick={() => void openDetails(entry.queueId?._id)}
                    className="px-3 py-1 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Details
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Completed Queues */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"
      >
        <h3 className="font-semibold mb-4">Completed Queues</h3>
        {completed.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No completed queues</p>
        ) : (
          <div className="space-y-3">
            {completed.map((entry, idx) => (
              <motion.div
                key={entry._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 border rounded-lg bg-slate-50 flex items-start justify-between gap-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <img 
                    src={getImageUrl(entry.queueId?.adminId?.profilePicture)} 
                    alt={entry.queueId?.adminId?.name || 'Admin'} 
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <p className="font-medium">{entry.queueId?.title}</p>
                    <p className="text-sm text-slate-500">Admin: {entry.queueId?.adminId?.name || 'Unknown'}</p>
                  </div>
                </div>
                <button
                  onClick={() => void removeCompleted(entry._id)}
                  className="text-slate-500 hover:text-red-600 text-lg leading-none"
                  title="Remove from completed"
                >
                  ×
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
        </>
      )}

      {section === 'settings' && (
        <section id="settings-section" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
          <p className="text-sm text-slate-500 mt-1">Update your account details and profile picture.</p>
          <form className="mt-5 space-y-5" onSubmit={(e) => void saveSettings(e)}>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Profile picture</p>
              <div className="flex items-center gap-4">
                <img src={getImageUrl(user?.profilePicture)} alt="profile" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                    Change
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsPicture(null);
                      setRemovePicture(true);
                    }}
                    className="px-3 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600">Name</p>
                <button
                  type="button"
                  onClick={() => setEditName((v) => !v)}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {editName ? 'Done' : 'Edit'}
                </button>
              </div>
              <input
                type="text"
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                disabled={!editName}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-500"
              />

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-slate-600">Contact</p>
                <button
                  type="button"
                  onClick={() => setEditPhone((v) => !v)}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {editPhone ? 'Done' : 'Edit'}
                </button>
              </div>
              <input
                type="text"
                value={settingsPhone}
                onChange={(e) => setSettingsPhone(e.target.value)}
                disabled={!editPhone}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-500"
              />

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-slate-600">Email</p>
                <button
                  type="button"
                  onClick={() => setEditEmail((v) => !v)}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {editEmail ? 'Done' : 'Edit'}
                </button>
              </div>
              <input
                type="email"
                value={settingsEmail}
                onChange={(e) => setSettingsEmail(e.target.value)}
                disabled={!editEmail}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <button type="submit" className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
              Save Changes
            </button>
          </form>
        </section>
      )}

      {details && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            {detailsLoading ? (
              <p className="text-sm text-slate-600">Loading details...</p>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900">{details.title}</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium">Admin:</span> {details.adminName}</p>
                  <p><span className="font-medium">Admin Email:</span> {details.adminEmail || '-'}</p>
                  <p><span className="font-medium">Contact:</span> {details.contact || '-'}</p>
                  <p><span className="font-medium">Queue Email:</span> {details.email || '-'}</p>
                  <p><span className="font-medium">Address:</span> {details.address || '-'}</p>
                  <p><span className="font-medium">Waiting Users:</span> {details.entryCount}</p>
                </div>
              </>
            )}
            <button
              onClick={() => setDetails(null)}
              className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {joinModalQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Join {joinModalQueue.title}</h3>
            <p className="text-sm text-slate-500 mt-1">
              Fill your details before joining this queue.
            </p>

            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void joinQueue(joinModalQueue._id);
              }}
            >
              <input
                type="text"
                required
                placeholder="Your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                required
                placeholder="Contact info (phone/email)"
                value={joinContact}
                onChange={(e) => setJoinContact(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                placeholder="Address (optional)"
                value={joinAddress}
                onChange={(e) => setJoinAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                placeholder="Subject (optional)"
                value={joinSubject}
                onChange={(e) => setJoinSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeJoinModal}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining === joinModalQueue._id}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {joining === joinModalQueue._id ? 'Joining...' : 'Join Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCropModal && cropImageSrc && (
        <ImageCrop
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspect={1}
        />
      )}

      {calledNotification && (
        <CalledNotification
          queueTitle={calledNotification.queueTitle}
          adminName={calledNotification.adminName}
          adminEmail={calledNotification.adminEmail}
          onClose={() => setCalledNotification(null)}
        />
      )}
    </motion.div>
  );
}