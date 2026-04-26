🎟️ EventManager

Full-Stack Event Management System

<p align="center"> <img src="https://img.shields.io/badge/Node.js-18%2B-green" /> <img src="https://img.shields.io/badge/React-Vite-blue" /> <img src="https://img.shields.io/badge/MongoDB-Mongoose-brightgreen" /> <img src="https://img.shields.io/badge/Auth-JWT-orange" /> <img src="https://img.shields.io/badge/Realtime-Socket.IO-black" /> <img src="https://img.shields.io/badge/Styling-TailwindCSS-06B6D4" /> <img src="https://img.shields.io/badge/License-MIT-purple" /> </p>
🚀 Overview

EventManager is a production-ready full-stack web application that enables users to discover and register for events, receive QR-coded PDF tickets, and post reviews. Organizers can manage events, track registrations in real time, export participant data, and perform live check-ins. Administrators moderate events to ensure quality and authenticity.

The system emphasizes scalability, real-time updates, and clean architecture.

✨ Features
👥 Customers

Discover and browse events

Secure event registration

Download branded PDF tickets with QR codes

Submit ratings and reviews

🧑‍💼 Organizers

Create and manage events

View registered participants

Export registrations as CSV

Perform real-time QR / ID check-ins

🛡️ Admin

Approve or reject organizer-submitted events

Platform moderation

🌐 Platform

Real-time updates via Socket.IO

Dark mode & responsive UI

Toast-based user notifications

🛠️ Tech Stack
Backend

Node.js, Express.js

MongoDB + Mongoose

JWT Authentication

Socket.IO (real-time)

Frontend

React (Vite)

React Router

Axios

Tailwind CSS

Utilities & Tooling

PDF generation: html2canvas, jsPDF

Custom QR code generation

ESLint, Prettier

Nodemon, PostCSS

🧱 Architecture

The project follows a monorepo architecture with clear separation of frontend and backend concerns.

Event-management-system/
│
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── socket/
│   │   └── seed.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── package.json

🧠 Custom Hooks

useTicketPDF
Generates branded PDF tickets from HTML layouts with embedded QR codes.

useQrCheckIn
Enables real-time QR and ID-based event check-ins using Socket.IO.

⚙️ Getting Started
Prerequisites

Node.js 18+

MongoDB (local or cloud instance)

Installation
git clone <your-repo-url>
cd Event-management-system

Backend
cd backend
npm install

Frontend
cd ../frontend
npm install

🔐 Environment Configuration

Create `backend/.env`:

PORT=5050
MONGO_URI=mongodb://localhost:27017/eventmanager
JWT_SECRET=supersecret
CLIENT_URL=http://localhost:5173

For multiple allowed frontend origins, use:

CLIENT_URLS=http://localhost:5173,https://your-frontend.vercel.app

Wildcard origins are also supported for preview deployments, for example:

CLIENT_URLS=http://localhost:5173,https://*.vercel.app

▶️ Running Locally
Backend
cd backend
npm run dev

Frontend
cd frontend
npm run dev

🌱 Database Seeding (Optional)
cd backend
node src/seed.js

Demo Accounts
Role	Email	Password
Customer	customer@example.com
	password
Organizer	organizer@example.com
	password
Admin	admin@example.com
	password
📜 Scripts
Backend

npm run dev – Start server with Nodemon

Frontend

npm run dev – Start Vite dev server

npm run build – Production build

npm run preview – Preview production build

🚢 Deployment

Configure environment variables on the host

Serve frontend dist/ via CDN or static hosting

Run backend using PM2 or Docker

Set `CLIENT_URL` or `CLIENT_URLS` on the backend host so the deployed frontend origin is allowed by CORS

Ensure Socket.IO support in production

LICENSE MIT
