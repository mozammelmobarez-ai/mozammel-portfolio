// ===== CUSTOM CURSOR =====
const customCursor = document.getElementById('customCursor');
let isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

// Completely disable and hide on touch devices
if (isTouchDevice && customCursor) {
  customCursor.style.display = 'none';
}

// Hide custom cursor dynamically on touchstart
document.addEventListener('touchstart', () => {
  isTouchDevice = true;
  if (customCursor) customCursor.style.display = 'none';
}, { passive: true });

// Direct cursor movement without lag
document.addEventListener('mousemove', (e) => {
  if (customCursor && !isTouchDevice) {
    customCursor.style.left = e.clientX + 'px';
    customCursor.style.top = e.clientY + 'px';
  }
});

// Hover effects function (can be called dynamically when items load)
function setupCursorHover() {
  if (isTouchDevice || !customCursor) return;
  const elements = document.querySelectorAll('a, button, input, textarea, select, label, .work-card, .skill-card, .about-stat-card, .timeline-content, .project-card');
  elements.forEach(el => {
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

// Initial cursor hover setup
setupCursorHover();

// Click effect
document.addEventListener('mousedown', () => {
  if (customCursor && !isTouchDevice) customCursor.classList.add('clicking');
});

document.addEventListener('mouseup', () => {
  if (customCursor && !isTouchDevice) customCursor.classList.remove('clicking');
});

// Hide cursor when leaving window
document.addEventListener('mouseleave', () => {
  if (customCursor) customCursor.style.opacity = '0';
});

document.addEventListener('mouseenter', () => {
  if (customCursor && !isTouchDevice) customCursor.style.opacity = '1';
});

// Fullscreen support (Cursor visibility in fullscreen)
document.addEventListener('fullscreenchange', () => {
  if (customCursor) {
    const fullscreenEl = document.fullscreenElement;
    if (fullscreenEl) {
      // Check if the fullscreen element is a video or contains a video
      const hasVideo = fullscreenEl.tagName === 'VIDEO' || fullscreenEl.querySelector('video');
      if (hasVideo) {
        document.body.classList.add('video-fullscreen');
        customCursor.style.display = 'none';
      } else {
        document.body.classList.remove('video-fullscreen');
        fullscreenEl.appendChild(customCursor);
        customCursor.style.display = 'block';
        customCursor.style.zIndex = '99999999';
      }
    } else {
      document.body.classList.remove('video-fullscreen');
      document.body.appendChild(customCursor);
      if (isTouchDevice) {
        customCursor.style.display = 'none';
      } else {
        customCursor.style.display = 'block';
      }
    }
  }
});

// ===== TYPEWRITER =====
const roles = [
  'Graphic Designer',
  'Video Editor',
  'Web Designer',
  'Motion Designer',
];
let roleIndex = 0, charIndex = 0, deleting = false;
const typedEl = document.getElementById('typed-text');

function typewrite() {
  const current = roles[roleIndex];
  if (!deleting) {
    typedEl.textContent = current.slice(0, ++charIndex);
    if (charIndex === current.length) {
      deleting = true;
      setTimeout(typewrite, 1800);
      return;
    }
  } else {
    typedEl.textContent = current.slice(0, --charIndex);
    if (charIndex === 0) {
      deleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
    }
  }
  setTimeout(typewrite, deleting ? 60 : 100);
}
if (typedEl) typewrite();

// ===== NAVBAR SCROLL =====
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ===== HAMBURGER =====
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const spans = hamburger.querySelectorAll('span');
    spans[0].style.transform = navLinks.classList.contains('open') ? 'rotate(45deg) translate(5px,5px)' : '';
    spans[1].style.opacity   = navLinks.classList.contains('open') ? '0' : '1';
    spans[2].style.transform = navLinks.classList.contains('open') ? 'rotate(-45deg) translate(5px,-5px)' : '';
  });
}

// Close mobile nav on link click
if (navLinks) {
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
  }));
}

// Smooth scroll for nav links on the same page
document.querySelectorAll('a[href^="/#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    const targetId = href.substring(href.indexOf('#')); // e.g. "#about"
    const targetEl = document.querySelector(targetId);
    if (targetEl) {
      if (window.location.pathname === '/' || window.location.pathname === '/index.html' || window.location.pathname === '') {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, null, targetId);
      }
    }
  });
});

