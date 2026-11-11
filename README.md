# MeritMatrix

An AI-driven dashboard that helps teams cut developer bench time and plan project sprints more efficiently.

**Live demo:** [merit-matrix.vercel.app](https://merit-matrix.vercel.app)

---

## What it does

MeritMatrix gives engineering managers one place to see who is free, who is overloaded, and how projects are progressing.

| Page | What you can do |
|---|---|
| **Dashboard** | See an overview of projects, create a new project, add a quick task, and generate a sprint plan |
| **Projects** | Browse workstreams, filter, search and sort them, add subtasks, and tick them off |
| **Sprints** | View the team board, spot overbooked or bench members, allocate people to work, and rebalance the load |
| **Team** | Filter members by skill or score, verify credentials, inspect a sandbox, and build a squad |
| **Analytics** | View KPIs and squad details, and refresh the data |
| **Settings** | Change workspace settings, reset to defaults, and export them as JSON |

---

## Tech stack

**Frontend**
- React (Vite)
- Deployed on Vercel

**Backend**
- Java with Spring Boot (Maven)
- REST API, with request validation through Jakarta Validation
- PostgreSQL database hosted on [Neon](https://neon.tech)
- Docker, deployable to Render

---

## Project structure

```
MeritMatrix/
├── Frontend (React.js)/
│   ├── src/
│   │   ├── pages/          Dashboard, Projects, Sprints, Team, Analytics, Settings
│   │   ├── components/     Header, Sidebar, Modals, CommandPalette, CopilotWidget
│   │   └── data/           mockData.js
│   ├── index.html
│   └── package.json
│
└── Backend (Spring Boot)/
    └── meritmatrix-backend/
        ├── src/main/java/com/example/demo/
        │   ├── controller/   REST endpoints (one per page)
        │   ├── service/      Business logic
        │   └── config/       WebConfig (CORS)
        ├── src/main/resources/application.properties
        ├── Dockerfile
        ├── render.yaml
        └── pom.xml
```

Each page has its own controller and service in the backend. Controllers handle HTTP only, and the logic lives in the services.

---

## Running locally

### Prerequisites
- Node.js 18 or newer
- Java 17 or newer (use the version set in `pom.xml`)
- A PostgreSQL database (a free Neon project works)

### 1. Backend

```bash
cd "Backend (Spring Boot)/meritmatrix-backend"
```

Set the database variables, then start the app.

**macOS / Linux / Git Bash**
```bash
export SPRING_DATASOURCE_URL="jdbc:postgresql://<host>/<database>?sslmode=require"
export SPRING_DATASOURCE_USERNAME="<user>"
export SPRING_DATASOURCE_PASSWORD="<password>"
./mvnw spring-boot:run
```

**Windows PowerShell**
```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://<host>/<database>?sslmode=require"
$env:SPRING_DATASOURCE_USERNAME="<user>"
$env:SPRING_DATASOURCE_PASSWORD="<password>"
.\mvnw.cmd spring-boot:run
```

The API starts on `http://localhost:8080`.

### 2. Frontend

```bash
cd "Frontend (React.js)"
npm install
npm run dev
```

The app opens on the address Vite prints, usually `http://localhost:5173`.

> Never commit real passwords. Keep database credentials in environment variables only.

---

## API overview

All endpoints start with `/api`.

### Dashboard
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Everything the dashboard shows |
| GET | `/projects` | List projects (filter, search, sort) |
| GET | `/projects/{id}` | One project |
| POST | `/projects` | Create a project |
| POST | `/tasks/quick` | Add a quick task |
| POST | `/sprints/generate` | Generate a sprint plan |

### Projects (workstreams)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/workstreams` | List with status, search, sort and grouping |
| GET | `/workstreams/{id}` | One workstream with subtasks |
| POST | `/workstreams` | Create a workstream |
| POST | `/workstreams/tasks/quick` | Add a quick task |
| PATCH | `/workstreams/{id}/tasks/{taskId}` | Tick or untick a subtask |

### Sprints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/sprints/board` | Team board with allocations |
| POST | `/sprints/rebalance` | Rebalance workloads |
| POST | `/sprints/allocations` | Allocate a team member |
| GET | `/sprints/milestones/{id}` | Milestone details |
| GET | `/sprints/copilot/suggestion` | Copilot suggestion text |

### Team
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/team` | Members, filters and squad |
| GET | `/team/{id}/sandbox` | Inspect a member's sandbox |
| POST | `/team/verify` | Verify a credential |
| POST | `/team/match` | Find a skill match |
| GET | `/team/audit-report` | Download audit report (JSON) |
| GET | `/team/squad` | Current squad |
| PUT | `/team/squad/{id}` | Add a member to the squad |
| DELETE | `/team/squad/{id}` | Remove a member |
| DELETE | `/team/squad` | Clear the squad |

### Analytics
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/analytics` | All analytics data |
| POST | `/analytics/refresh` | Refresh the data |
| GET | `/analytics/squads/{id}` | One squad |
| GET / PUT | `/settings/tpu-usage` | Read or update the TPU cap (50 to 100) |

### Settings
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/settings` | Saved settings and options |
| PUT | `/settings` | Save changes |
| POST | `/settings/reset` | Reset to defaults |
| GET | `/settings/export` | Download settings (JSON) |

Invalid input returns `400` with a message naming each bad field.

---

## Deployment

| Part | Where | Notes |
|---|---|---|
| Frontend | Vercel | Set **Root Directory** to `Frontend (React.js)` |
| Backend | Render (Docker) | Set **Root Directory** to `Backend (Spring Boot)/meritmatrix-backend` |
| Database | Neon | Use the pooled connection host |

### Backend environment variables

| Variable | Example |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<host>/<database>?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | your database user |
| `SPRING_DATASOURCE_PASSWORD` | your database password |

### Good to know
- On Render's free plan, the service sleeps after 15 minutes without traffic, so the first request afterwards can take 30 to 60 seconds.
- Neon's free database also pauses when idle, so the first connection can be slow.
- Allow your deployed frontend URL in the CORS settings (`WebConfig.java`).

---

## Current status

The frontend pages currently show demo data from `src/data/mockData.js`. The backend endpoints above match what each page needs, and connecting the frontend to the API is the next step.

---

## Author

Built by [Isnu Gupta](https://github.com/Isnu-4837).
