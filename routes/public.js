const express = require('express');
const { dbHelpers } = require('../db/database');
const router = express.Router();

// Get all categories with preview project
router.get('/categories', (req, res) => {
  dbHelpers.getAllCategories((err, categories) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }

    if (!categories || categories.length === 0) {
      return res.json([]);
    }

    // Get preview project for each category
    let processed = 0;
    const categoriesWithPreview = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      preview_image: cat.preview_project_image || cat.preview_image
    }));

    res.json(categoriesWithPreview);
  });
});

// Get category by ID
router.get('/categories/:id', (req, res) => {
  const { id } = req.params;

  dbHelpers.getCategoryById(id, (err, category) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch category' });
    }

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  });
});

// Get all projects for a category
router.get('/categories/:categoryId/projects', (req, res) => {
  const { categoryId } = req.params;

  dbHelpers.getProjectsByCategory(categoryId, (err, projects) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    const visibleProjects = (projects || []).filter(p => !p.is_hidden);
    res.json(visibleProjects);
  });
});

// Get single project by ID
router.get('/projects/:id', (req, res) => {
  const { id } = req.params;

  dbHelpers.getProjectById(id, (err, project) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch project' });
    }

    if (!project || project.is_hidden) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  });
});

// Submit contact message
router.post('/messages', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  dbHelpers.createMessage(name, email, subject, message, (err, messageId) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save message' });
    }

    res.status(201).json({
      id: messageId,
      message: 'Message sent successfully'
    });
  });
});

module.exports = router;
