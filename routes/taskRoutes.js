const express = require('express');
const router = express.Router();
const Task = require('../models/taskModel');
const auth = require('../middleware/authMiddleware');

// Create task
router.post('/', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const task = new Task({ title, user: req.user }); // ইউজারের টাস্ক
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Error creating task' });
  }
});

// Get all tasks for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// Update task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.title = req.body.title || task.title;
    task.completed = req.body.completed ?? task.completed;
    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Error updating task' });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task' });
  }
});

module.exports = router;
