// controllers/taskController.js
const Task = require('../models/taskModel');

// ========== CREATE TASK ==========
exports.createTask = async (req, res) => {
  try {
    const { title, description, dueDate, priority, status, assignees, tags } = req.body;

    const newTask = await Task.create({
      owner: req.user._id, // from auth middleware
      title,
      description,
      dueDate,
      priority: priority || 'medium',
      status: status || 'todo',
      assignees: assignees || [],
      tags: tags || []
    });

    res.status(201).json({ success: true, task: newTask });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ========== UPDATE TASK ==========
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updateData = req.body;

    // Optional: handle status change logic
    if (updateData.status === 'done') {
      updateData.completedAt = new Date();
    }

    const updatedTask = await Task.findByIdAndUpdate(taskId, updateData, {
      new: true,
      runValidators: true
    });

    if (!updatedTask) return res.status(404).json({ success: false, message: 'Task not found' });

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ========== GET TASKS (with filters) ==========
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, dueBefore, dueAfter, tag } = req.query;
    const filter = { owner: req.user._id }; // only user's tasks

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (dueBefore) filter.dueDate = { ...filter.dueDate, $lte: new Date(dueBefore) };
    if (dueAfter) filter.dueDate = { ...filter.dueDate, $gte: new Date(dueAfter) };
    if (tag) filter.tags = tag;

    const tasks = await Task.find(filter).sort({ dueDate: 1, priority: -1 });
    res.json({ success: true, tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ========== DELETE TASK ==========
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const deleted = await Task.findByIdAndDelete(taskId);

    if (!deleted) return res.status(404).json({ success: false, message: 'Task not found' });

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
