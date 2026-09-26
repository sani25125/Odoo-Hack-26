# StockSense

StockSense is a React, Express, and PostgreSQL inventory management system.

## Foundation

The repository currently contains the application foundation:

- React and Vite frontend
- Express REST backend
- PostgreSQL connection pool
- Configurable environment variables
- API health check
- Central error-handling and validation structure
- Repository and service structure
- Basic frontend shell and routes

Inventory business modules are intentionally not implemented yet.

## Run Locally

Install dependencies:

    npm run install:all

Copy backend/.env.example to backend/.env and set DATABASE_URL for the local PostgreSQL database.

Start the backend:

    npm run dev:backend

Start the frontend in a second terminal:

    npm run dev:frontend

Backend health endpoint:

    http://localhost:4000/api/v1/health

Frontend:

    http://localhost:5173
