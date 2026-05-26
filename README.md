# GovernX — Project Governance Platform

![GovernX Banner](https://via.placeholder.com/1200x300?text=GovernX+-+Project+Governance+Platform)

**GovernX** is a comprehensive, full-stack project governance and management platform specifically tailored for consulting companies. It empowers teams to track complex engagements, manage resources, establish client commitments, and streamline project workflows from inception to delivery.

## 🎯 Purpose and Vision

In fast-paced consulting environments, tracking the lifecycle of an engagement—from the high-level services and "commitments" down to individual tasks—is challenging. **GovernX** bridges the gap between high-level client management and low-level task execution. 

Key objectives of the platform:
- **Centralized Governance:** Provide a single source of truth for all Assignments, Projects, and Tasks.
- **Role-Based Access Control (RBAC):** Deliver tailored experiences for different stakeholders. Partners can see firm-wide metrics; Managers can allocate resources; Consultants focus on their daily tasks; and Clients get transparency into project health.
- **Commitment Tracking:** Allow project managers to define hard client commitments (deliverables) and map them directly to underlying tasks, ensuring expectations are always met.
- **Secure & Scalable:** Built with modern web technologies, Dockerized for easy deployment, and secured with JWT authentication and strict CORS policies.

## 🏗️ Architecture & Tech Stack

GovernX is divided into a robust REST API backend and a dynamic Single Page Application (SPA) frontend.

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (with Knex.js as the query builder and migration tool)
- **Frontend:** React (Bootstrapped with Vite), React Router
- **Styling:** Custom CSS with modern UI/UX principles, powered by CSS variables and responsive design.
- **Authentication:** JSON Web Tokens (JWT)
- **Containerization:** Docker & Docker Compose (Nginx for frontend routing and proxying)

---

## 📂 Project Structure

```text
GovernX/
├── backend/                  # Express.js + PostgreSQL API
│   ├── src/
│   │   ├── server.js         # Express application entry point
│   │   ├── middleware/       # JWT auth & RBAC enforcement
│   │   ├── routes/           # API endpoints (Auth, Projects, Tasks, Users, etc.)
│   │   └── database/
│   │       ├── db.js         # Knex database connection
│   │       ├── migrations/   # Database schema definitions
│   │       └── seeds/        # Initial data (Roles, Permissions, Services)
│   ├── Dockerfile            # Backend container definition
│   └── knexfile.js           # Knex configuration (dev/prod)
│
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx           # App routing and layout configuration
│   │   ├── api.js            # Axios client with request interceptors
│   │   ├── components/       # Reusable UI components (Sidebar, Cards, etc.)
│   │   ├── context/          # React Context (AuthContext)
│   │   └── pages/            # Application views (Dashboard, Login, Assignments)
│   ├── Dockerfile            # Frontend container definition
│   └── nginx.conf            # Nginx config for production routing
│
├── docker-compose.yml        # Multi-container orchestration
└── README.md                 # You are here
```

---

## 👥 Roles & Capabilities

GovernX operates on a strict permission model based on the user's role:

- **Admin/Partner:** Full access to view and manage all assignments, resources, and company-wide settings.
- **Manager:** Can create assignments, allocate users to projects, define client commitments, and oversee task execution.
- **Senior:** Can break down projects into tasks, estimate effort, and oversee Consultant output.
- **Consultant:** Can view assigned tasks, update task statuses (Not Started → In Progress → Completed), and log time.
- **Client:** Has a restricted "Client Portal" view to see the health of their purchased services, track deliverables, and view shared documents securely.

*(Note: Public registration is intentionally disabled to ensure platform security. New users must be provisioned by an Administrator or via the Organization Client creation flow.)*

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running locally

### 1. Database & Backend Setup
```bash
cd backend
# 1. Install dependencies
npm install

# 2. Configure Environment Variables
cp .env.example .env
# Edit the .env file with your local PostgreSQL credentials and set a secure JWT_SECRET

# 3. Setup the Database
npm run migrate    # Generates the required database schema
npm run seed       # Populates default Roles, Permissions, and Services

# 4. Start the Development Server
npm run dev        # API will start on http://localhost:3000
```

### 2. Frontend Setup
```bash
cd frontend
# 1. Install dependencies
npm install

# 2. Start the Vite Development Server
npm run dev        # UI will start on http://localhost:5173
```

### 3. Open the Application
Navigate to `http://localhost:5173`. Log in using the seeded Admin credentials (or create a new user directly in the database if testing from scratch).

---

## 🐳 Docker Deployment (Production)

GovernX is fully containerized and production-ready using Docker Compose.

1. Ensure Docker and Docker Compose are installed on your server.
2. Configure your `.env` variables at the root level or directly in the compose file.
3. Build and launch the containers:

```bash
docker-compose up -d --build
```

**Post-deployment Database Setup:**
Because this is a production environment, database seeding is intentionally prevented from running automatically to avoid overwriting live data. On your first deployment, run:

```bash
# Run migrations inside the backend container
docker exec -it faber_backend npm run migrate

# (Optional) Run seeds for initial roles
docker exec -it faber_backend npm run seed
```

The application will be accessible via **Nginx** on port `80` (or whichever port you expose).

---

## 🤝 Contributing & Maintenance

- **Code Style:** Ensure consistent formatting.
- **Database Changes:** Any structural changes must be done via Knex migrations (`npx knex migrate:make migration_name`).
- **Security:** Do not expose `JWT_SECRET` or database credentials in source control. Always rely on the `.env` file.

---
*Built to bring order, transparency, and accountability to complex consulting engagements.*
