<div align="center">

<img src="https://img.shields.io/badge/Flowtica-AI%20Service%20Orchestrator-6C63FF?style=for-the-badge&logoColor=white" alt="Flowtica" height="40"/>

# Flowtica 

### *AI-Orchestrated Service Marketplace for the Informal Economy*

> Connecting buyers with trusted local service providers — powered by multi-agent AI, real-time orchestration, and natural language understanding.

<br/>

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-61DAFB?style=flat-square&logo=react&logoColor=black)](https://expo.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-FF6B6B?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

<br/>

[**View Demo**](#demo) 

</div>

---

## 📖 Table of Contents

- [About The Project](#-about-the-project)
- [The Problem We Solve](#-the-problem-we-solve)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#-environment-variables)
- [Multi-Agent Workflow](#-multi-agent-workflow)
- [API Reference](#-api-reference)
- [Demo](#-demo)
- [Assumptions & Limitations](#-assumptions--limitations)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 About The Project

**Flowtica** is an agentic AI system built for the informal service economy — connecting users with local plumbers, electricians, tutors, beauticians, and other home service providers. Unlike traditional booking apps, Flowtica does not just list services; it *reasons*, *negotiates*, and *acts* autonomously.

A user can simply type (or speak):

> *"Mujhe kal subah G-13 mein AC technician chahiye"*

...and Flowtica's AI pipeline will extract intent, find the best nearby provider, simulate a booking, and schedule a follow-up reminder — all without manual intervention.

Built as a submission for **Google Antigravity Challenge 2**, this project demonstrates end-to-end agentic automation using LangGraph as the core orchestration engine.

---

## 🚨 The Problem We Solve

The informal economy operates largely through WhatsApp messages, phone calls, and word-of-mouth referrals. This leads to:

| Pain Point | Impact |
|---|---|
| No centralized discovery | Users waste time searching |
| Manual scheduling | Missed appointments, double bookings |
| No price transparency | Disputes and mistrust |
| Zero automation | Providers lose business |
| Language barriers | Non-English speakers underserved |

Flowtica addresses all of these through a single conversational interface backed by a multi-agent AI system.

---

## ✨ Key Features

### 🧠 AI-Driven Orchestration
- **Supervisor Agent** routes every request to the right specialised agent
- **Intent Extraction** parses service type, location, date, and price from natural language — in **Urdu, Roman Urdu, and English**
- **Negotiation Agent** handles counter-offers and real-time price discussions between buyers and sellers

### 📍 Location Intelligence
- Interactive `LocationPickerModal` with autocomplete and draggable map pins
- **MiniMap** integration on booking cards and provider profiles
- **Reverse geocoding** to auto-resolve coordinates into human-readable addresses

### ⚡ Real-time Everything
- Socket.IO-powered live chat between buyers and sellers
- Instant push notifications for new requests, approvals, and status changes
- Concurrent request safety via per-conversation threading locks

### 🔄 Full Service Lifecycle
- Role switching: one account can act as both **Buyer** and **Seller**
- Booking snapshots that capture provider + customer location at booking time
- Automated follow-up reminders and status confirmations

### 🔍 Semantic Provider Matching
- ChromaDB vector search matches service requests to providers by semantic similarity
- Ranking by distance, availability, and rating with transparent reasoning

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                   │
│         React Native · NativeWind · Redux              │
└───────────────────────┬────────────────────────────────┘
                        │ HTTP / Socket.IO
┌───────────────────────▼────────────────────────────────┐
│              Flask API + Flask-SocketIO                │
│                  (Python Backend)                      │
└───────────────────────┬────────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────────┐
│             LangGraph Orchestration Engine             │
│                                                        │
│  ┌─────────────┐    routes to    ┌──────────────────┐  │
│  │  Supervisor │ ──────────────► │  Intent Agent    │  │
│  │    Agent    │ ◄────────────── │  Search Agent    │  │
│  │  (Entry &   │   returns to    │  Booking Agent   │  │
│  │   Router)   │                 │  Negotiation Agt │  │
│  └─────────────┘                 │  Followup Agent  │  │
│         │                        │  Comms Agent     │  │
│         └──────────────────────► │  (→ END)         │  │
│                                  └──────────────────┘  │
└───────────────────────┬────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐    ┌──────────┐    ┌──────────┐
   │ MongoDB │    │ ChromaDB │    │ Supabase │
   │(Primary)│    │(Vectors) │    │  (Auth)  │
   └─────────┘    └──────────┘    └──────────┘
                        │
              ┌─────────┴──────────┐
              ▼                    ▼
       ┌────────────┐     ┌───────────────┐
       │ Google     │     │  OpenAI GPT   │
       │ Maps API   │     │  (LLM Brain)  │
       └────────────┘     └───────────────┘
```

### Multi-Agent Orchestration Flow

The LangGraph engine is a **state machine** where:
- The **Supervisor Agent** is the single entry point and sole routing authority
- Every specialised agent always returns control to the Supervisor after completing its task
- Only the **Communication Agent** transitions to `END`
- A per-conversation `threading.Lock` prevents duplicate Socket.IO messages from entering the workflow simultaneously

---

## 🛠 Tech Stack

### Frontend (Mobile App)

| Technology | Purpose |
|---|---|
| [Expo](https://expo.dev) (React Native) | Cross-platform mobile framework |
| Expo Router | File-based navigation |
| NativeWind (TailwindCSS) | Styling |
| Redux Toolkit | Global state management |
| React Context | Auth state |
| Supabase Auth | Email / Phone authentication |
| React Native Maps | Interactive maps |
| Google Maps API (New) | Places autocomplete & geocoding |
| Moti + Reanimated | Animations |
| Lucide React Native | Icons |

### Backend (AI & API)

| Technology | Purpose |
|---|---|
| [Flask](https://flask.palletsprojects.com) | REST API server |
| Flask-SocketIO | Real-time bidirectional events |
| [LangGraph](https://langchain-ai.github.io/langgraph/) | Stateful multi-agent orchestration |
| OpenAI GPT-4o | Intent extraction & agent reasoning |
| [ChromaDB](https://www.trychroma.com/) | Vector search for semantic provider matching |
| MongoDB | Primary database (users, providers, bookings) |
| Supabase | User authentication & JWT management |

---

## 📁 Project Structure

```
flowtica/
│
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Auth flow screens
│   ├── (tabs)/                   # Main tab navigation
│   ├── chat/                     # Real-time chat screens
│   ├── booked-services/          # Booking management
│   └── settings/                 # User settings
│
├── components/                   # Reusable UI components
│   ├── modals/                   # LocationPickerModal, etc.
│   ├── cards/                    # Booking & provider cards
│   └── ui/                       # Buttons, inputs, icons
│
├── services/                     # Frontend service layer
│   ├── api.ts                    # HTTP API client
│   ├── socket.ts                 # Socket.IO client
│   ├── location.ts               # GPS & geocoding
│   └── sound.ts                  # Notification sounds
│
├── backend/                      # Python AI engine
│   ├── agents/                   # LangGraph specialised agents
│   │   ├── supervisor.py         # Routing authority
│   │   ├── intent_agent.py       # NLP intent extraction
│   │   ├── search_agent.py       # Provider discovery
│   │   ├── booking_agent.py      # Booking simulation
│   │   ├── negotiation_agent.py  # Price negotiation
│   │   ├── followup_agent.py     # Reminders & updates
│   │   └── communication_agent.py# Final response → END
│   │
│   ├── models/                   # MongoDB data models
│   │   ├── user.py
│   │   ├── provider.py
│   │   └── booking.py
│   │
│   ├── core/                     # Core engine
│   │   ├── graph.py              # LangGraph workflow definition
│   │   ├── state.py              # Shared agent state schema
│   │   ├── vector_store.py       # ChromaDB integration
│   │   └── knowledge_base.py     # Service category data
│   │
│   ├── app.py                    # Flask entry point
│   └── requirements.txt
│
├── assets/                       # Brand assets & static files
├── .env                          # Frontend environment variables
├── backend/.env                  # Backend environment variables
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** `v18+` and **npm** / **yarn**
- **Python** `3.11+`
- **Expo CLI**: `npm install -g expo-cli`
- **MongoDB** instance (local or [MongoDB Atlas](https://cloud.mongodb.com))
- **Supabase** project ([supabase.com](https://supabase.com))
- API keys for **OpenAI** and **Google Maps (Places API New)**

---

### Backend Setup

**1. Clone the repository**
```bash
git clone https://github.com/your-username/flowtica.git
cd flowtica/backend
```

**2. Create and activate a virtual environment**
```bash
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)
```

**5. Run the Flask server**
```bash
python app.py
# Server starts at http://localhost:5000
```

---

### Frontend Setup

**1. Navigate to the root directory**
```bash
cd flowtica
```

**2. Install dependencies**
```bash
npm install
# or
yarn install
```

**3. Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your Supabase and Google Maps credentials
```

**4. Start the Expo development server**
```bash
npx expo start
```

**5. Run on device or simulator**
```bash
npx expo run:android    # Android
npx expo run:ios        # iOS (macOS only)
```

Or scan the QR code from `expo start` using the **Expo Go** app.

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
# OpenAI
OPENAI_API_KEY=sk-...

# MongoDB
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/flowtica

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-key

# App Config
FLASK_ENV=development
SESSION_EXPIRY_SECONDS=300
```

### Frontend (`.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_URL=http://localhost:5000
EXPO_PUBLIC_GOOGLE_MAPS_KEY=your-google-maps-key
```

> ⚠️ **Security Warning:** Never commit `.env` files to version control. Add them to `.gitignore` and rotate any keys that were previously exposed. See [Privacy & Security](#privacy--security) for details.

---

## 🤖 Multi-Agent Workflow

A full request goes through the following pipeline:

```
User Input (Urdu / Roman Urdu / English)
        │
        ▼
  [Intent Agent]
  Extracts: service_type, location, datetime, budget
        │
        ▼
  [Search Agent]
  Queries ChromaDB + Google Maps
  Returns: ranked provider list with distances & ratings
        │
        ▼
  [Booking Agent]
  Simulates: slot reservation, confirmation message,
             database write, booking receipt generation
        │
        ▼
  [Negotiation Agent]  ◄── (triggered if price dispute)
  Handles: counter-offers, acceptance/rejection flow
        │
        ▼
  [Follow-up Agent]
  Schedules: reminders, status updates, completion confirmation
        │
        ▼
  [Communication Agent]
  Formats final response → emits via Socket.IO → END
```

### Example Request

**Input:**
```
"Mujhe kal subah G-13 mein AC technician chahiye"
```

**Extracted Intent:**
```json
{
  "service_type": "AC Technician",
  "location": "G-13, Islamabad",
  "time": "Tomorrow morning"
}
```

**System Output:**
```
✅ Recommended Provider:  Ali AC Services (2.1 km away)
   Reasoning:             Closest available · Rating 4.8 ★
   Booked Slot:           10:00 AM — Tomorrow
   Confirmation:          Sent via Socket.IO
   Follow-up Reminder:    Scheduled 1 hour before appointment
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/request` | Submit a new service request |
| `GET` | `/api/providers` | List providers with optional filters |
| `GET` | `/api/bookings/:id` | Get booking details by ID |
| `POST` | `/api/bookings` | Create a booking |
| `PATCH` | `/api/bookings/:id/status` | Update booking status |
| `GET` | `/api/notifications` | Get notifications for current user |
| `WS` | `/socket.io` | Real-time chat & event stream |

> Full API documentation coming soon. For now, refer to `backend/app.py` for all route definitions.

---

## 🎬 Demo

> 📹 **Demo Video:** [Watch on YouTube](#) *(3–5 min walkthrough)*

The demo covers:
- Natural language input (English + Roman Urdu)
- Live intent extraction with agent trace logs
- Provider matching with reasoning output
- End-to-end booking simulation
- Follow-up reminder scheduling
- Role switching between Buyer and Seller

---

## ⚠️ Assumptions & Limitations

| Area | Detail |
|---|---|
| **Provider Data** | Mock dataset used for provider discovery. Real Google Maps Places API integrated for location/geocoding only. |
| **Booking System** | Booking is simulated — no real payment gateway is integrated. |
| **Notifications** | In-app and Socket.IO only. SMS/WhatsApp delivery not implemented. |
| **Pickle Serialisation** | LangGraph checkpoints currently use `pickle`. This should be replaced with JSON serialisation before any production deployment. |
| **API Auth** | Flask routes currently have no authentication middleware — any caller on port 5000 can invoke endpoints. An API gateway or per-route auth is required for production. |
| **Language Support** | Intent extraction optimised for English and Roman Urdu. Pure Urdu (Nastaliq script) may have reduced accuracy. |
| **Scale** | Designed as a hackathon prototype; not stress-tested for concurrent users beyond local development. |

---

## Privacy & Security

- **Authentication** is fully managed by Supabase (JWTs). The frontend never handles raw passwords.
- **Gemini voice tokens** are single-use with a 5-minute expiry (`SESSION_EXPIRY_SECONDS=300`) and stored in-memory only.
- **⚠️ Critical (pre-public release):** Rotate all API keys before making the repository public. Ensure `backend/.env` and `.env` are in `.gitignore`.

---

## 🗺 Roadmap

- [ ] WhatsApp integration for service requests
- [ ] Real payment gateway (Stripe / JazzCash)
- [ ] SMS / push notification delivery
- [ ] Provider verification & review system
- [ ] Production-ready API authentication middleware
- [ ] Replace pickle serialisation with JSON in LangGraph checkpoints
- [ ] Multi-city support beyond Islamabad
- [ ] Web dashboard for providers

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

Please make sure your code follows the existing style and includes relevant tests.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">

Built with ❤️ for the **Google Antigravity Challenge 2**

*Automating the informal economy — one service request at a time.*

</div>
