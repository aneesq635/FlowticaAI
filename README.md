<div align="center">

<img src="https://img.shields.io/badge/Flowtica-AI%20Service%20Orchestrator-6C63FF?style=for-the-badge&logoColor=white" alt="Flowtica" height="40"/>

# Flowtica 🤖

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

[**View Demo**](#-demo) · [**Report Bug**](issues) · [**Request Feature**](issues)

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

A user can simply type:

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
- Socket.IO-powered live chat between buyers and sellers — the AI agent acts as an intelligent middle man
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
│  │    Agent    │ ◄────────────── │  Extraction Agt  │  │
│  │  (Entry &   │   returns to    │  Memory Agent    │  │
│  │   Router)   │                 │  Knowledge Agt   │  │
│  └─────────────┘                 │  Matching Agent  │  │
│         │                        │  Negotiation Agt │  │
│         └──────────────────────► │  Booking Agent   │  │
│                                  │  Scheduling Agt  │  │
│                                  │  Comms Agent(END)│  │
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
├── app/                          # Expo Router screens
│   ├── (app)/                    # Authenticated routes
│   │   ├── (provider)/           # Seller-only screens
│   │   │   └── provider.js       # Provider dashboard
│   │   ├── booked-jobs/          # Provider's booked jobs list
│   │   ├── booked-services/      # Customer's booked services list
│   │   ├── chat/                 # AI chat interface & panel
│   │   ├── profile/              # User profile & location editor
│   │   └── settings/             # App settings & role switcher
│   ├── auth/                     # Auth screens (Login / Register)
│   ├── onboarding/               # First-time user setup & location
│   └── _layout.js                # Root layout (Auth guard)
│
├── backend/                      # Python AI Backend
│   ├── agents/                   # LangGraph AI Agents
│   │   ├── base.py               # BaseAgent class
│   │   ├── service_agents.py     # RequestCreation, Booking, Scheduling agents
│   │   └── orchestrator.py       # SupervisorAgent (routing & state machine)
│   ├── core/                     # Core engine modules
│   │   ├── knowledge_engine.py   # Hybrid retrieval (vector + fuzzy)
│   │   ├── state.py              # AgentState TypedDict definition
│   │   └── vector_store.py       # ChromaDB vector manager
│   ├── models/                   # MongoDB data models
│   │   ├── booking.py            # Booking document structure
│   │   ├── provider.py           # Provider profile model
│   │   └── user.py               # User model & profile sync
│   ├── services/                 # Backend utility services
│   │   └── location.py           # Geocoding & reverse geocoding
│   ├── app.py                    # Flask app, all API routes & Socket.IO
│   └── requirements.txt          # Python dependencies
│
├── components/                   # Shared React Native components
│   ├── MiniMap.js                # Embeddable map preview component
│   ├── LocationPickerModal.js    # Full-screen map picker with autocomplete
│   └── ...                       # Other UI components
│
├── services/                     # Frontend service layer
│   ├── api.js                    # Axios HTTP client
│   ├── location.js               # Location & Places API service
│   └── socket.js                 # Socket.IO real-time client
│
├── store/                        # Redux Toolkit state slices
├── assets/                       # Images, fonts, icons
├── app.json                      # Expo configuration
└── package.json                  # JS dependencies
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

> ⚠️ **Security Warning:** Never commit `.env` files to version control. Add them to `.gitignore` and rotate any keys that were previously exposed.

---

## 🤖 Multi-Agent Workflow

Flowtica's backend is a **modular multi-agent system** orchestrated by LangGraph. The `SupervisorAgent` acts as the single entry point and routing authority — every other agent returns control to it after completing its task.

---

### Agent Roster

| Agent | Role |
|---|---|
| **SupervisorAgent** | The orchestrator. Routes between agents based on conversation stage, enforces loop guards, and handles errors. |
| **IntentAgent** | Classifies what the user wants — service request, status check, booking confirmation, etc. Uses rule-based pre-classification with LLM fallback. |
| **ExtractionAgent** | Pulls structured data from the message: `service_type`, `location`, `requested_date`, `time`, and `provider_selection`. |
| **MemoryAgent** | Session + profile memory. Loads conversation history and rehydrates prior context so agents have full situational awareness. |
| **KnowledgeAgent** | The search engine. Queries MongoDB and ChromaDB (vector search) to fetch available services and nearby providers. |
| **MatchingAgent** | Ranking engine. Takes the provider list from `KnowledgeAgent` and sorts by rating, reliability, and experience to surface the best options. |
| **NegotiationAgent** | Handles provider outreach, price matching, date alignment, and multi-turn negotiation stages. |
| **RequestCreationAgent** | Safely inserts and verifies a new active request document in MongoDB. |
| **BookingAgent** | Confirms bookings — only signals success after verifying the database was actually updated. |
| **SchedulingAgent** | Handles final scheduling details once a booking is confirmed: reminders, slot locking, and follow-up triggers. |
| **CommunicationAgent** | The outward-facing frontier. Generates the final user-facing response strictly from internal state built by all prior agents. Transitions to `END`. |

---

### The 3 Pipelines

The `SupervisorAgent` routes to one of three distinct pipelines depending on what the `IntentAgent` detects.

#### 1️⃣ Service Request Pipeline
> *Triggered when: user asks for a service — e.g., "I need an AC technician in G-13 tomorrow morning"*

```
Intent → Extraction → Memory → Knowledge → Matching → Communication
```

| Step | What Happens |
|---|---|
| Intent | Classifies as `service_request` |
| Extraction | Pulls service type, location, date/time |
| Memory | Loads user profile and prior context |
| Knowledge | Fetches nearby providers from DB + vector search |
| Matching | Ranks providers by rating, distance, availability |
| Communication | Presents top options with reasoning to the user |

---

#### 2️⃣ Provider Selection Pipeline
> *Triggered when: user picks a provider and shares details — e.g., "Book Ali AC Services for 10 AM"*

```
Intent → Extraction → Negotiation → RequestCreation → Communication
```

| Step | What Happens |
|---|---|
| Intent | Classifies as `provider_selection` |
| Extraction | Pulls provider choice, time, and price |
| Negotiation | Prepares the request, aligns price and schedule |
| RequestCreation | Saves the active request to MongoDB |
| Communication | Tells user to wait for provider confirmation |

---

#### 3️⃣ Booking Confirmation Pipeline
> *Triggered when: user confirms — e.g., "Yes, go ahead" / "Confirm karo"*

```
Intent → Booking → Scheduling → Communication
```

| Step | What Happens |
|---|---|
| Intent | Classifies as `booking_confirmation` |
| Booking | Verifies and commits the booking in MongoDB |
| Scheduling | Locks the slot, sets reminders and follow-ups |
| Communication | Delivers final confirmation summary to the user |

---

### Example: End-to-End Flow

**User says:** `"Mujhe kal subah G-13 mein AC technician chahiye"`

```
[SupervisorAgent]       → detects new service request → Pipeline 1

[IntentAgent]           → service_request
[ExtractionAgent]       → { service: "AC Technician", location: "G-13", time: "Tomorrow AM" }
[MemoryAgent]           → loads user profile & history
[KnowledgeAgent]        → fetches 5 nearby AC providers via vector search
[MatchingAgent]         → ranks by rating + distance → Ali AC Services #1
[CommunicationAgent]    → "Here are the top providers near G-13..."

  ── user selects Ali AC Services ──────────────────────────────

[SupervisorAgent]       → provider selected → Pipeline 2

[IntentAgent]           → provider_selection
[ExtractionAgent]       → { provider: "Ali AC Services", time: "10:00 AM" }
[NegotiationAgent]      → prepares outbound request & price alignment
[RequestCreationAgent]  → saves active_request to MongoDB ✅
[CommunicationAgent]    → "Request sent! Waiting for provider confirmation..."

  ── user confirms ─────────────────────────────────────────────

[SupervisorAgent]       → booking confirmed → Pipeline 3

[IntentAgent]           → booking_confirmation
[BookingAgent]          → verifies & commits booking in MongoDB ✅
[SchedulingAgent]       → reminder set for 9:00 AM tomorrow
[CommunicationAgent]    → "Booked! Ali AC Services at 10:00 AM. Reminder set. ✅"
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

> 📹 **Demo Video:** [Watch on Google Drive](#) *(3–5 min walkthrough)*

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
| **Booking System** | Booking is simulated — no real payment gateway is integrated. |
| **Notifications** | In-app and Socket.IO only. SMS/WhatsApp delivery not implemented. |
| **Pickle Serialisation** | LangGraph checkpoints currently use `pickle`. This should be replaced with JSON serialisation before any production deployment. |
| **API Auth** | Flask routes currently have no authentication middleware — any caller on port 5000 can invoke endpoints. An API gateway or per-route auth is required for production. |
| **Language Support** | Intent extraction optimised for English and Roman Urdu. Pure Urdu (Nastaliq script) may have reduced accuracy. |
| **Scale** | Designed as a hackathon prototype; not stress-tested for concurrent users beyond local development. |

---

## 🔒 Privacy & Security

- **Authentication** is fully managed by Supabase (JWTs). The frontend never handles raw passwords.

- **⚠️ Critical (pre-public release):** Rotate all API keys before making the repository public. Ensure `backend/.env` and `.env` are listed in `.gitignore`.

---


---

---

<div align="center">

Built with ❤️ for the **Google Antigravity Challenge 2**

*Automating the informal economy — one service request at a time.*

</div>
