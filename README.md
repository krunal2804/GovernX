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
```
GovernX/
├── backend/                  # Express.js API & PostgreSQL database config
│   ├── src/routes/           # API endpoints
│   ├── src/database/         # Knex migrations and seeds
│   └── Dockerfile
├── frontend/                 # React & Vite Single Page App
│   ├── src/components/       # Reusable UI components
│   ├── src/pages/            # Main application views
│   └── Dockerfile
└── docker-compose.yml        # Multi-container orchestration
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
