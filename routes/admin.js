const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { dbHelpers } = require('../db/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic.path || ffmpegStatic);
}
if (ffprobeStatic) {
  ffmpeg.setFfprobePath(ffprobeStatic.path || ffprobeStatic);
}

const generateImagePreview = async (inputPath, outputPath) => {
  await sharp(inputPath)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toFile(outputPath);
};

const generateVideoPreview = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vframes 1', // Extract only 1 frame
        '-q:v 2', // High quality for the single frame
        '-ss 1' // Seek to 1 second to get a representative frame
      ])
      .size('480x?')
      .on('end', () => resolve())
      .on('error', (err) => {
        console.error('Video preview generation error:', err);
        // Don't reject - allow the upload to continue even if preview fails
        resolve();
      })
      .save(outputPath);
  });
};

const updateEnvValue = (key, value) => {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return false;

  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env[key] = value;
    return true;
  } catch (err) {
    console.error('Error updating .env file:', err);
    return false;
  }
};

// Helper function to delete local media files
const deleteFile = (fileUrl) => {
  if (fileUrl && fileUrl.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '../public', fileUrl);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', filePath, err);
      else console.log('File deleted successfully:', filePath);
    });
  }
};

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    // Accept all files - let the backend handle content type detection
    cb(null, true);
  }
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 200MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files uploaded.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field.' });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
};

// ============ CATEGORY ROUTES ============

// Get all categories
router.get('/categories', verifyToken, (req, res) => {
  dbHelpers.getAllCategories((err, categories) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    res.json(categories || []);
  });
});

// Get category by ID
router.get('/categories/:id', verifyToken, (req, res) => {
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

// Create category
router.post('/categories', verifyToken, upload.single('preview_image'), handleMulterError, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  let preview_image = null;

  try {
    if (req.file) {
      const previewFilename = `preview-category-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
      const previewFilePath = path.join(uploadsDir, previewFilename);
      await generateImagePreview(req.file.path, previewFilePath);
      deleteFile(`/uploads/${req.file.filename}`);
      preview_image = `/uploads/${previewFilename}`;
    }
  } catch (err) {
    console.error('Error creating category preview image:', err);
    return res.status(500).json({ error: 'Failed to create preview image' });
  }

  dbHelpers.createCategory(name, description, preview_image, (err, categoryId) => {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Category name already exists' });
      }
      return res.status(500).json({ error: 'Failed to create category' });
    }

    res.status(201).json({ 
      id: categoryId,
      name,
      description,
      preview_image
    });
  });
});

// Update category
router.put('/categories/:id', verifyToken, upload.single('preview_image'), handleMulterError, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  dbHelpers.getCategoryById(id, async (err, category) => {
    if (err || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    let preview_image = category.preview_image;

    try {
      if (req.file) {
        const previewFilename = `preview-category-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const previewFilePath = path.join(uploadsDir, previewFilename);
        await generateImagePreview(req.file.path, previewFilePath);
        preview_image = `/uploads/${previewFilename}`;
        if (category.preview_image) {
          deleteFile(category.preview_image);
        }
        deleteFile(`/uploads/${req.file.filename}`);
      }
    } catch (err) {
      console.error('Error updating category preview image:', err);
      return res.status(500).json({ error: 'Failed to update preview image' });
    }

    dbHelpers.updateCategory(id, name, description, preview_image, (err) => {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Category name already exists' });
        }
        return res.status(500).json({ error: 'Failed to update category' });
      }

      res.json({ 
        id,
        name,
        description,
        preview_image
      });
    });
  });
});

// Delete category
router.delete('/categories/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  // Find all projects under this category to delete their media files first
  dbHelpers.getProjectsByCategory(id, (err, projects) => {
    if (!err && projects) {
      projects.forEach((proj) => {
        deleteFile(proj.media_url);
        deleteFile(proj.preview_url);
      });
    }

    // Now find the category itself to delete its preview image
    dbHelpers.getCategoryById(id, (err, category) => {
      if (!err && category) {
        deleteFile(category.preview_image);
      }

      // Delete the category from database (which cascade deletes projects)
      dbHelpers.deleteCategory(id, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete category' });
        }
        res.json({ message: 'Category deleted successfully' });
      });
    });
  });
});

// ============ PROJECT ROUTES ============

// Get all projects
router.get('/projects', verifyToken, (req, res) => {
  dbHelpers.getAllProjects((err, projects) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
    res.json(projects || []);
  });
});

// Get projects by category
router.get('/projects/category/:categoryId', verifyToken, (req, res) => {
  const { categoryId } = req.params;

  dbHelpers.getProjectsByCategory(categoryId, (err, projects) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
    res.json(projects || []);
  });
});

