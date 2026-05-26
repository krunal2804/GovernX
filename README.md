# GovernX

**GovernX** is a full-stack project governance platform tailored for consulting companies. It bridges the gap between high-level client management and low-level task execution by providing a single source of truth for assignments, resource allocation, and client deliverables.

### Tech Stack
- **Backend:** Node.js, Express, PostgreSQL, Knex.js
- **Frontend:** React, Vite
- **Deployment:** Docker & Docker Compose

### Features
- **Role-Based Access Control:** Distinct roles and dashboards for Partners, Managers, Seniors, Consultants, and Clients.
- **Client Commitments:** Track specific deliverables promised to clients and map them directly to underlying tasks.
- **Centralized Workflows:** Manage assignments from "Not Started" to "Completed" with full visibility into progress and billing.

### Project Structure
```text
GovernX/
├── backend/                  # Express.js + PostgreSQL API
│   ├── src/
│   │   ├── server.js         # Express app entry point
│   │   ├── middleware/       # JWT auth & RBAC verification
│   │   ├── routes/           # API handlers (auth, projects, tasks)
│   │   └── database/
│   │       ├── migrations/   # Knex database schemas
│   │       └── seeds/        # Initial roles and permissions
│   ├── Dockerfile            # Backend container configuration
│   └── knexfile.js           # Knex environment settings
│
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx           # React Router configuration
│   │   ├── api.js            # Axios client with interceptors
│   │   ├── context/          # Global React state (AuthContext)
│   │   ├── components/       # Shared UI components (Layout, Sidebar)
│   │   └── pages/            # View components (Dashboard, Login)
│   ├── Dockerfile            # Frontend container configuration
│   └── nginx.conf            # Nginx config for frontend routing
│
└── docker-compose.yml        # Full-stack Docker orchestration
```

### Quick Start (Local)

1. **Backend:**
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run migrate
   npm run seed
   npm run dev
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Docker Deployment
```bash
docker-compose up -d --build
# Run migrations inside the container once deployed:
docker exec -it faber_backend npm run migrate
```