// ===== SCROLL REVEAL =====
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
reveals.forEach(el => observer.observe(el));

// ===== SMART CONTEXT MENU =====
const contextMenu = document.getElementById('contextMenu');

if (contextMenu) {
  document.addEventListener('contextmenu', (e) => {
    // Allow native right-click on inputs and textareas for copy/paste
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    e.preventDefault();

    // Check if right-clicked on a work-card (category card on main page)
    const workCard = e.target.closest('.work-card');
    // Check if right-clicked on a project-card (project card on category page)
    const projectCard = e.target.closest('.project-card');

    if (workCard) {
      const link = workCard.getAttribute('onclick');
      const match = link && link.match(/\/category\/(\d+)/);
      if (match) {
        buildCardContextMenu(match[0], workCard);
      }
    } else if (projectCard) {
      const onclick = projectCard.getAttribute('onclick');
      const match = onclick && onclick.match(/\/project\/(\d+)/);
      if (match) {
        const projTitle = projectCard.querySelector('h3')?.textContent || 'Project';
        contextMenu.innerHTML = `
          <span class="context-menu-item" style="opacity:0.5; pointer-events:none; font-size:0.75rem;">${projTitle}</span>
          <a href="${match[0]}" class="context-menu-item">View Project</a>
          <button class="context-menu-item" style="background:transparent; border:none; color:var(--text); width:100%; text-align:left; cursor:pointer;" onclick="copyToClipboard('${window.location.origin}${match[0]}')">Copy Link</button>
        `;
      }
    } else {
      // Check if we are on a project page
      const path = window.location.pathname;
      if (path.includes('/project/')) {
        contextMenu.innerHTML = `
          <a href="/" class="context-menu-item">Home</a>
          <a href="/#work" class="context-menu-item">All Projects</a>
          <button class="context-menu-item" style="background:transparent; border:none; color:var(--text); width:100%; text-align:left; cursor:pointer;" onclick="copyToClipboard(window.location.href)">Copy Project Link</button>
          <a href="/#contact" class="context-menu-item context-menu-cta">Contact Me</a>
        `;
      } else {
        // Show default navigation context menu
        buildDefaultContextMenu();
      }
    }

    showContextMenu(e.clientX, e.clientY);
  });
}

function buildDefaultContextMenu() {
  if (contextMenu) {
    contextMenu.innerHTML = `
      <a href="/#about" class="context-menu-item">About</a>
      <a href="/#skills" class="context-menu-item">Skills</a>
      <a href="/#experience" class="context-menu-item">Experience</a>
      <a href="/#work" class="context-menu-item">Projects</a>
      <a href="/#contact" class="context-menu-item context-menu-cta">Contact Me</a>
    `;
  }
}

function buildCardContextMenu(categoryPath, cardEl) {
  if (contextMenu) {
    const categoryName = cardEl.querySelector('.work-cat')?.textContent || cardEl.querySelector('h3')?.textContent || 'Category';
    contextMenu.innerHTML = `
      <span class="context-menu-item" style="opacity:0.5; pointer-events:none; font-size:0.75rem;">${categoryName}</span>
      <a href="${categoryPath}" class="context-menu-item">View Category</a>
      <button class="context-menu-item" style="background:transparent; border:none; color:var(--text); width:100%; text-align:left; cursor:pointer;" onclick="copyToClipboard('${window.location.origin}${categoryPath}')">Copy Link</button>
    `;
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {});
  if (contextMenu) contextMenu.style.display = 'none';
}

function showContextMenu(x, y) {
  if (!contextMenu) return;
  contextMenu.style.display = 'block';
  
  const menuWidth = contextMenu.offsetWidth;
  const menuHeight = contextMenu.offsetHeight;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  let posX = x;
  let posY = y;
  
  if (x + menuWidth > windowWidth) posX = windowWidth - menuWidth - 10;
  if (y + menuHeight > windowHeight) posY = windowHeight - menuHeight - 10;
  
  contextMenu.style.left = posX + 'px';
  contextMenu.style.top = posY + 'px';
}