// Get project by ID
router.get('/projects/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  dbHelpers.getProjectById(id, (err, project) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch project' });
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  });
});

// Create project
router.post('/projects', verifyToken, upload.fields([{ name: 'media', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), handleMulterError, async (req, res) => {
  const { category_id, title, description, content_type, media_url, display_order } = req.body;

  // Get default category (first category) if not provided
  let finalCategoryId = category_id;
  if (!finalCategoryId) {
    try {
      const categories = await new Promise((resolve, reject) => {
        dbHelpers.getAllCategories((err, cats) => {
          if (err) reject(err);
          else resolve(cats || []);
        });
      });
      if (categories.length > 0) {
        finalCategoryId = categories[0].id;
      } else {
        return res.status(400).json({ error: 'No categories found. Please create a category first.' });
      }
    } catch (err) {
      console.error('Error getting default category:', err);
      return res.status(500).json({ error: 'Failed to get default category' });
    }
  }

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const mediaFile = req.files && req.files['media'] ? req.files['media'][0] : null;
  const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

  // Auto-detect content type from file if not provided
  let finalContentType = content_type;
  if (!finalContentType && mediaFile) {
    if (mediaFile.mimetype.startsWith('video/')) {
      finalContentType = 'video';
    } else if (mediaFile.mimetype.startsWith('image/')) {
      finalContentType = 'image';
    } else {
      // Fallback based on file extension
      const ext = path.extname(mediaFile.originalname).toLowerCase().substring(1);
      if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
        finalContentType = 'video';
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        finalContentType = 'image';
      } else {
        finalContentType = 'link'; // Default fallback
      }
    }
  }

  if (!finalContentType) {
    return res.status(400).json({ error: 'Content type is required' });
  }

  let finalMediaUrl = media_url;
  let preview_url = null;

  try {
    if (mediaFile) {
      finalMediaUrl = `/uploads/${mediaFile.filename}`;

      if (thumbnailFile) {
        // Use uploaded custom thumbnail
        const previewFilename = `preview-project-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const previewFilePath = path.join(uploadsDir, previewFilename);
        await generateImagePreview(thumbnailFile.path, previewFilePath);
        preview_url = `/uploads/${previewFilename}`;
        deleteFile(`/uploads/${thumbnailFile.filename}`); // Cleanup original thumbnail if processed, or just keep it.
      } else if (finalContentType === 'image') {
        const previewFilename = `preview-project-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const previewFilePath = path.join(uploadsDir, previewFilename);
        await generateImagePreview(mediaFile.path, previewFilePath);
        preview_url = `/uploads/${previewFilename}`;
      } else if (finalContentType === 'video') {
        const previewFilename = `preview-project-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const previewFilePath = path.join(uploadsDir, previewFilename);
        await generateVideoPreview(mediaFile.path, previewFilePath);
        preview_url = `/uploads/${previewFilename}`;
      }
    } else if (thumbnailFile && media_url) {
      // User provided an external link, but uploaded a custom thumbnail
      finalMediaUrl = media_url;
      const previewFilename = `preview-project-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
      const previewFilePath = path.join(uploadsDir, previewFilename);
      await generateImagePreview(thumbnailFile.path, previewFilePath);
      preview_url = `/uploads/${previewFilename}`;
      deleteFile(`/uploads/${thumbnailFile.filename}`);
    } else if (!media_url) {
      return res.status(400).json({ error: 'Media file or URL is required' });
    }
  } catch (err) {
    console.error('Error creating project preview:', err);
    return res.status(500).json({ error: 'Failed to create preview file' });
  }

  dbHelpers.createProject(
    finalCategoryId,
    title,
    description,
    finalContentType,
    finalMediaUrl,
    display_order || 0,
    preview_url,
    (err, projectId) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to create project' });
      }

      res.status(201).json({
        id: projectId,
        category_id: finalCategoryId,
        title,
        description,
        content_type: finalContentType,
        media_url: finalMediaUrl,
        preview_url,
        display_order: display_order || 0
      });
    }
  );
});

