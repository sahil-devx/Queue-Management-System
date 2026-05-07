const mongoose = require('mongoose');

const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');
const { sendCallNotification } = require('../services/emailService');

// Treat missing `status` on older documents as still "joined" (backward compatible).
const activeEntryMatch = { $or: [{ status: 'joined' }, { status: { $exists: false } }] };
const completedEntryMatch = { $or: [{ status: 'completed' }, { completedAt: { $exists: true, $ne: null } }] };

async function getAdminOwnedQueueOrNull(adminId, queueId) {
  if (!queueId || !mongoose.isValidObjectId(queueId)) return null;
  return Queue.findOne({ _id: queueId, adminId });
}

async function createQueue(req, res, next) {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Queue title is required' });

    const contact = String(req.body?.contact || '').trim();
    const email = String(req.body?.email || '').trim();
    const address = String(req.body?.address || '').trim();
    if (!contact) return res.status(400).json({ message: 'Contact is required' });
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!address) return res.status(400).json({ message: 'Address is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const queue = await Queue.create({
      adminId: req.user.id,
      title,
      contact,
      email: email.toLowerCase(),
      address
    });

    return res.status(201).json({ queue });
  } catch (err) {
    return next(err);
  }
}

async function getMyQueues(req, res, next) {
  try {
    const queues = await Queue.find({ adminId: req.user.id }).sort({ createdAt: -1 });
    const queueIds = queues.map((queue) => queue._id);

    const counts = await QueueEntry.aggregate([
      { $match: { queueId: { $in: queueIds }, ...activeEntryMatch } },
      { $group: { _id: '$queueId', count: { $sum: 1 } } }
    ]);

    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
    const result = queues.map((queue) => ({
      _id: queue._id,
      title: queue.title,
      createdAt: queue.createdAt,
      entryCount: countMap.get(String(queue._id)) || 0
    }));

    return res.json({ queues: result });
  } catch (err) {
    return next(err);
  }
}

async function getAdminStats(req, res, next) {
  try {
    const queues = await Queue.find({ adminId: req.user.id }).select('_id');
    const queueIds = queues.map((q) => q._id);

    if (queueIds.length === 0) {
      return res.json({
        queueCount: 0,
        totalWaitingUsers: 0,
        totalCompletedUsers: 0
      });
    }

    const [waitingCount, completedUserCount] = await Promise.all([
      QueueEntry.countDocuments({ queueId: { $in: queueIds }, ...activeEntryMatch }),
      QueueEntry.distinct('userId', { queueId: { $in: queueIds }, ...completedEntryMatch }).then((ids) => ids.length)
    ]);

    return res.json({
      queueCount: queueIds.length,
      totalWaitingUsers: waitingCount,
      totalCompletedUsers: completedUserCount
    });
  } catch (err) {
    return next(err);
  }
}

async function getAdminCompletedCustomers(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const adminQueues = await Queue.find({ adminId: req.user.id }).select('_id');
    const queueIds = adminQueues.map((q) => q._id);
    if (queueIds.length === 0) {
      return res.json({ users: [], total: 0, limit, offset });
    }

    const completedUserIds = await QueueEntry.distinct('userId', {
      queueId: { $in: queueIds },
      ...completedEntryMatch
    });

    const total = completedUserIds.length;
    if (total === 0) {
      return res.json({ users: [], total: 0, limit, offset });
    }

    const pagedIds = completedUserIds.slice(offset, offset + limit);
    const users = await User.find({ _id: { $in: pagedIds } })
      .select('-password')
      .sort({ createdAt: -1 });

    return res.json({ users, total, limit, offset });
  } catch (err) {
    return next(err);
  }
}

