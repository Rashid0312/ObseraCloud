# SkyView 🔭

**Multi-Tenant Observability Platform**

A modern, cloud-native observability platform for logs, metrics, and traces with a premium UI.

![Premium Silver Theme](https://img.shields.io/badge/Theme-Premium%20Silver-silver)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue)
![Flask](https://img.shields.io/badge/Backend-Flask%20%2B%20Python-green)
![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-blue)

---

## ✨ Features

### 📊 Observability
- **Logs** - Real-time log viewing with level filtering (INFO, WARN, ERROR)
- **Metrics** - Interactive charts with Recharts visualization
- **Traces** - Distributed trace tracking with timing breakdown

### 🔐 Security
- **Rate Limiting** - 5/min login, 100/min API endpoints
- **JWT Authentication** - 24-hour session tokens
- **Security Headers** - XSS, clickjacking, MIME-sniffing protection
- **Input Validation** - SQL injection & XSS prevention
- **API Key Auth** - Ready for data ingestion endpoints

### 🎨 UI/UX
- **Premium Silver Theme** - Dark/light mode toggle
- **Responsive Design** - Works on desktop and mobile
- **Landing Page** - Beautiful marketing-style homepage
- **Session Persistence** - Stay logged in across browser restarts

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)

### Run with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/SkyView.git
cd SkyView

# Start all services
docker-compose up -d

# Access the app
open http://localhost:3001
```

### Demo Credentials
| Tenant ID | Password |
|-----------|----------|
| `acme` | `demo123` |
| `globex` | `demo123` |
| `initech` | `demo123` |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │
│   (React)       │     │   (Flask)       │
│   Port: 3001    │     │   Port: 5001    │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Loki          │     │   Postgres      │     │   Tempo         │
│   (Logs/Metrics)│     │   (Tenants)     │     │   (Traces)      │
│   Port: 3100    │     │   Port: 5432    │     │   Port: 3200    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 📁 Project Structure

```
SkyView/
├── frontend/                 # React + TypeScript UI
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── contexts/         # React contexts (Theme)
│   │   └── index.css         # Global styles
│   └── Dockerfile
├── backend/                  # Flask API
│   ├── app.py               # Main application
│   └── Dockerfile
├── loki/                     # Loki configuration
├── continuous_generator.py   # Demo data generator
└── docker-compose.yml        # Container orchestration
```

---

## 🔧 API Endpoints

### Authentication
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/api/auth/login` | Authenticate tenant | 5/min |
| POST | `/api/auth/register` | Register new tenant | 5/min |

### Data Queries
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/api/logs` | Query logs | 100/min |
| GET | `/api/metrics` | Query metrics | 100/min |
| GET | `/api/traces` | Query traces | 100/min |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

---

## 🔐 Security Features

### Response Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Cache-Control: no-store, no-cache, must-revalidate
```

### JWT Token (returned on login)
```json
{
  "tenant_id": "acme",
  "token": "eyJhbG...",
  "expires_in": 86400,
  "api_key": "sk_..."
}
```

---

## 🧪 Testing Security

```bash
# Test rate limiting (6th request should fail)
for i in {1..6}; do curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "acme", "password": "demo123"}' | head -1; done

# Test security headers
curl -I http://localhost:5001/health

# Test input validation (should reject)
curl -s "http://localhost:5001/api/logs?tenant_id=<script>alert(1)</script>"
```

---

## 📈 Demo Data Generator

Generate continuous demo data:

```bash
python3 continuous_generator.py
```

Generates:
- 📊 Logs (3 per cycle)
- 📈 Metrics (1 per cycle)
- 🔗 Traces (1 per 2 cycles)

---

## 🛠️ Development

### Frontend
```bash
cd frontend
npm install
npm run dev     # Development server
npm run build   # Production build
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py   # Development server
```

---

## 📝 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Built with ❤️ using React, Flask, and Loki**
