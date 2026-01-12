# Prompt Rewriter Client

React client application for the Prompt Rewriter extension.

## Features

- User Registration
- User Login
- Protected Dashboard
- JWT Authentication
- Centralized API Service

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
VITE_API_URL=http://localhost:3000
```

3. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/       # Reusable components
│   └── ProtectedRoute.jsx
├── contexts/         # React contexts
│   └── AuthContext.jsx
├── pages/           # Page components
│   ├── Login.jsx
│   ├── Register.jsx
│   └── Dashboard.jsx
├── services/        # API services
│   └── api.js
├── App.jsx          # Main app component
└── main.jsx         # Entry point
```

## API Connection

The client connects to the backend server through the centralized API service in `src/services/api.js`. All API calls are automatically authenticated using JWT tokens stored in localStorage.

## Authentication Flow

1. User registers/logs in
2. JWT token is received and stored in localStorage
3. Token is automatically included in all API requests
4. Protected routes check authentication status
5. On token expiration, user is redirected to login
