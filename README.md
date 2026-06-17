# Portfolio Admin Panel - Setup Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - The `.env` file is already created with defaults
   - Default admin username: `admin`
   - Default admin password: Use the bcrypt hash provided in `.env`

3. **Generate a new admin password hash (Optional):**
   If you want to change the admin password, generate a bcrypt hash:
   
   ```bash
   node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your_password', 10))"
   ```
   
   Then replace the `ADMIN_PASSWORD_HASH` value in `.env` with the generated hash.

4. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Accessing the Application

- **Homepage:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin
- **Default Credentials:**
  - Username: `admin`
  - Password: `admin` (default - see `.env` file)

## Features

### Admin Panel (`/admin`)
- **Secure Login** with JWT authentication
- **Categories Management:**
  - Create new categories with preview images
  - Edit existing categories
  - Delete categories
  
- **Projects Management:**
  - Create projects with title, description, and media
  - Support for:
    - Image uploads
    - Video uploads
    - External links
  - Edit and delete existing projects
  - Set display order for projects

### Public Portfolio
- **Homepage:** Shows all categories as cards with preview images
- **Category Pages:** Click a category to see all projects in that category
- **Project Details:** View full project details with media (images/videos with professional Plyr player, or external links)

## File Structure

```
portfolio-web/
├── server.js                 # Express server
├── package.json
├── .env                      # Environment variables
├── db/
│   └── database.js          # SQLite database setup & helpers
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── routes/
│   ├── auth.js              # Authentication endpoints
│   ├── admin.js             # Admin CRUD endpoints
│   └── public.js            # Public API endpoints
├── public/
│   ├── uploads/             # Uploaded images/videos
│   ├── js/
│   │   └── admin.js         # Admin panel JavaScript
│   ├── style.css            # Main stylesheet
│   └── script.js            # Homepage JavaScript
├── views/
│   ├── admin.html           # Admin panel
│   ├── category.html        # Category detail page
│   └── project.html         # Project detail page (optional)
├── index.html               # Homepage
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password

### Public (No Auth Required)
- `GET /api/categories` - Get all categories with preview images
- `GET /api/categories/:id` - Get category details
- `GET /api/categories/:id/projects` - Get all projects in a category
- `GET /api/projects/:id` - Get project details

### Admin (Requires JWT Token)
- `GET /api/admin/categories` - List all categories
- `POST /api/admin/categories` - Create category (with image upload)
- `PUT /api/admin/categories/:id` - Update category
- `DELETE /api/admin/categories/:id` - Delete category
- `GET /api/admin/projects` - List all projects
- `POST /api/admin/projects` - Create project (with media upload)
- `PUT /api/admin/projects/:id` - Update project
- `DELETE /api/admin/projects/:id` - Delete project

## Database Schema

### categories table
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT UNIQUE)
- `description` (TEXT)
- `preview_image` (TEXT - file path)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### projects table
- `id` (INTEGER PRIMARY KEY)
- `category_id` (INTEGER FOREIGN KEY)
- `title` (TEXT)
- `description` (TEXT)
- `content_type` (TEXT - 'image', 'video', or 'link')
- `media_url` (TEXT - file path or external URL)
- `display_order` (INTEGER)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

## Default Categories

The following categories are automatically created on first run:
1. Graphic Design
2. Video Editing
3. Web Design
4. Poster Design

## Features & Technologies

- **Backend:** Node.js + Express.js
- **Database:** SQLite3
- **Authentication:** JWT (JSON Web Tokens)
- **File Upload:** Multer (100MB limit)
- **Password Hashing:** bcryptjs
- **Video Player:** Plyr.js (professional video controls)
- **Frontend:** Vanilla JavaScript (no frameworks)

## Security Notes

⚠️ **Important:**
- Change the default admin password in `.env` for production
- Set a strong `JWT_SECRET` in `.env`
- Use HTTPS in production
- Store `.env` securely (never commit it to version control)

## Troubleshooting

**Database won't connect:**
- Check if `db/` directory exists
- Ensure `sqlite3` package is properly installed
- Delete `portfolio.db` and restart to reinitialize

**Uploads not saving:**
- Check `public/uploads/` directory permissions
- Ensure the directory exists
- Verify file size is under 100MB limit

**Admin login fails:**
- Verify username is "admin"
- Check the password hash in `.env`
- Clear browser localStorage and try again

**Categories not showing on homepage:**
- Open browser DevTools and check console for errors
- Ensure server is running on port 3000
- Check that API endpoint `/api/categories` returns data

## Next Steps / Future Enhancements

- Add project gallery support (multiple images per project)
- Add user profile customization
- Add email notifications
- Add analytics dashboard
- Add backup/export functionality
- Add multi-user support with role-based access

---

For issues or questions, check the console logs and API responses using browser DevTools.
