import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  Users,
  Edit2,
  UserCheck,
  Loader2,
  ListOrdered,
  Copy,
  Check
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUrl';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import ImageCrop from '../components/ImageCrop';

interface QueueEntry {
  _id: string;
  joinedAt: string;
  userId: { _id: string; name: string; email: string; phone?: string; profilePicture?: string };
}

interface QueueEntryDetails {
  _id: string;
  joinedAt: string;
  name: string;
  contact: string;
  address: string;
  subject: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userProfilePicture: string;
}

interface AdminQueue {
  _id: string;
  title: string;
  contact?: string;
  email?: string;
  address?: string;
  createdAt: string;
  entryCount?: number;
}

interface ListedUser {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  phone?: string;
  profilePicture?: string;
}

type Section = 'dashboard' | 'my-queues' | 'users' | 'settings';

export default function AdminDashboard() {
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [queues, setQueues] = useState<AdminQueue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<AdminQueue | null>(null);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [visibleEntries, setVisibleEntries] = useState(5);
  const [queueTitle, setQueueTitle] = useState('');
  const [queueContact, setQueueContact] = useState('');
  const [queueEmail, setQueueEmail] = useState('');
  const [queueAddress, setQueueAddress] = useState('');
  const [renameTitle, setRenameTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('dashboard');
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const socket = useSocket(user?.id || '', 'admin');

  const [entryDetails, setEntryDetails] = useState<QueueEntryDetails | null>(null);
  const [entryDetailsLoading, setEntryDetailsLoading] = useState(false);

  const [usersList, setUsersList] = useState<ListedUser[]>([]);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);

  const [settingsName, setSettingsName] = useState(user?.name || '');
  const [settingsPhone, setSettingsPhone] = useState(user?.phone || '');
  const [settingsEmail, setSettingsEmail] = useState(user?.email || '');
  const [settingsPicture, setSettingsPicture] = useState<File | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [editName, setEditName] = useState(false);
  const [editPhone, setEditPhone] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

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
    showSuccess('Image cropped successfully');
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setCropImageSrc(null);
  };

  const syncSectionFromHash = (hash: string) => {
    if (hash.includes('users-section')) setSection('users');
    else if (hash.includes('settings-section')) setSection('settings');
    else if (hash.includes('my-queues-section')) setSection('my-queues');
    else setSection('dashboard');
  };

  useEffect(() => {
    syncSectionFromHash(location.hash || '');
    const targetId = (location.hash || '').replace('#', '');
    if (!targetId) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash]);

  const loadQueues = async () => {
    try {
      const res = await api.get('/queue/my');
      const q = res.data.queues || [];
      setQueues(q);
      if (q.length > 0 && (!selectedQueueId || !q.some((item: AdminQueue) => item._id === selectedQueueId))) {
        setSelectedQueueId(q[0]._id);
      }
    } catch (err) {
      showError('Failed to load queues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueues();
  }, []);

  useEffect(() => {
    setSettingsName(user?.name || '');
    setSettingsPhone(user?.phone || '');
    setSettingsEmail(user?.email || '');
  }, [user]);

  useEffect(() => {
    if (!selectedQueueId) return;
    const loadQueue = async () => {
      try {
        const res = await api.get(`/queue/my/${selectedQueueId}`);
        setSelectedQueue(res.data.queue);
        setRenameTitle(res.data.queue.title);
        setEntries(res.data.entries || []);
        setVisibleEntries(5);
      } catch (err) {
        showError('Failed to load queue');
      }
    };
    void loadQueue();
  }, [selectedQueueId]);

  const loadUsers = async (reset = false) => {
    setUsersLoading(true);
    try {
      const offset = reset ? 0 : usersOffset;
      const res = await api.get(`/queue/admin/customers?limit=25&offset=${offset}`);
      const fetched = (res.data.users || []) as ListedUser[];
      setUsersTotal(res.data.total || 0);
      if (reset) {
        setUsersList(fetched);
        setUsersOffset(fetched.length);
      } else {
        setUsersList((prev) => [...prev, ...fetched]);
        setUsersOffset((prev) => prev + fetched.length);
      }
    } catch (err) {
      showError('Failed to load customers');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (section === 'users' && usersList.length === 0) {
      void loadUsers(true);
    }
  }, [section]);

  useEffect(() => {
    if (!socket) return;

    console.log('Setting up socket event listeners for admin');

    socket.on('queueUpdate', () => {
      console.log('Admin received queueUpdate event, refreshing data');
      // Refresh queue data when users join/leave
      void loadQueues();
      // The selected queue will be refreshed by the existing useEffect that depends on selectedQueueId
    });

    return () => {
      console.log('Cleaning up socket event listeners for admin');
      socket.off('queueUpdate');
    };
  }, [socket]);

  const createQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/queue/create', {
        title: queueTitle,
        contact: queueContact,
        email: queueEmail,
        address: queueAddress
      });
      setQueueTitle('');
      setQueueContact('');
      setQueueEmail('');
      setQueueAddress('');
      showSuccess('Queue created');
      await loadQueues();
      setSelectedQueueId(res.data.queue._id);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create queue';
      showError(message);
    } finally {
      setCreating(false);
    }
  };

  const renameQueue = async () => {
    if (!selectedQueueId) return;
    setActionId('rename');
    try {
      await api.put(`/queue/${selectedQueueId}/rename`, { title: renameTitle });
      showSuccess('Queue renamed successfully');
      setQueues(queues.map((q) => (q._id === selectedQueueId ? { ...q, title: renameTitle } : q)));
      setSelectedQueue({ ...selectedQueue!, title: renameTitle });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to rename queue';
      showError(message);
    } finally {
      setActionId(null);
    }
  };

  const deleteQueue = async () => {
    if (!selectedQueueId) return;
    setActionId('delete');
    try {
      await api.delete(`/queue/${selectedQueueId}`);
      showSuccess('Queue deleted');
      setSelectedQueueId(null);
      setSelectedQueue(null);
      await loadQueues();
    } catch (err) {
      showError('Failed to delete');
    } finally {
      setActionId(null);
    }
  };

  const callNext = async () => {
    if (!selectedQueueId) return;
    setActionId('next');
    try {
      const res = await api.put(`/queue/${selectedQueueId}/next`);
      setEntries((prev) => prev.filter((e) => e._id !== res.data.next._id));
      showSuccess(`${res.data.next.userId?.name || 'User'} called`);
    } catch (err) {
      showError('Failed to call next');
    } finally {
      setActionId(null);
    }
  };

  const removeEntry = async (entryId: string) => {
    setActionId(entryId);
    try {
      await api.delete(`/queue/${selectedQueueId}/remove/${entryId}`);
      setEntries((prev) => prev.filter((e) => e._id !== entryId));
      showSuccess('User removed');
    } catch (err) {
      showError('Failed to remove');
    } finally {
      setActionId(null);
    }
  };

  const viewEntryDetails = async (entryId: string) => {
    if (!selectedQueueId) return;
    setEntryDetailsLoading(true);
    try {
      const res = await api.get(`/queue/my/${selectedQueueId}/entry/${entryId}`);
      setEntryDetails(res.data.entry);
    } catch (err) {
      showError('Failed to load user details');
    } finally {
      setEntryDetailsLoading(false);
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

  const copyValue = async (label: string, value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      showError(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const visibleQueueEntries = useMemo(() => entries.slice(0, visibleEntries), [entries, visibleEntries]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {(section === 'dashboard' || section === 'my-queues') && (
        <>
          <section id="dashboard-section" className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1">Welcome back, {user?.name}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <ListOrdered className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{queues.length}</p>
                <p className="text-sm text-slate-500">Total Queues</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <Users className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold">{entries.length}</p>
                <p className="text-sm text-slate-500">Active Customers</p>
              </div>
            </div>
          </section>

          <section id="my-queues-section">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
              <h2 className="text-lg font-semibold mb-4">Create New Queue</h2>
              <form onSubmit={createQueue} className="grid gap-3 md:grid-cols-2">
                <input type="text" placeholder="Queue title" className="px-4 py-2 border border-slate-200 rounded-lg" value={queueTitle} onChange={(e) => setQueueTitle(e.target.value)} required />
                <input type="text" placeholder="Contact number" className="px-4 py-2 border border-slate-200 rounded-lg" value={queueContact} onChange={(e) => setQueueContact(e.target.value)} required />
                <input type="email" placeholder="Queue email" className="px-4 py-2 border border-slate-200 rounded-lg" value={queueEmail} onChange={(e) => setQueueEmail(e.target.value)} required />
                <input type="text" placeholder="Address" className="px-4 py-2 border border-slate-200 rounded-lg" value={queueAddress} onChange={(e) => setQueueAddress(e.target.value)} required />
                <button type="submit" disabled={creating} className="md:col-span-2 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Queue
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-semibold mb-3">My Queues</h3>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                ) : queues.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No queues yet</p>
                ) : (
                  <div className="space-y-2">
                    {queues.map((queue) => (
                      <button key={queue._id} onClick={() => setSelectedQueueId(queue._id)} className={`w-full text-left p-3 rounded-lg transition ${selectedQueueId === queue._id ? 'bg-brand-50 border-l-4 border-brand-500' : 'hover:bg-slate-50'}`}>
                        <p className="font-medium">{queue.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{queue.entryCount || 0} customers</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                {!selectedQueue ? (
                  <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
                    <p className="text-slate-500">Select a queue to manage</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                          <input type="text" value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} className="text-xl font-bold bg-transparent border-b-2 border-transparent focus:border-brand-500 outline-none" />
                          <button onClick={renameQueue} disabled={actionId === 'rename'} className="p-1 text-slate-500 hover:text-brand-600">
                            {actionId === 'rename' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={deleteQueue} disabled={actionId === 'delete'} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">{actionId === 'delete' ? '...' : 'Delete'}</button>
                          <button onClick={callNext} disabled={actionId === 'next' || entries.length === 0} className="px-4 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2">
                            {actionId === 'next' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Call Next
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 mt-2">{entries.length} customers waiting</p>
                    </div>

                    <div className="p-6">
                      {entries.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">No customers in queue</p>
                      ) : (
                        <div className="space-y-3">
                          {visibleQueueEntries.map((entry, idx) => (
                            <div key={entry._id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <img src={getImageUrl(entry.userId?.profilePicture)} alt="user" className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-brand-600">#{idx + 1}</span>
                                    <p className="font-medium">{entry.userId?.name}</p>
                                  </div>
                                  <p className="text-sm text-slate-500 mt-1">{entry.userId?.email}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => void viewEntryDetails(entry._id)} className="px-3 py-1 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                                  Details
                                </button>
                                <button onClick={() => removeEntry(entry._id)} disabled={actionId === entry._id} className="text-red-600 hover:text-red-700 text-sm">
                                  {actionId === entry._id ? '...' : 'Remove'}
                                </button>
                              </div>
                            </div>
                          ))}

                          {entries.length > visibleEntries ? (
                            <button onClick={() => setVisibleEntries((prev) => prev + 10)} className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">
                              View More ({entries.length - visibleEntries} remaining)
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {section === 'users' && (
        <section id="users-section" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Customers</h2>
            <p className="text-sm text-slate-500">{usersList.length} / {usersTotal}</p>
          </div>
          <div className="mt-4 space-y-3">
            {usersList.map((u) => (
              <div key={u._id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <img src={getImageUrl(u.profilePicture)} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                  <div>
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-sm text-slate-500">{u.email}</p>
                  </div>
                </div>
                <p className="text-xs capitalize rounded bg-slate-100 px-2 py-1">{u.role}</p>
              </div>
            ))}
          </div>
          {usersList.length < usersTotal ? (
            <button onClick={() => void loadUsers()} disabled={usersLoading} className="mt-4 w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              {usersLoading ? 'Loading...' : 'View More (25)'}
            </button>
          ) : null}
        </section>
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

      {entryDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            {entryDetailsLoading ? (
              <p className="text-sm text-slate-600">Loading details...</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <img src={getImageUrl(entryDetails.userProfilePicture)} alt="profile" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  <div>
                    <p className="font-semibold">{entryDetails.userName}</p>
                    <p className="text-sm text-slate-500">{entryDetails.userEmail}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <p><span className="font-medium">Phone:</span> {entryDetails.userPhone || '-'}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p><span className="font-medium">Email:</span> {entryDetails.userEmail}</p>
                    <button
                      type="button"
                      onClick={() => void copyValue('email', entryDetails.userEmail)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                    >
                      {copiedField === 'email' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedField === 'email' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p><span className="font-medium">Name:</span> {entryDetails.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p><span className="font-medium">Contact:</span> {entryDetails.contact}</p>
                    <button
                      type="button"
                      onClick={() => void copyValue('contact', entryDetails.contact)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                    >
                      {copiedField === 'contact' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedField === 'contact' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p><span className="font-medium">Address:</span> {entryDetails.address || '-'}</p>
                  <p><span className="font-medium">Subject:</span> {entryDetails.subject || '-'}</p>
                </div>
              </>
            )}
            <button onClick={() => setEntryDetails(null)} className="mt-5 w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Close
            </button>
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
    </motion.div>
  );
}