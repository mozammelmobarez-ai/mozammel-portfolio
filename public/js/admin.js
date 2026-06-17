// ============ STATE ============
let token = localStorage.getItem('adminToken');
let categories = [];
let projects = [];
let messages = [];
let editingCategoryId = null;
let editingProjectId = null;
let categoryProjectsMap = {}; // Map category ID to its projects

// ============ AUTHENTICATED API WRAPPER ============
async function apiCall(url, options = {}) {
  // Ensure headers object exists
  options.headers = options.headers || {};
  
  // Set Authorization header if token exists
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, options);
    
    // Check for expired or unauthorized sessions
    if (response.status === 401 || response.status === 403) {
      handleLogout();
      const loginError = document.getElementById('loginError');
      if (loginError) {
        loginError.textContent = 'Session expired. Please log in again.';
        loginError.classList.add('show');
      }
      throw new Error('Unauthorized');
    }
    
    return response;
  } catch (err) {
    if (err.message === 'Unauthorized') throw err;
    console.error(`API Call error on ${url}:`, err);
    throw err;
  }
}

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  // Only init custom cursor on devices with fine pointers (mouse)
  if (window.matchMedia('(pointer: fine)').matches) {
    initCustomCursor();
  }

  if (token) {
    showDashboard();
    loadCategories();
    loadMessages();
  } else {
    showLogin();
  }

  setupEventListeners();
});

// ============ CUSTOM CURSOR LOGIC ============
function initCustomCursor() {
  const customCursor = document.getElementById('customCursor');
  if (!customCursor) return;

  // Direct cursor movement without lag
  document.addEventListener('mousemove', (e) => {
    customCursor.style.left = e.clientX + 'px';
    customCursor.style.top = e.clientY + 'px';
  });

  // Observe hover events on interactive elements (re-runnable)
  setupCursorHover();

  // Click effect
  document.addEventListener('mousedown', () => {
    customCursor.classList.add('clicking');
  });

  document.addEventListener('mouseup', () => {
    customCursor.classList.remove('clicking');
  });

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', () => {
    customCursor.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    customCursor.style.opacity = '1';
  });

  // Fullscreen support (Cursor visibility in fullscreen)
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      if (document.fullscreenElement.tagName === 'VIDEO') {
        customCursor.style.display = 'none';
      } else {
        document.fullscreenElement.appendChild(customCursor);
        customCursor.style.display = 'block';
        customCursor.style.zIndex = '99999999';
      }
    } else {
      document.body.appendChild(customCursor);
      customCursor.style.display = 'block';
    }
  });
}

function setupCursorHover() {
  const customCursor = document.getElementById('customCursor');
  if (!customCursor) return;

  const interactiveElements = document.querySelectorAll('a, button, input, textarea, select, label, .admin-item-card, .admin-tab-btn');

  interactiveElements.forEach(el => {
    // Prevent duplicate listeners
    if (el.dataset.cursorObserved) return;
    el.dataset.cursorObserved = 'true';

    el.addEventListener('mouseenter', () => {
      customCursor.classList.add('hovering');
    });
    el.addEventListener('mouseleave', () => {
      customCursor.classList.remove('hovering');
    });
  });
}

// ============ UI FUNCTIONS ============
function showLogin() {
  document.getElementById('loginWrapper').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('show');
}

function showDashboard() {
  document.getElementById('loginWrapper').style.display = 'none';
  document.getElementById('dashboard').classList.add('show');
}

function setupEventListeners() {
  // Login
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Tabs
  document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Categories
  document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);

  // Projects (in modal)
  document.getElementById('projectForm').addEventListener('submit', handleProjectSubmit);
  
  // Media type radio buttons
  document.querySelectorAll('input[name="media_type"]').forEach(radio => {
    radio.addEventListener('change', handleMediaTypeChange);
  });

  // File upload labels
  document.getElementById('catImage').addEventListener('change', (e) => {
    document.getElementById('catImageName').textContent = e.target.files[0]?.name || 'Click to upload preview image';
  });

  document.getElementById('projMedia').addEventListener('change', (e) => {
    document.getElementById('projMediaName').textContent = e.target.files[0]?.name || 'Click to upload media file';
  });

  document.getElementById('projThumbnail').addEventListener('change', (e) => {
    document.getElementById('projThumbnailName').textContent = e.target.files[0]?.name || 'Click to upload custom thumbnail (optional)';
  });

  // Settings
  document.getElementById('settingsForm').addEventListener('submit', handlePasswordChange);

  // Close modal on outside click
  document.getElementById('projectModal').addEventListener('click', (e) => {
    if (e.target.id === 'projectModal') {
      closeProjectModal();
    }
  });
};

function switchTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.admin-tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === tabName + 'Tab');
  });

  // Load relevant data on tab switch
  if (tabName === 'messages') {
    loadMessages();
  }
}

// ============ AUTHENTICATION ============
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    token = data.token;
    localStorage.setItem('adminToken', token);
    errorEl.classList.remove('show');

    document.getElementById('loginForm').reset();
    showDashboard();
    loadCategories();
    loadMessages();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  }
}

async function handleLogout() {
  // Clear token in cookie from server
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.error('Failed to logout cookie from server:', e);
  }

  token = null;
  localStorage.removeItem('adminToken');
  document.getElementById('loginForm').reset();
  document.getElementById('categoryForm').reset();
  document.getElementById('projectForm').reset();
  document.getElementById('settingsForm').reset();
  editingCategoryId = null;
  editingProjectId = null;
  categoryProjectsMap = {};
  showLogin();
}

// ============ CATEGORIES ============
async function loadCategories() {
  try {
    const response = await apiCall('/api/admin/categories');

    if (!response.ok) throw new Error('Failed to load categories');

    categories = await response.json();
    
    // Load projects for each category
    for (const cat of categories) {
      const projResponse = await apiCall(`/api/admin/projects/category/${cat.id}`);
      if (projResponse.ok) {
        categoryProjectsMap[cat.id] = await projResponse.json();
      } else {
        categoryProjectsMap[cat.id] = [];
      }
    }
    
    renderCategoriesList();
  } catch (err) {
    console.error('Error loading categories:', err);
    showMessage('categoriesMessage', err.message, 'error');
  }
}

async function handleCategorySubmit(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  try {
    const url = editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : '/api/admin/categories';
    const method = editingCategoryId ? 'PUT' : 'POST';

    const response = await apiCall(url, {
      method,
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save category');

    showMessage('categoriesMessage', `Category ${editingCategoryId ? 'updated' : 'created'} successfully!`, 'success');
    form.reset();
    editingCategoryId = null;
    document.getElementById('cancelCatForm').style.display = 'none';
    document.querySelector('#categoryForm button[type="submit"]').textContent = 'Add Category';
    document.getElementById('catImageName').textContent = 'Click to upload preview image';
    loadCategories();
  } catch (err) {
    showMessage('categoriesMessage', err.message, 'error');
  }
}

function renderCategoriesList() {
  const list = document.getElementById('categoriesList');

  // Save open accordion states
  const openAccordions = Array.from(document.querySelectorAll('.admin-category-projects.open')).map(el => el.id);

  if (categories.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No categories yet</div>';
    return;
  }

  list.innerHTML = categories.map((cat) => {
    const catProjects = categoryProjectsMap[cat.id] || [];
    return `
      <div class="admin-category-accordion" data-category-id="${cat.id}">
        <div class="admin-category-header" onclick="toggleCategoryAccordion(${cat.id})">
          <div class="admin-category-info">
            <h3>${cat.name}</h3>
            <p>${cat.description || 'No description'} • ${catProjects.length} project${catProjects.length !== 1 ? 's' : ''}</p>
          </div>
          <div class="admin-category-actions">
            <button class="admin-add-project-btn" onclick="event.stopPropagation(); openProjectModal(${cat.id})">+ Add Project</button>
            <button class="admin-btn-small" onclick="event.stopPropagation(); editCategory(${cat.id})">Edit</button>
            <button class="admin-btn-small delete" onclick="event.stopPropagation(); deleteCategory(${cat.id})">Delete</button>
            <button class="admin-category-toggle" onclick="event.stopPropagation(); toggleCategoryAccordion(${cat.id})">▼</button>
          </div>
        </div>
        <div class="admin-category-projects" id="category-projects-${cat.id}">
          <div class="admin-projects-list" id="projects-list-${cat.id}" data-category-id="${cat.id}">
            ${renderProjectsListItems(catProjects, cat.id)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Initialize SortableJS for each category's projects list
  categories.forEach(cat => {
    const projectsList = document.getElementById(`projects-list-${cat.id}`);
    if (projectsList) {
      new Sortable(projectsList, {
        group: 'sharedProjects',
        animation: 150,
        ghostClass: 'dragging',
        onEnd: async function(evt) {
          if (evt.from !== evt.to) {
            const projectId = evt.item.dataset.projectId;
            const newCategoryId = evt.to.dataset.categoryId;
            const oldCategoryId = evt.from.dataset.categoryId;
            
            try {
              // 1. Move project to new category
              await apiCall(`/api/admin/projects/${projectId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id: newCategoryId })
              });
              
              // 2. Save order of new category
              await saveProjectOrder(newCategoryId, true);
              // 3. Save order of old category
              await saveProjectOrder(oldCategoryId, true);
              
              showMessage('categoriesMessage', 'Project moved to new category successfully!', 'success');
              
              // 4. Reload completely to ensure consistent state
              loadCategories(); 
            } catch (err) {
              showMessage('categoriesMessage', err.message, 'error');
              loadCategories(); // revert UI on error
            }
          } else {
            saveProjectOrder(cat.id);
          }
        }
      });
    }
  });

  // Restore open accordions
  openAccordions.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      const toggleBtn = el.previousElementSibling.querySelector('.admin-category-toggle');
      if (toggleBtn) toggleBtn.classList.add('open');
    }
  });

  setupCursorHover();
}