document.addEventListener('click', (e) => {
  if (contextMenu && !contextMenu.contains(e.target)) {
    contextMenu.style.display = 'none';
  }
});

window.addEventListener('scroll', () => {
  if (contextMenu) contextMenu.style.display = 'none';
});

// ===== MARQUEE ANIMATION =====
// Icons now maintain constant size - no dynamic sizing needed

// Load Lottie animation for video editing card
function loadVideoEditingAnimation() {
  const container = document.getElementById('video-editing-animation');
  if (container && typeof lottie !== 'undefined') {
    try {
      lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'assets/animation-original (1).json'
      });
    } catch (error) {
      console.log('Lottie animation failed to load:', error);
      // Fallback: Add a placeholder or static image
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.9rem;">Video Editing</div>';
    }
  }
}

// Contact form handling
document.addEventListener('DOMContentLoaded', () => {
  loadVideoEditingAnimation();
  loadCategories();
  
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
  }
});

async function handleContactSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('contactName').value;
  const email = document.getElementById('contactEmail').value;
  const subject = document.getElementById('contactSubject').value;
  const message = document.getElementById('contactMessage').value;
  
  const statusEl = document.getElementById('contactStatus');
  statusEl.style.display = 'block';
  statusEl.className = 'contact-status';
  statusEl.textContent = 'Sending message...';
  
  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send message');
    }
    
    statusEl.className = 'contact-status success';
    statusEl.textContent = '✦ Message sent successfully! Thank you for getting in touch.';
    document.getElementById('contactForm').reset();
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  } catch (err) {
    statusEl.className = 'contact-status error';
    statusEl.textContent = '❌ Error: ' + err.message;
  }
}

// ===== LOAD CATEGORIES FROM API =====
async function loadCategories() {
  const workGrid = document.getElementById('workGrid');
  
  try {
    const response = await fetch('/api/categories');
    if (!response.ok) throw new Error('Failed to load categories');
    
    const categories = await response.json();
    
    if (categories.length === 0) {
      workGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #b0b0b0; padding: 40px;">No categories available yet.</div>';
      return;
    }

    workGrid.innerHTML = categories.map((category) => {
      const hasPreview = category.preview_image && category.preview_image.trim() !== '';
      const bgStyle = hasPreview
        ? `background-image: url('${category.preview_image}'); background-size: cover; background-position: center;`
        : `background: ${getCategoryGradient(category.name)};`;

      return `
        <div class="work-card reveal" style="cursor: pointer;" onclick="window.location.href = '/category/${category.id}'">
          <div class="work-thumb" style="${bgStyle}">
            <div class="work-overlay">
              <span class="work-cat">${category.name}</span>
            </div>
          </div>
          <div class="work-info">
            <h3>${category.name}</h3>
            <p>${category.description || 'Explore this category'}</p>
          </div>
        </div>
      `;
    }).join('');

    // Observe newly added reveal elements so IntersectionObserver can animate them
    try {
      if (typeof observer !== 'undefined' && observer && typeof observer.observe === 'function') {
        const newReveals = document.querySelectorAll('.reveal');
        newReveals.forEach(el => observer.observe(el));
      }
    } catch (e) {
      // ignore
    }

    // Re-apply ScrollReveal if available for animated entrance
    if (typeof ScrollReveal !== 'undefined') {
      setTimeout(() => {
        const reveals = document.querySelectorAll('.reveal');
        ScrollReveal().reveal(reveals, { interval: 100 });
      }, 100);
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    workGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ff6b6b; padding: 40px;">Failed to load categories. Please refresh the page.</div>';
  }
}

// Helper function to get gradient for category based on name
function getCategoryGradient(categoryName) {
  const gradients = {
    'Graphic Design': 'linear-gradient(135deg, #1e1040, #2d1b69)',
    'Video Editing': 'linear-gradient(135deg, #0c1a30, #0e3154)',
    'Web Design': 'linear-gradient(135deg, #0f1f1a, #0a3528)',
    'Poster Design': 'linear-gradient(135deg, #1a0f1e, #3b1a4a)',
  };
  return gradients[categoryName] || 'linear-gradient(135deg, #1e1040, #2d1b69)';
}
