// models/Task.js
// Production-ready Task schema for TaskNest (Mongoose)
// ---------------------------------------------------
// Highlights
// - Rich fields: status, priority, tags, reminders, subtasks, attachments, comments, activity log
// - Scheduling: start/due/completed, recurrence support, reminders (absolute & relative)
// - Collaboration: assignees, watchers, visibility, project/list refs
// - Time tracking: estimate, time logs, total time
// - Dependencies: blockedBy
// - Soft archive, ordering, color/icon for UI
// - Indexes, virtuals, lean-friendly toJSON/toObject transforms

const mongoose = require('mongoose');

// ===== Enums =====
const STATUS = ['backlog', 'todo', 'in_progress', 'blocked', 'done', 'canceled', 'archived'];
const PRIORITY = ['low', 'medium', 'high', 'urgent'];
const VISIBILITY = ['private', 'team', 'public'];
const REMINDER_CHANNEL = ['inapp', 'email', 'push', 'webhook'];
const RECURRENCE_FREQ = ['daily', 'weekly', 'monthly', 'yearly'];

// ===== Sub Schemas =====
const ReminderSchema = new mongoose.Schema(
  {
    // Either absolute `at` or relative `offsetMinutes` (before dueDate)
    at: { type: Date },
    offsetMinutes: { type: Number, min: 0 },
    channel: { type: String, enum: REMINDER_CHANNEL, default: 'inapp' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const SubtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dueDate: { type: Date },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: true } }
);

const AttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number }, // bytes
    url: { type: String, required: true }, // could be S3 / GCS / CDN
    provider: { type: String }, // e.g., 's3', 'gdrive'
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const CommentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true },
    editedAt: { type: Date },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: true } }
);

const ActivitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, required: true }, // e.g., 'status_changed', 'comment_added'
    meta: { type: mongoose.Schema.Types.Mixed }, // any structured details
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const TimeLogSchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    endedAt: { type: Date }, // optional while running
    seconds: { type: Number, min: 0 }, // if not using endedAt, explicitly store seconds
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const RecurrenceSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    freq: { type: String, enum: RECURRENCE_FREQ },
    interval: { type: Number, default: 1, min: 1 }, // every N freq
    byWeekday: [{ type: Number, min: 0, max: 6 }], // 0=Sun ... 6=Sat (for weekly)
    byMonthday: [{ type: Number, min: 1, max: 31 }], // for monthly
    count: { type: Number, min: 1 }, // total occurrences
    until: { type: Date },
    // For series tracking
    isSeriesMaster: { type: Boolean, default: false },
    seriesId: { type: String },
  },
  { _id: false }
);

// ===== Main Task Schema =====
const TaskSchema = new mongoose.Schema(
  {
    // Ownership & hierarchy
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'List' }, // e.g., Kanban column / list

    // Core
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, trim: true },

    // UX niceties
    color: { type: String, trim: true }, // e.g., hex or token
    icon: { type: String, trim: true }, // e.g., emoji name or code

    // State
    status: { type: String, enum: STATUS, default: 'todo' },
    priority: { type: String, enum: PRIORITY, default: 'medium' },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },

    // Assignment & collaboration
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visibility: { type: String, enum: VISIBILITY, default: 'private' },

    // Scheduling
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date },

    // Recurrence
    recurrence: { type: RecurrenceSchema, default: () => ({ enabled: false }) },

    // Tags
    tags: [{ type: String, trim: true, lowercase: true }],

    // Subtasks & comments & files
    subtasks: { type: [SubtaskSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },

    // Reminders
    reminders: { type: [ReminderSchema], default: [] },

    // Dependencies (blocked by other tasks)
    blockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

    // Time tracking
    estimateMinutes: { type: Number, min: 0, default: 0 },
    timeLogs: { type: [TimeLogSchema], default: [] },
    totalTimeSeconds: { type: Number, min: 0, default: 0 },

    // Ordering for lists/boards
    sortOrder: { type: Number, default: 0 },

    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Freeform metadata (integrations, custom fields)
    meta: { type: mongoose.Schema.Types.Mixed },

    // Activity log (optional, light-weight)
    activity: { type: [ActivitySchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // Hide anything internal if needed
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ===== Indexes =====
TaskSchema.index({ owner: 1, status: 1, dueDate: 1 });
TaskSchema.index({ project: 1, status: 1, sortOrder: 1 });
TaskSchema.index({ isArchived: 1, archivedAt: 1 });
TaskSchema.index({ tags: 1 });
TaskSchema.index({ title: 'text', description: 'text', tags: 'text' });
// Efficient upcoming reminders for active tasks
TaskSchema.index(
  { dueDate: 1 },
  { partialFilterExpression: { status: { $ne: 'done' }, isArchived: false } }
);

// ===== Virtuals =====
TaskSchema.virtual('isOverdue').get(function () {
  return !!(this.dueDate && !['done', 'canceled', 'archived'].includes(this.status) && this.dueDate < new Date());
});

TaskSchema.virtual('isCompleted').get(function () {
  return this.status === 'done' || !!this.completedAt;
});

TaskSchema.virtual('subtaskSummary').get(function () {
  const total = this.subtasks?.length || 0;
  const done = this.subtasks?.filter((s) => s.completed).length || 0;
  return { total, done, progress: total ? Math.round((done / total) * 100) : 0 };
});

// ===== Methods & Statics =====
TaskSchema.methods.addTimeLog = function ({ startedAt, endedAt, seconds, user }) {
  const log = { startedAt: startedAt || new Date(), endedAt, seconds, user };
  this.timeLogs.push(log);
  // Normalize totalTimeSeconds if seconds provided or if endedAt-known
  if (typeof seconds === 'number') {
    this.totalTimeSeconds += Math.max(0, seconds);
  } else if (startedAt && endedAt) {
    const diff = Math.max(0, Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000));
    this.totalTimeSeconds += diff;
  }
};

TaskSchema.methods.complete = function (byUserId) {
  this.status = 'done';
  this.completedAt = new Date();
  this.updatedBy = byUserId || this.updatedBy;
};

// ===== Hooks =====
TaskSchema.pre('save', function (next) {
  // Auto-archive guard
  if (this.status === 'archived') {
    this.isArchived = true;
    if (!this.archivedAt) this.archivedAt = new Date();
  }
  // Keep completedAt in sync
  if (this.status === 'done' && !this.completedAt) {
    this.completedAt = new Date();
  }
  if (this.status !== 'done') {
    this.completedAt = undefined;
  }
  // Normalize tags: trim & lowercase already handled by schema, also remove empties
  if (Array.isArray(this.tags)) {
    this.tags = this.tags.filter((t) => typeof t === 'string' && t.trim().length).map((t) => t.trim().toLowerCase());
  }
  next();
});

// Keep updatedBy via direct updates (findOneAndUpdate)
TaskSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  // If status moved to archived, set isArchived/archivedAt
  if (update.status === 'archived' || (update.$set && update.$set.status === 'archived')) {
    update.$set = { ...(update.$set || {}), isArchived: true, archivedAt: new Date() };
  }
  // If status changed to done, ensure completedAt; if undone, clear it
  const newStatus = update.status ?? (update.$set && update.$set.status);
  if (newStatus === 'done') {
    update.$set = { ...(update.$set || {}), completedAt: new Date() };
  } else if (newStatus && newStatus !== 'done') {
    update.$unset = { ...(update.$unset || {}), completedAt: '' };
  }
  this.setUpdate(update);
  next();
});

// ===== Export =====
module.exports = mongoose.models.Task || mongoose.model('Task', TaskSchema);