function renderProjectsListItems(projectsList, categoryId) {
  if (!projectsList || projectsList.length === 0) {
    return '<div style="text-align: center; color: var(--text-muted); padding: 15px;">No projects in this category</div>';
  }

  return projectsList.map((proj) => {
    const thumbUrl = proj.preview_url || proj.media_url;
    const isHidden = proj.is_hidden ? true : false;
    return `
      <div class="admin-project-item ${isHidden ? 'project-hidden' : ''}" data-project-id="${proj.id}" data-category-id="${categoryId}" style="${isHidden ? 'opacity: 0.5;' : ''}">
        <input type="checkbox" class="project-checkbox" data-project-id="${proj.id}" onclick="event.stopPropagation(); toggleProjectSelection(${proj.id})" style="margin-right: 10px; width: 18px; height: 18px; accent-color: var(--cyan); cursor: pointer;">
        <div class="admin-project-thumb">
          ${thumbUrl ? `<img src="${thumbUrl}" alt="${proj.title}">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.7rem;">No image</div>'}
        </div>
        <div class="admin-project-details">
          <h4>${proj.title}${isHidden ? ' <span style="font-size:0.7rem; color:#ff6b6b; background:rgba(255,107,107,0.15); padding:2px 8px; border-radius:10px; margin-left:8px;">Hidden</span>' : ''}</h4>
          <p>${proj.content_type}</p>
          <span class="admin-project-type">${proj.content_type}</span>
        </div>
        <div class="admin-project-actions">
          <button class="admin-btn-small" onclick="event.stopPropagation(); editProject(${proj.id}, ${categoryId})">Edit</button>
          <button class="admin-btn-small delete" onclick="event.stopPropagation(); deleteProject(${proj.id}, ${categoryId})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

async function editCategory(id) {
  const category = categories.find((c) => c.id === id);
  if (!category) return;

  document.getElementById('catName').value = category.name;
  document.getElementById('catDescription').value = category.description || '';
  document.getElementById('catImageName').textContent = category.preview_image ? 'Image uploaded' : 'Click to upload preview image';

  editingCategoryId = id;
  document.getElementById('cancelCatForm').style.display = 'block';
  document.querySelector('#categoryForm button[type="submit"]').textContent = 'Update Category';

  document.getElementById('categoryForm').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditCategory() {
  document.getElementById('categoryForm').reset();
  editingCategoryId = null;
  document.getElementById('cancelCatForm').style.display = 'none';
  document.querySelector('#categoryForm button[type="submit"]').textContent = 'Add Category';
  document.getElementById('catImageName').textContent = 'Click to upload preview image';
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category? This will delete all projects and uploaded media under this category.')) return;

  try {
    const response = await apiCall(`/api/admin/categories/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete category');

    showMessage('categoriesMessage', 'Category deleted successfully!', 'success');
    
    // Remove from DOM directly to avoid UI jitter
    const catElement = document.querySelector(`.admin-category-accordion[data-category-id="${id}"]`);
    if (catElement) {
      catElement.remove();
    }
    categories = categories.filter(c => c.id !== id);
    delete categoryProjectsMap[id];
  } catch (err) {
    showMessage('categoriesMessage', err.message, 'error');
  }
}


// ============ PROJECTS ============
function toggleCategoryAccordion(categoryId) {
  const projectsDiv = document.getElementById(`category-projects-${categoryId}`);
  const toggleBtn = document.querySelector(`[data-category-id="${categoryId}"] .admin-category-toggle`);
  
  if (projectsDiv) {
    projectsDiv.classList.toggle('open');
    if (toggleBtn) {
      toggleBtn.classList.toggle('open');
    }
  }
}

async function saveProjectOrder(categoryId, skipReload = false) {
  const projectsList = document.getElementById(`projects-list-${categoryId}`);
  if (!projectsList) return;
  
  const projectItems = projectsList.querySelectorAll('.admin-project-item');
  const newOrder = Array.from(projectItems).map(item => parseInt(item.dataset.projectId));
  
  try {
    const response = await apiCall('/api/admin/projects/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, project_ids: newOrder })
    });
    
    if (!response.ok) throw new Error('Failed to save order');
    
    // Reload categories to reflect new order unless skipped
    if (!skipReload) {
      loadCategories();
    }
  } catch (err) {
    console.error('Error saving project order:', err);
  }
}

async function handleProjectSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const mediaType = formData.get('media_type');
  const mediaUrl = formData.get('media_url');
  const mediaFile = document.getElementById('projMedia').files[0];
  const thumbnailFile = document.getElementById('projThumbnail').files[0];

  // Auto-detect content type from file
  let contentType = 'link';
  if (mediaType === 'upload' && mediaFile) {
    if (mediaFile.type.startsWith('video/')) {
      contentType = 'video';
    } else if (mediaFile.type.startsWith('image/')) {
      contentType = 'image';
    } else {
      // Fallback based on file extension
      const ext = mediaFile.name.split('.').pop().toLowerCase();
      if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
        contentType = 'video';
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        contentType = 'image';
      }
    }
  }

  // Add content type to form data
  formData.append('content_type', contentType);

  // Validation
  if (!mediaFile && !mediaUrl && !editingProjectId) {
    showMessage('categoriesMessage', 'Please upload a file or provide a URL', 'error');
    return;
  }

  try {
    const url = editingProjectId ? `/api/admin/projects/${editingProjectId}` : '/api/admin/projects';
    const method = editingProjectId ? 'PUT' : 'POST';

    // Hide form and show loading state
    const formGrid = form.querySelector('.admin-form-grid');
    const formActions = form.querySelector('.admin-form-actions');
    const modalBody = document.querySelector('.admin-modal-body');
    
    formGrid.style.display = 'none';
    formActions.style.display = 'none';
    
    // Create loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.style.cssText = 'text-align: center; padding: 40px;';
    loadingDiv.innerHTML = '<div class="admin-spinner"></div><p style="margin-top: 20px; color: var(--text-muted);">Uploading project...</p>';
    modalBody.insertBefore(loadingDiv, modalBody.firstChild);

    // Use XMLHttpRequest for upload progress
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        loadingDiv.querySelector('p').textContent = `Uploading project... ${percentComplete}%`;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        showMessage('categoriesMessage', `Project ${editingProjectId ? 'updated' : 'created'} successfully!`, 'success');
        
        // Close modal and reload categories instead of refreshing page
        closeProjectModal();
        loadCategories();
      } else {
        const data = JSON.parse(xhr.responseText);
        showMessage('categoriesMessage', data.error || 'Failed to save project', 'error');
        
        // Restore form on error
        loadingDiv.remove();
        formGrid.style.display = 'grid';
        formActions.style.display = 'flex';
      }
    });

    xhr.addEventListener('error', () => {
      showMessage('categoriesMessage', 'Failed to save project', 'error');
      
      // Restore form on error
      loadingDiv.remove();
      formGrid.style.display = 'grid';
      formActions.style.display = 'flex';
    });

    xhr.open(method, url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  } catch (err) {
    showMessage('categoriesMessage', err.message, 'error');
  }
}

function openProjectModal(categoryId = null) {
  const modal = document.getElementById('projectModal');
  const modalTitle = document.getElementById('modalTitle');
  
  modalTitle.textContent = 'Add New Project';
  document.querySelector('#projectForm button[type="submit"]').textContent = 'Add Project';
  
  // Reset form
  document.getElementById('projectForm').reset();
  editingProjectId = null;
  document.getElementById('projMediaUploadWrapper').style.display = 'block';
  document.getElementById('projThumbnailUploadWrapper').style.display = 'block';
  document.getElementById('projMediaUrlWrapper').style.display = 'none';
  document.getElementById('projMediaName').textContent = 'Click to upload media file';
  document.getElementById('projThumbnailName').textContent = 'Click to upload custom thumbnail (optional)';
  
  // Reset radio button to upload
  document.querySelector('input[name="media_type"][value="upload"]').checked = true;
  
  // Set category_id if provided
  if (categoryId) {
    document.getElementById('projCategoryId').value = categoryId;
  }
  
  modal.classList.add('show');
  
  // Setup cursor hover for modal elements
  setupCursorHover();
}

function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  modal.classList.remove('show');
  document.getElementById('projectForm').reset();
  editingProjectId = null;
  document.getElementById('modalTitle').textContent = 'Add New Project';
  document.querySelector('#projectForm button[type="submit"]').textContent = 'Add Project';
}

async function editProject(id, categoryId) {
  const catProjects = categoryProjectsMap[categoryId] || [];
  const project = catProjects.find((p) => p.id === id);
  if (!project) return;

  const modal = document.getElementById('projectModal');
  const modalTitle = document.getElementById('modalTitle');
  
  modalTitle.textContent = 'Edit Project';
  document.querySelector('#projectForm button[type="submit"]').textContent = 'Update Project';
  
  document.getElementById('projTitle').value = project.title;
  document.getElementById('projDescription').value = project.description || '';
  document.getElementById('projCategoryId').value = project.category_id;

  if (project.content_type === 'link') {
    document.querySelector('input[name="media_type"][value="link"]').checked = true;
    document.getElementById('projMediaUploadWrapper').style.display = 'none';
    document.getElementById('projThumbnailUploadWrapper').style.display = 'none';
    document.getElementById('projMediaUrlWrapper').style.display = 'block';
    document.getElementById('projMediaUrl').value = project.media_url;
  } else {
    document.querySelector('input[name="media_type"][value="upload"]').checked = true;
    document.getElementById('projMediaUploadWrapper').style.display = 'block';
    document.getElementById('projThumbnailUploadWrapper').style.display = 'block';
    document.getElementById('projMediaUrlWrapper').style.display = 'none';
    document.getElementById('projMediaName').textContent = project.media_url || 'Click to upload media file';
  }

  editingProjectId = id;
  modal.classList.add('show');
  
  // Setup cursor hover for modal elements
  setupCursorHover();
}

async function deleteProject(id, categoryId) {
  if (!confirm('Are you sure you want to delete this project? This will permanently delete the uploaded file from the server.')) return;

  try {
    const response = await apiCall(`/api/admin/projects/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete project');

    showMessage('categoriesMessage', 'Project deleted successfully!', 'success');
    
    // Remove from DOM directly to avoid UI jitter
    const projectItem = document.querySelector(`.admin-project-item[data-project-id="${id}"]`);
    if (projectItem) {
      projectItem.remove();
    }
    
    // Update count in category header
    const catProjects = categoryProjectsMap[categoryId] || [];
    const index = catProjects.findIndex(p => p.id === id);
    if (index > -1) {
      catProjects.splice(index, 1);
    }
    
    const catHeaderDesc = document.querySelector(`[data-category-id="${categoryId}"] .admin-category-info p`);
    if (catHeaderDesc) {
      const cat = categories.find(c => c.id === categoryId);
      if (cat) {
        catHeaderDesc.textContent = `${cat.description || 'No description'} • ${catProjects.length} project${catProjects.length !== 1 ? 's' : ''}`;
      }
    }
  } catch (err) {
    showMessage('categoriesMessage', err.message, 'error');
  }
}


// ============ CONTACT MESSAGES ============
async function loadMessages() {
  try {
    const response = await apiCall('/api/admin/messages');

    if (!response.ok) throw new Error('Failed to load messages');

    messages = await response.json();
    renderMessagesList();
  } catch (err) {
    console.error('Error loading messages:', err);
    showMessage('messagesMessage', err.message, 'error');
  }
}

function renderMessagesList() {
  const list = document.getElementById('messagesList');

  if (messages.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No messages received yet</div>';
    return;
  }

  list.innerHTML = messages.map((msg) => {
    const dateStr = new Date(msg.created_at).toLocaleString();
    return `
      <div class="admin-item-card" style="align-items: flex-start; flex-direction: column; gap: 10px;">
        <div class="admin-item-info" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px;">
            <h3>${msg.name} (${msg.email})</h3>
            <span style="color: var(--cyan-light); font-size: 11px;">${dateStr}</span>
          </div>
          <p><strong>Subject:</strong> ${msg.subject || 'No Subject'}</p>
          <p style="white-space: pre-wrap; background: var(--bg-3); padding: 12px; border-radius: 8px; border: 1px solid var(--border); margin-top: 8px; color: var(--text); line-height: 1.5;">${msg.message}</p>
        </div>
        <div class="admin-item-actions" style="align-self: flex-end; margin-top: 5px;">
          <button class="admin-btn-small delete" onclick="deleteMessage(${msg.id})">Delete Message</button>
        </div>
      </div>
    `;
  }).join('');

  setupCursorHover();
}

async function deleteMessage(id) {
  if (!confirm('Are you sure you want to delete this message?')) return;

  try {
    const response = await apiCall(`/api/admin/messages/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete message');

    showMessage('messagesMessage', 'Message deleted successfully!', 'success');
    loadMessages();
  } catch (err) {
    showMessage('messagesMessage', err.message, 'error');
  }
}

// ============ SETTINGS (USERNAME & PASSWORD CHANGE) ============
async function handlePasswordChange(e) {
  e.preventDefault();

  const newUsername = document.getElementById('settingsUsername').value.trim();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword) {
    showMessage('settingsMessage', 'Current password is required to update credentials.', 'error');
    return;
  }

  if (newPassword && newPassword !== confirmPassword) {
    showMessage('settingsMessage', 'New passwords do not match!', 'error');
    return;
  }

  if (!newUsername && !newPassword) {
    showMessage('settingsMessage', 'Enter a new username or new password to update.', 'error');
    return;
  }

  try {
    const response = await apiCall('/api/admin/change-credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword, newPassword, newUsername })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update credentials');
    }

    showMessage('settingsMessage', 'Credentials updated successfully! Please re-login.', 'success');
    document.getElementById('settingsForm').reset();

    setTimeout(() => {
      handleLogout();
    }, 2000);
  } catch (err) {
    showMessage('settingsMessage', err.message, 'error');
  }
}

// ============ HELPERS ============
function handleMediaTypeChange(e) {
  const mediaType = e.target.value;
  const uploadWrapper = document.getElementById('projMediaUploadWrapper');
  const thumbnailWrapper = document.getElementById('projThumbnailUploadWrapper');
  const urlWrapper = document.getElementById('projMediaUrlWrapper');

  if (mediaType === 'link') {
    uploadWrapper.style.display = 'none';
    thumbnailWrapper.style.display = 'none';
    urlWrapper.style.display = 'block';
  } else {
    uploadWrapper.style.display = 'block';
    thumbnailWrapper.style.display = 'block';
    urlWrapper.style.display = 'none';
  }
}

function updateFileName(e) {
  const input = e.target;
  const label = input.previousElementSibling;
  if (input.files.length > 0) {
    label.querySelector('span').textContent = input.files[0].name;
  }
}

function showMessage(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'admin-message show ' + type;
  setTimeout(() => {
    el.classList.remove('show');
  }, 5000);
}

// ============ BACKUP / RESTORE ============
async function downloadDatabase() {
  try {
    const response = await fetch('/api/admin/backup/db', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to download database');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'portfolio.db';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
}

async function loadBackupFiles() {
  try {
    const response = await apiCall('/api/admin/backup/files');
    if (!response.ok) throw new Error('Failed to load files');
    
    const files = await response.json();
    const list = document.getElementById('backupFilesList');
    list.style.display = 'block';
    
    if (files.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No files found in uploads directory.</p>';
      return;
    }
    
    list.innerHTML = files.map(file => `
      <div class="admin-item-card" style="margin-bottom: 10px;">
        <div class="admin-item-info">
          <p>${file}</p>
        </div>
        <div class="admin-item-actions">
          <a href="/uploads/${file}" download="${file}" class="admin-btn-small" style="text-decoration: none; text-align: center;">Download</a>
        </div>
      </div>
    `).join('');
  } catch (err) {
    alert(err.message);
  }
}

const restoreDbForm = document.getElementById('restoreDbForm');
if (restoreDbForm) {
  restoreDbForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    try {
      const response = await apiCall('/api/admin/restore/db', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Restore failed');
      
      showMessage('restoreDbMessage', data.message, 'success');
      e.target.reset();
      document.getElementById('restoreDbFileName').textContent = 'Click to select portfolio.db';
      
      setTimeout(() => {
        loadCategories();
        loadMessages();
      }, 2000);
    } catch (err) {
      showMessage('restoreDbMessage', err.message, 'error');
    }
  });
}

const restoreDbFile = document.getElementById('restoreDbFile');
if (restoreDbFile) {
  restoreDbFile.addEventListener('change', (e) => {
    document.getElementById('restoreDbFileName').textContent = e.target.files[0]?.name || 'Click to select portfolio.db';
  });
}

async function checkMissingFiles() {
  try {
    const response = await apiCall('/api/admin/restore/missing-files');
    if (!response.ok) throw new Error('Failed to check missing files');
    
    const data = await response.json();
    const missing = data.missing || [];
    const list = document.getElementById('missingFilesList');
    list.style.display = 'block';
    
    if (missing.length === 0) {
      list.innerHTML = '<p style="color: var(--cyan); text-align: center;">No missing files! All database records match local files.</p>';
      return;
    }
    
    list.innerHTML = missing.map((file, i) => `
      <div class="admin-item-card" style="margin-bottom: 10px;" id="missing-file-${i}">
        <div class="admin-item-info">
          <p><strong>Missing:</strong> ${file}</p>
        </div>
        <div class="admin-item-actions" style="display: flex; gap: 10px; align-items: center;">
          <input type="file" id="upload-missing-${i}" style="display: none;" onchange="uploadMissingFile(event, '${file}', ${i})">
          <button class="admin-btn-small" onclick="document.getElementById('upload-missing-${i}').click()">Upload File</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    alert(err.message);
  }
}

async function uploadMissingFile(e, targetFilename, index) {
  const file = e.target.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target_filename', targetFilename);
  
  try {
    const response = await apiCall('/api/admin/restore/file', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Upload failed');
    }
    
    const card = document.getElementById(`missing-file-${index}`);
    if (card) {
      card.innerHTML = `<p style="color: var(--cyan); width: 100%; text-align: center;">Successfully restored: ${targetFilename}</p>`;
      setTimeout(() => card.remove(), 3000);
    }
  } catch (err) {
    alert(err.message);
  }
}

// ============ ADVANCED ADMIN FEATURES ============

// --- Bulk Selection ---
let selectedProjectIds = new Set();

function toggleProjectSelection(projectId) {
  if (selectedProjectIds.has(projectId)) {
    selectedProjectIds.delete(projectId);
  } else {
    selectedProjectIds.add(projectId);
  }
  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bar = document.getElementById('bulkActionsBar');
  const count = document.getElementById('bulkSelectionCount');
  if (selectedProjectIds.size > 0) {
    bar.style.display = 'flex';
    count.textContent = `${selectedProjectIds.size} selected`;
  } else {
    bar.style.display = 'none';
  }
}

function clearBulkSelection() {
  selectedProjectIds.clear();
  document.querySelectorAll('.project-checkbox').forEach(cb => cb.checked = false);
  updateBulkActionsBar();
}

async function bulkDeleteSelected() {
  if (selectedProjectIds.size === 0) return;
  if (!confirm(`Are you sure you want to delete ${selectedProjectIds.size} project(s)? This cannot be undone.`)) return;
  
  try {
    const response = await apiCall('/api/admin/projects/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedProjectIds) })
    });
    
    if (!response.ok) throw new Error('Bulk delete failed');
    
    // Remove from DOM
    selectedProjectIds.forEach(id => {
      const el = document.querySelector(`.admin-project-item[data-project-id="${id}"]`);
      if (el) el.remove();
    });
    
    showMessage('categoriesMessage', `${selectedProjectIds.size} project(s) deleted.`, 'success');
    selectedProjectIds.clear();
    updateBulkActionsBar();
    loadCategories();
  } catch (err) {
    showMessage('categoriesMessage', err.message, 'error');
  }
}

// --- Admin Context Menu ---
let contextMenuTargetProjectId = null;
let contextMenuTargetCategoryId = null;

document.addEventListener('DOMContentLoaded', () => {
  const adminCtxMenu = document.getElementById('adminContextMenu');
  if (!adminCtxMenu) return;

  // Listen for right-click on project items
  document.addEventListener('contextmenu', (e) => {
    const projectItem = e.target.closest('.admin-project-item');
    if (projectItem) {
      e.preventDefault();
      e.stopPropagation();
      
      contextMenuTargetProjectId = parseInt(projectItem.dataset.projectId);
      contextMenuTargetCategoryId = parseInt(projectItem.dataset.categoryId);
      
      // Update visibility label
      const project = findProjectById(contextMenuTargetProjectId);
      const visBtn = document.getElementById('adminCtxToggleVisibility');
      if (project && visBtn) {
        visBtn.textContent = project.is_hidden ? 'Set as Visible' : 'Set as Hidden';
      }
      
      showAdminContextMenu(e.clientX, e.clientY);
      
      // Hide the navigation context menu if it's open
      const navCtx = document.getElementById('contextMenu');
      if (navCtx) navCtx.style.display = 'none';
    }
  });

  // Hide admin context menu on click
  document.addEventListener('click', () => {
    adminCtxMenu.style.display = 'none';
  });

  // --- Context Menu Buttons ---
  document.getElementById('adminCtxDuplicate').addEventListener('click', async () => {
    adminCtxMenu.style.display = 'none';
    if (!contextMenuTargetProjectId) return;
    
    try {
      const response = await apiCall(`/api/admin/projects/${contextMenuTargetProjectId}/duplicate`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to duplicate');
      showMessage('categoriesMessage', 'Project duplicated (saved as Hidden).', 'success');
      loadCategories();
    } catch (err) {
      showMessage('categoriesMessage', err.message, 'error');
    }
  });

  document.getElementById('adminCtxCopy').addEventListener('click', () => {
    adminCtxMenu.style.display = 'none';
    if (!contextMenuTargetProjectId) return;
    
    const link = `${window.location.origin}/project/${contextMenuTargetProjectId}`;
    navigator.clipboard.writeText(link).then(() => {
      showMessage('categoriesMessage', 'Project link copied to clipboard!', 'success');
    }).catch(() => {
      showMessage('categoriesMessage', 'Failed to copy link.', 'error');
    });
  });

  document.getElementById('adminCtxMove').addEventListener('click', () => {
    adminCtxMenu.style.display = 'none';
    if (!contextMenuTargetProjectId) return;
    showMoveToCategoryDialog(contextMenuTargetProjectId, contextMenuTargetCategoryId);
  });

  document.getElementById('adminCtxToggleVisibility').addEventListener('click', async () => {
    adminCtxMenu.style.display = 'none';
    if (!contextMenuTargetProjectId) return;
    
    const project = findProjectById(contextMenuTargetProjectId);
    if (!project) return;
    
    const newHidden = !project.is_hidden;
    
    try {
      const response = await apiCall(`/api/admin/projects/${contextMenuTargetProjectId}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_hidden: newHidden })
      });
      if (!response.ok) throw new Error('Failed to toggle visibility');
      
      project.is_hidden = newHidden ? 1 : 0;
      
      // Update DOM directly
      const el = document.querySelector(`.admin-project-item[data-project-id="${contextMenuTargetProjectId}"]`);
      if (el) {
        if (newHidden) {
          el.style.opacity = '0.5';
          el.classList.add('project-hidden');
        } else {
          el.style.opacity = '1';
          el.classList.remove('project-hidden');
        }
        // Update badge in title
        const h4 = el.querySelector('h4');
        if (h4) {
          h4.innerHTML = project.title + (newHidden ? ' <span style="font-size:0.7rem; color:#ff6b6b; background:rgba(255,107,107,0.15); padding:2px 8px; border-radius:10px; margin-left:8px;">Hidden</span>' : '');
        }
      }
      
      showMessage('categoriesMessage', `Project is now ${newHidden ? 'hidden' : 'visible'}.`, 'success');
    } catch (err) {
      showMessage('categoriesMessage', err.message, 'error');
    }
  });

  document.getElementById('adminCtxDelete').addEventListener('click', () => {
    adminCtxMenu.style.display = 'none';
    if (!contextMenuTargetProjectId) return;
    deleteProject(contextMenuTargetProjectId, contextMenuTargetCategoryId);
  });
});

function showAdminContextMenu(x, y) {
  const menu = document.getElementById('adminContextMenu');
  menu.style.display = 'block';
  
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  
  let posX = x;
  let posY = y;
  
  if (x + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
  if (y + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;
  
  menu.style.left = posX + 'px';
  menu.style.top = posY + 'px';
}

function findProjectById(id) {
  for (const catId in categoryProjectsMap) {
    const found = categoryProjectsMap[catId].find(p => p.id === id);
    if (found) return found;
  }
  return null;
}

// --- Move to Category Dialog ---
function showMoveToCategoryDialog(projectId, currentCategoryId) {
  const otherCategories = categories.filter(c => c.id !== currentCategoryId);
  
  if (otherCategories.length === 0) {
    alert('No other categories available to move to.');
    return;
  }
  
  const options = otherCategories.map(c => `${c.id}: ${c.name}`).join('\n');
  const input = prompt(`Move project to which category?\n\n${options}\n\nEnter category ID:`);
  
  if (!input) return;
  
  const newCategoryId = parseInt(input.trim());
  if (isNaN(newCategoryId)) {
    alert('Invalid category ID.');
    return;
  }
  
  moveProject(projectId, newCategoryId);
}

async function moveProject(projectId, newCategoryId) {
  try {
    const response = await apiCall(`/api/admin/projects/${projectId}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: newCategoryId })
    });
    if (!response.ok) throw new Error('Failed to move project');
    showMessage('categoriesMessage', 'Project moved successfully!', 'success');
    loadCategories();
  } catch (err) {
    showMessage('categoriesMessage', err.message, 'error');
  }
}

// --- Reset Database ---
async function resetDatabase() {
  const confirm1 = confirm('⚠️ WARNING: This will DELETE ALL categories, projects, and messages. This cannot be undone. Continue?');
  if (!confirm1) return;
  
  const confirm2 = prompt('Type "RESET" to confirm database reset:');
  if (confirm2 !== 'RESET') {
    alert('Reset cancelled.');
    return;
  }
  
  try {
    const response = await apiCall('/api/admin/database/reset', {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to reset database');
    
    showMessage('settingsMessage', 'Database reset successfully!', 'success');
    
    setTimeout(() => {
      loadCategories();
      loadMessages();
      window.scrollTo(0, 0);
    }, 1500);
  } catch (err) {
    showMessage('settingsMessage', err.message, 'error');
  }
}
