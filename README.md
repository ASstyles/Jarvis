# Jarvis 🤖

Jarvis is an intelligent, multi-agent AI assistant and orchestration platform featuring autonomous goal execution, computer control, vision, voice interaction, memory management, and sandbox environments.

---

## 🌟 Key Features

- **Multi-Agent Orchestration**: Specialized sub-agents for research, coding, computer control, proactive assistance, and mission tracking.
- **Dynamic Memory Matrix**: Episodic, working, and semantic memory layers for persistent context across interactions.
- **Compute Fabric & Sandbox Execution**: Isolated execution environments for running tools and code safely.
- **Vision & Multimodal Intelligence**: Visual analysis, UI element detection, and real-time screen inspection.
- **Voice Synthesis & Control**: Seamless voice interaction and speech processing.
- **Interactive Mission Dashboard**: Modern Next.js interface with real-time mission status, memory matrix inspection, and reactive controls.

---

## 🏗️ Architecture

```
Jarvis/
├── client/              # Next.js frontend with Tailwind CSS & Framer Motion
│   ├── src/
│   │   ├── app/         # Next.js App Router
│   │   ├── components/  # Mission Tracker, Memory Matrix, UI widgets
│   │   └── lib/         # Client utilities & Firebase integration
│   └── .env.example
│
├── server/              # Express + LangChain agent runtime
│   ├── src/
│   │   ├── agents/      # Autonomous agents (research, planner, executor)
│   │   ├── compute/     # Compute fabric & task scheduling
│   │   ├── memory/      # Long-term & short-term memory systems
│   │   ├── sandbox/     # Tool execution & safe runtime sandbox
│   │   ├── vision/      # Visual perception & analysis
│   │   ├── voice/       # Voice processing & audio synthesis
│   │   └── index.js     # API entrypoint
│   └── .env.example
```

---

## 🚀 Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- Google Gemini API Key

### 2. Clone the Repository

```bash
git clone https://github.com/ASstyles/Jarvis.git
cd Jarvis
```

### 3. Backend Setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env` and add your Gemini API key:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
```

Start the backend server:

```bash
npm start
# or for development
node src/index.js
```

### 4. Frontend Setup

In a separate terminal:

```bash
cd client
npm install
cp .env.example .env.local
```

Update `client/.env.local` if using Firebase or custom backend ports:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## 🔒 Security

- Never commit `.env` or `.env.local` files containing actual API keys or secrets.
- Templates are provided as `.env.example`.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