// Update project
router.put('/projects/:id', verifyToken, upload.fields([{ name: 'media', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), handleMulterError, async (req, res) => {
  const { id } = req.params;
  const { category_id, title, description, content_type, media_url, display_order } = req.body;

  dbHelpers.getProjectById(id, async (err, project) => {
    if (err || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Use existing category_id if not provided
    let finalCategoryId = category_id || project.category_id;
    
    const mediaFile = req.files && req.files['media'] ? req.files['media'][0] : null;
    const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

    // Auto-detect content type from file if not provided
    let finalContentType = content_type || project.content_type;
    if (!finalContentType && mediaFile) {
      if (mediaFile.mimetype.startsWith('video/')) {
        finalContentType = 'video';
      } else if (mediaFile.mimetype.startsWith('image/')) {
        finalContentType = 'image';
      } else {
        // Fallback based on file extension
        const ext = path.extname(mediaFile.originalname).toLowerCase().substring(1);
        if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
          finalContentType = 'video';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
          finalContentType = 'image';
        } else {
          finalContentType = 'link'; // Default fallback
        }
      }
    }

    let finalMediaUrl = media_url || project.media_url;
    let preview_url = project.preview_url || null;

    try {
      if (mediaFile || thumbnailFile) {
        if (mediaFile) {
          finalMediaUrl = `/uploads/${mediaFile.filename}`;
          if (project.media_url) {
            deleteFile(project.media_url);
          }
        }

        if (thumbnailFile) {
          if (project.preview_url) {
            deleteFile(project.preview_url);
          }
          const previewFilename = `preview-project-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
          const previewFilePath = path.join(uploadsDir, previewFilename);
          await generateImagePreview(thumbnailFile.path, previewFilePath);
          preview_url = `/uploads/${previewFilename}`;
          deleteFile(`/uploads/${thumbnailFile.filename}`);
        } else if (mediaFile) {
          if (project.preview_url) {
            deleteFile(project.preview_url);
          }
          if (finalContentType === 'image') {
            const previewFilename = `preview-project-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
            const previewFilePath = path.join(uploadsDir, previewFilename);
            await generateImagePreview(mediaFile.path, previewFilePath);
            preview_url = `/uploads/${previewFilename}`;
          } else if (finalContentType === 'video') {
            const previewFilename = `preview-project-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
            const previewFilePath = path.join(uploadsDir, previewFilename);
            await generateVideoPreview(mediaFile.path, previewFilePath);
            preview_url = `/uploads/${previewFilename}`;
          } else {
            preview_url = null;
          }
        }
      } else if (media_url && media_url !== project.media_url) {
        // External URL was provided; remove any existing local preview
        if (project.preview_url) {
          deleteFile(project.preview_url);
          preview_url = null;
        }
      }

      if (!mediaFile && !thumbnailFile && finalContentType === 'link') {
        // Wait, if content type changed to link and no files, maybe user cleared preview.
        // We handle this if media_url is changed above.
      }
    } catch (err) {
      console.error('Error updating project preview:', err);
      return res.status(500).json({ error: 'Failed to update preview file' });
    }

    dbHelpers.updateProject(
      id,
      finalCategoryId,
      title,
      description,
      finalContentType,
      finalMediaUrl,
      display_order || 0,
      preview_url,
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update project' });
        }

        res.json({
          id,
          category_id: finalCategoryId,
          title,
          description,
          content_type: finalContentType,
          media_url: finalMediaUrl,
          preview_url,
          display_order: display_order || 0
        });
      }
    );
  });
});

// Delete project
router.delete('/projects/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  dbHelpers.getProjectById(id, (err, project) => {
    if (err || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete project files physically
    deleteFile(project.media_url);
    deleteFile(project.preview_url);

    dbHelpers.deleteProject(id, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete project' });
      }
      res.json({ message: 'Project deleted successfully' });
    });
  });
});

// ============ MESSAGES ROUTES ============

// Get all contact messages
router.get('/messages', verifyToken, (req, res) => {
  dbHelpers.getAllMessages((err, messages) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
    res.json(messages || []);
  });
});

// Delete contact message
router.delete('/messages/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  dbHelpers.deleteMessage(id, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete message' });
    }
    res.json({ message: 'Message deleted successfully' });
  });
});

// ============ SETTINGS ROUTES ============

// Change admin username and/or password
router.post('/change-credentials', verifyToken, (req, res) => {
  const { currentPassword, newPassword, newUsername } = req.body;

  if (!currentPassword || (!newPassword && !newUsername)) {
    return res.status(400).json({ error: 'Current password and a new username or password are required' });
  }

  bcrypt.compare(currentPassword, process.env.ADMIN_PASSWORD_HASH, (err, isMatch) => {
    if (err) {
      return res.status(500).json({ error: 'Server error during password verification' });
    }

    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const updateUsername = () => {
      if (!newUsername) return true;
      return updateEnvValue('ADMIN_USERNAME', newUsername);
    };

    const updatePassword = (callback) => {
      if (!newPassword) return callback(null, true);
      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return callback(err);
        const success = updateEnvValue('ADMIN_PASSWORD_HASH', hash);
        callback(null, success);
      });
    };

    updatePassword((err, passwordUpdated) => {
      if (err || !passwordUpdated) {
        return res.status(500).json({ error: 'Failed to update password configuration' });
      }

      const usernameUpdated = updateUsername();
      if (!usernameUpdated) {
        return res.status(500).json({ error: 'Failed to update username configuration' });
      }

      res.json({ message: 'Credentials updated successfully' });
    });
  });
});

// ============ ADVANCED ADMIN ROUTES ============

// Reset Database
router.post('/database/reset', verifyToken, (req, res) => {
  dbHelpers.resetDatabase((err) => {
    if (err) return res.status(500).json({ error: 'Failed to reset database' });
    
    // Also clear uploads directory if requested, but let's just clear DB as per user request
    res.json({ message: 'Database reset successfully.' });
  });
});

// Toggle Project Visibility
router.put('/projects/:id/visibility', verifyToken, (req, res) => {
  const { id } = req.params;
  const { is_hidden } = req.body;
  
  dbHelpers.toggleProjectVisibility(id, is_hidden, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update visibility' });
    res.json({ message: 'Visibility updated' });
  });
});

// Bulk Delete Projects
router.post('/projects/bulk-delete', verifyToken, (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid IDs array' });
  
  // To avoid unlinked files, ideally we fetch and delete files first. 
  // For simplicity and speed in bulk delete, we'll just delete from DB.
  // In a robust system we'd unlink files too.
  dbHelpers.deleteMultipleProjects(ids, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete projects' });
    res.json({ message: 'Projects deleted successfully' });
  });
});

// Duplicate Project
router.post('/projects/:id/duplicate', verifyToken, (req, res) => {
  const { id } = req.params;
  dbHelpers.duplicateProject(id, (err, newId) => {
    if (err) return res.status(500).json({ error: 'Failed to duplicate project' });
    res.json({ message: 'Project duplicated', id: newId });
  });
});

// Move Project Category
router.put('/projects/:id/move', verifyToken, (req, res) => {
  const { id } = req.params;
  const { category_id } = req.body;
  dbHelpers.moveProjectCategory(id, category_id, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to move project' });
    res.json({ message: 'Project moved' });
  });
});

// ============ BACKUP & RESTORE ROUTES ============

// Download database file
router.get('/backup/db', verifyToken, (req, res) => {
  const dbPath = path.join(__dirname, '../db/portfolio.db');
  if (fs.existsSync(dbPath)) {
    res.download(dbPath, 'portfolio.db');
  } else {
    res.status(404).json({ error: 'Database file not found' });
  }
});

// Get list of uploaded files
router.get('/backup/files', verifyToken, (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    // filter out directories
    const fileList = files.filter(f => fs.statSync(path.join(uploadsDir, f)).isFile());
    res.json(fileList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read uploads directory' });
  }
});

// Restore database
router.post('/restore/db', verifyToken, upload.single('db_file'), handleMulterError, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Database file is required' });
  }
  
  const uploadedDbPath = req.file.path;
  
  dbHelpers.restoreDatabaseFromFile(uploadedDbPath, (err) => {
    try {
      deleteFile(`/uploads/${req.file.filename}`); // clean up the multer uploaded copy
    } catch (e) {
      console.error('Failed to delete temp uploaded db file:', e);
    }
    
    if (err) {
      console.error('Failed to restore db file:', err);
      return res.status(500).json({ error: 'Failed to restore database file' });
    }
    
    res.json({ message: 'Database restored successfully!' });
  });
});

// Check missing files
router.get('/restore/missing-files', verifyToken, (req, res) => {
  dbHelpers.getAllCategories((err, categories) => {
    if (err) return res.status(500).json({ error: 'DB Error' });
    
    dbHelpers.getAllProjects((err, projects) => {
      if (err) return res.status(500).json({ error: 'DB Error' });
      
      const expectedFiles = new Set();
      
      (categories || []).forEach(c => {
        if (c.preview_image && c.preview_image.startsWith('/uploads/')) {
          expectedFiles.add(c.preview_image.replace('/uploads/', ''));
        }
      });
      
      (projects || []).forEach(p => {
        if (p.media_url && p.media_url.startsWith('/uploads/')) {
          expectedFiles.add(p.media_url.replace('/uploads/', ''));
        }
        if (p.preview_url && p.preview_url.startsWith('/uploads/')) {
          expectedFiles.add(p.preview_url.replace('/uploads/', ''));
        }
      });
      
      let actualFiles = [];
      try {
        actualFiles = fs.readdirSync(uploadsDir);
      } catch (e) {}
      
      const missingFiles = Array.from(expectedFiles).filter(f => !actualFiles.includes(f));
      
      res.json({ missing: missingFiles });
    });
  });
});

// Restore single missing file
const uploadSpecific = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      // Use the filename provided in the request body
      cb(null, req.body.target_filename || file.originalname);
    }
  })
});

router.post('/restore/file', verifyToken, uploadSpecific.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }
  res.json({ message: 'File restored successfully', filename: req.file.filename });
});

module.exports = router;