async function getQueueEntries(req, res, next) {
  try {
    const { queueId } = req.params || {};
    const queue = await getAdminOwnedQueueOrNull(req.user.id, queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found in your account' });

    const entries = await QueueEntry.find({ queueId: queue._id, ...activeEntryMatch })
      .sort({ joinedAt: 1 })
      .populate({ path: 'userId', select: 'name email role phone profilePicture' });

    return res.json({ queue, entries });
  } catch (err) {
    return next(err);
  }
}

async function getEntryDetails(req, res, next) {
  try {
    const { queueId, entryId } = req.params || {};
    if (!entryId || !mongoose.isValidObjectId(entryId)) {
      return res.status(400).json({ message: 'Invalid entry id' });
    }

    const queue = await getAdminOwnedQueueOrNull(req.user.id, queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found in your account' });

    const entry = await QueueEntry.findOne({ _id: entryId, queueId: queue._id }).populate({
      path: 'userId',
      select: 'name email role phone profilePicture'
    });

    if (!entry) return res.status(404).json({ message: 'Entry not found in this queue' });

    return res.json({
      entry: {
        _id: entry._id,
        joinedAt: entry.joinedAt,
        name: entry.name,
        contact: entry.contact,
        address: entry.address,
        subject: entry.subject,
        userId: entry.userId._id,
        userEmail: entry.userId.email,
        userName: entry.userId.name,
        userPhone: entry.userId.phone || '',
        userProfilePicture: entry.userId.profilePicture || '/uploads/default-avatar.svg'
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function renameQueue(req, res, next) {
  try {
    const { queueId } = req.params || {};
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Queue title is required' });

    const queue = await getAdminOwnedQueueOrNull(req.user.id, queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found in your account' });

    queue.title = title;
    await queue.save();

    return res.json({ message: 'Queue renamed successfully', queue });
  } catch (err) {
    return next(err);
  }
}

async function deleteQueue(req, res, next) {
  try {
    const { queueId } = req.params || {};
    const queue = await getAdminOwnedQueueOrNull(req.user.id, queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found in your account' });

    await QueueEntry.updateMany(
      { queueId: queue._id },
      { $set: { status: 'completed', completedAt: new Date() } }
    );
    await queue.deleteOne();

    return res.json({ message: 'Queue deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

async function removeQueueItem(req, res, next) {
  try {
    const { queueId, id } = req.params || {};
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const queue = await getAdminOwnedQueueOrNull(req.user.id, queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found in your account' });

    const updated = await QueueEntry.findOneAndUpdate(
      { _id: id, queueId: queue._id },
      { $set: { status: 'completed', completedAt: new Date() } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Queue entry not found in your queue' });

    return res.json({ message: 'Removed', entry: updated });
  } catch (err) {
    return next(err);
  }
}

async function nextQueue(req, res, next) {
  try {
    const { queueId } = req.params || {};
    const queue = await getAdminOwnedQueueOrNull(req.user.id, queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found in your account' });

    const nextItem = await QueueEntry.findOne({ queueId: queue._id, ...activeEntryMatch }).sort({ joinedAt: 1 });
    if (!nextItem) return res.status(404).json({ message: 'Queue is empty' });

    await nextItem.populate({ path: 'userId', select: 'name email role' });
    nextItem.status = 'completed';
    nextItem.completedAt = new Date();
    await nextItem.save();

    // Get admin user info for proper name and email
    const adminUser = await User.findById(req.user.id).select('name email');
    const adminName = adminUser?.name || 'Admin';
    const adminEmail = adminUser?.email || '';
    
    console.log('Admin name:', adminName);
    console.log('Admin email:', adminEmail);
    console.log('User being called:', nextItem.userId.name, nextItem.userId.email);

    // Send email notification
    if (nextItem.userId.email) {
      sendCallNotification(
        nextItem.userId.email,
        nextItem.userId.name,
        queue.title,
        adminName,
        adminEmail
      ).then(emailSent => {
        if (emailSent) {
          console.log('Email notification sent successfully to:', nextItem.userId.email);
        } else {
          console.log('Failed to send email notification');
        }
      });
    } else {
      console.log('User does not have an email address');
    }

    // Emit real-time updates
    if (global.io) {
      console.log('Emitting userCalled event to user:', nextItem.userId._id);
      console.log('Queue title:', queue.title);
      
      // Notify the specific user they're being called
      global.io.to(`user_${nextItem.userId._id}`).emit('userCalled', {
        queueTitle: queue.title,
        adminName: adminName,
        adminEmail: adminEmail
      });
      
      console.log('userCalled event emitted successfully');

      // Notify all clients of queue update
      global.io.emit('queueUpdate');
      console.log('queueUpdate event emitted');
    } else {
      console.log('Socket.IO not available');
    }

    return res.json({ next: nextItem });
  } catch (err) {
    return next(err);
  }
}

async function getAllQueues(req, res, next) {
  try {
    const queues = await Queue.find({})
      .sort({ createdAt: -1 })
      .populate({ path: 'adminId', select: 'name email role profilePicture' });
    return res.json({ queues });
  } catch (err) {
    return next(err);
  }
}

async function joinQueue(req, res, next) {
  try {
    const { queueId } = req.params || {};
    if (!queueId || !mongoose.isValidObjectId(queueId)) {
      return res.status(400).json({ message: 'Invalid queue id' });
    }

    const queue = await Queue.findById(queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found' });

    const existingActive = await QueueEntry.findOne({ userId: req.user.id, queueId, ...activeEntryMatch });
    if (existingActive) return res.status(409).json({ message: 'You already joined this queue' });

    // Validate required fields
    const name = String(req.body?.name || '').trim();
    const contact = String(req.body?.contact || '').trim();
    const address = String(req.body?.address || '').trim();
    const subject = String(req.body?.subject || '').trim();

    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!contact) return res.status(400).json({ message: 'Contact info is required' });

    let entry = await QueueEntry.findOne({ userId: req.user.id, queueId, ...completedEntryMatch });
    if (entry) {
      entry.name = name;
      entry.contact = contact;
      entry.address = address;
      entry.subject = subject;
      entry.joinedAt = new Date();
      entry.status = 'joined';
      entry.completedAt = undefined;
      await entry.save();
    } else {
      entry = await QueueEntry.create({
        userId: req.user.id,
        queueId,
        name,
        contact,
        address,
        subject
      });
    }

    // Emit real-time update
    if (global.io) {
      global.io.emit('queueUpdate');
      console.log('queueUpdate event emitted for joinQueue');
    } else {
      console.log('Socket.IO not available for joinQueue');
    }

    return res.status(201).json({ entry });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'You already joined this queue' });
    }
    return next(err);
  }
}

async function removeCompletedQueue(req, res, next) {
  try {
    const { entryId } = req.params || {};
    if (!entryId || !mongoose.isValidObjectId(entryId)) {
      return res.status(400).json({ message: 'Invalid entry id' });
    }

    const deleted = await QueueEntry.findOneAndDelete({
      _id: entryId,
      userId: req.user.id,
      ...completedEntryMatch
    });
    if (!deleted) return res.status(404).json({ message: 'Completed queue entry not found' });

    return res.json({ message: 'Completed queue removed' });
  } catch (err) {
    return next(err);
  }
}

async function getJoinedQueues(req, res, next) {
  try {
    const entries = await QueueEntry.find({ userId: req.user.id, ...activeEntryMatch })
      .sort({ joinedAt: -1 })
      .populate({
        path: 'queueId',
        select: 'title adminId createdAt contact email address',
        populate: { path: 'adminId', select: 'name email role profilePicture' }
      });

    // Calculate position for each entry in their respective queue
    const entriesWithPosition = await Promise.all(
      entries.map(async (entry) => {
        const position = await QueueEntry.countDocuments({
          queueId: entry.queueId._id,
          joinedAt: { $lt: entry.joinedAt },
          ...activeEntryMatch
        });
        return {
          ...entry.toObject(),
          position: position + 1
        };
      })
    );

    return res.json({ entries: entriesWithPosition });
  } catch (err) {
    return next(err);
  }
}

async function getCompletedQueues(req, res, next) {
  try {
    const entries = await QueueEntry.find({ userId: req.user.id, ...completedEntryMatch })
      .sort({ completedAt: -1, joinedAt: -1 })
      .populate({
        path: 'queueId',
        select: 'title adminId createdAt contact email address',
        populate: { path: 'adminId', select: 'name email role profilePicture' }
      });

    return res.json({ entries });
  } catch (err) {
    return next(err);
  }
}

async function leaveQueue(req, res, next) {
  try {
    const { queueId } = req.params || {};
    if (!queueId || !mongoose.isValidObjectId(queueId)) {
      return res.status(400).json({ message: 'Invalid queue id' });
    }

    const queue = await Queue.findById(queueId);
    if (!queue) return res.status(404).json({ message: 'Queue not found' });

    const deleted = await QueueEntry.findOneAndDelete({ userId: req.user.id, queueId });
    if (!deleted) return res.status(404).json({ message: 'You are not in this queue' });

    // Emit real-time update
    if (global.io) {
      global.io.emit('queueUpdate');
      console.log('queueUpdate event emitted for leaveQueue');
    } else {
      console.log('Socket.IO not available for leaveQueue');
    }

    return res.json({ message: 'Left queue successfully' });
  } catch (err) {
    return next(err);
  }
}

async function getQueueDetails(req, res, next) {
  try {
    const { queueId } = req.params || {};
    if (!queueId || !mongoose.isValidObjectId(queueId)) {
      return res.status(400).json({ message: 'Invalid queue id' });
    }

    const queue = await Queue.findById(queueId).populate({ path: 'adminId', select: 'name email profilePicture' });
    if (!queue) return res.status(404).json({ message: 'Queue not found' });

    const count = await QueueEntry.countDocuments({ queueId, ...activeEntryMatch });

    return res.json({
      queue: {
        _id: queue._id,
        title: queue.title,
        createdAt: queue.createdAt,
        adminId: queue.adminId._id,
        adminName: queue.adminId.name,
        adminEmail: queue.adminId.email,
        adminProfilePicture: queue.adminId.profilePicture,
        contact: queue.contact,
        email: queue.email,
        address: queue.address,
        entryCount: count
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function searchQueues(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ queues: [] });

    const regex = new RegExp(q, 'i');

    const admins = await User.find({ name: regex, role: 'admin' }).select('_id');
    const adminIds = admins.map((admin) => admin._id);

    const queues = await Queue.find({
      $or: [{ title: regex }, { adminId: { $in: adminIds } }]
    })
      .populate({ path: 'adminId', select: 'name profilePicture' })
      .select('_id title adminId')
      .sort({ createdAt: -1 });

    const results = queues.map((queue) => ({
      queueId: queue._id,
      title: queue.title,
      adminName: queue.adminId?.name || null,
      adminProfilePicture: queue.adminId?.profilePicture || null
    }));

    return res.json({ queues: results });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createQueue,
  getMyQueues,
  getAdminStats,
  getAdminCompletedCustomers,
  getQueueEntries,
  getEntryDetails,
  renameQueue,
  deleteQueue,
  removeQueueItem,
  nextQueue,
  getAllQueues,
  joinQueue,
  removeCompletedQueue,
  getJoinedQueues,
  getCompletedQueues,
  leaveQueue,
  getQueueDetails,
  searchQueues
};

