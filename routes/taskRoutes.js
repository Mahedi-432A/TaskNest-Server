// =================== routes/taskRoutes.js ===================
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require auth
router.use(authMiddleware);

// Create task
router.post('/', taskController.createTask);

// Get tasks (with optional filters)
router.get('/', taskController.getTasks);

// Update task
router.put('/:taskId', taskController.updateTask);

// Delete task
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;
