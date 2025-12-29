# Backend Service with React App

This project provides a backend service that serves both:
1. A React application (embeddable as an iframe)
2. API endpoints that the React app can call

## Project Structure

```
lcsiteapi/
├── package.json       # Root convenience scripts
├── backend/
│   ├── server.js      # Express backend server
│   └── package.json   # Backend dependencies
├── frontend/
│   ├── src/          # React source code
│   ├── package.json  # Frontend dependencies
│   └── vite.config.js # Vite configuration
└── README.md
```

## Setup

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

   Or install separately:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Create environment file (optional):**
   ```bash
   cp .env.example .env
   ```

## Development

### Option 1: Run separately (recommended for development)

**Terminal 1 - Backend:**
```bash
npm run dev
# or: cd backend && npm run dev
```

**Terminal 2 - Frontend (with hot reload):**
```bash
npm run dev:frontend
# or: cd frontend && npm run dev
```

The frontend dev server runs on `http://localhost:5173` with API proxying to `http://localhost:3000`.

### Option 2: Run production build

1. **Build the React app:**
   ```bash
   npm run build
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

The server will serve both the React app and API endpoints on `http://localhost:3000`.

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/data` - Get sample data
- `POST /api/data` - Send data to the server

## Embedding as iframe

Once the server is running, you can embed the React app in an iframe:

```html
<iframe 
  src="http://localhost:3000" 
  width="100%" 
  height="600"
  frameborder="0">
</iframe>
```

## Adding More API Endpoints

Add new routes in `backend/server.js` before the static file serving middleware:

```javascript
app.get('/api/your-endpoint', (req, res) => {
  res.json({ message: 'Your response' });
});
```

## Notes

- API routes must be defined before the static file middleware
- The catch-all route (`app.get('*')`) serves the React app for non-API routes
- CORS is enabled, so the API can be called from different origins if needed
- In production, make sure to build the React app before starting the server

