🎟️ Event Management System 
Real-Time Event Booking Platform

<p align="center"> <img src="https://img.shields.io/badge/Node.js-18%2B-green" /> <img src="https://img.shields.io/badge/React-Vite-blue" /> <img src="https://img.shields.io/badge/MongoDB-Mongoose-brightgreen" /> <img src="https://img.shields.io/badge/Auth-JWT-orange" /> <img src="https://img.shields.io/badge/Realtime-Socket.IO-black" /> <img src="https://img.shields.io/badge/Styling-TailwindCSS-06B6D4" /> <img src="https://img.shields.io/badge/License-MIT-purple" />
<p align="center"> <b>A production-ready full-stack platform for real-time event creation, booking, and ticket management.</b><br/> Built with scalability, security, and seamless user experience in mind. </p>

📌 Table of Contents
✨ Overview
🔥 Features
🧠 Architecture
⚙️ Tech Stack
📂 Project Structure
🚀 Getting Started
🔐 Security
📈 Future Scope
🤝 Contributing

🚀 Overview

The Event Management System is a scalable full-stack application that enables:

🎯 Real-time event creation & updates
🎟️ Seamless event booking & registration
💳 Secure online payments
📲 Instant ticket generation with QR codes

This project is designed to simulate a production-grade event platform, focusing on performance, security, and real-time interactivity.
The system emphasizes scalability, real-time updates, and clean architecture.

✨ Features
👤 User Features
Browse and explore events
Register for events in real-time
Secure online payments
Get QR-based tickets
Download PDF tickets

🛠️ Organizer Features
Create and manage events
Track attendees in real-time
Upload event media
View registered participants
Export registrations as CSV
Perform real-time QR / ID check-ins

🛡️ Admin

Approve or reject organizer-submitted events

Platform moderation

Manage movie system end to end


⚡ Key Highlights
🔄 Real-Time Updates using Socket.IO
💳 Secure Payments via Razorpay integration
🔐 Authentication System
JWT-based login
Role-based access control
OTP verification
🧾 Dynamic Ticket Generation
QR Code-based entry
Auto-generated PDF tickets
☁️ Cloud Storage with Cloudinary
🧠 Schema Validation using Zod

🏗️ Tech Stack

Frontend:

React.js

Backend:

Node.js
Express.js

Database:

MongoDB

Other Tools & Services:

Socket.IO
Razorpay
Cloudinary
Zod
JWT Authentication

🧱 Architecture

        ┌──────────────────────┐
        │      Frontend        │
        │     (React.js)       │
        └─────────┬────────────┘
                  │ HTTP / WebSocket
                  ▼
        ┌──────────────────────┐
        │   Backend Server     │
        │  (Node.js + Express) │
        └─────────┬────────────┘
                  │
     ┌────────────┼────────────┬──────────────┐
     ▼            ▼            ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ MongoDB  │ │ Razorpay │ │Cloudinary│ │  Socket.IO   │
│ Database │ │ Payments │ │ Media    │ │ Real-Time    │
└──────────┘ └──────────┘ └──────────┘ └──────────────┘

📂 Project Structure
.
├── client/             # React frontend
├── server/             # Express backend
│   ├── controllers/    # Business logic
│   ├── models/         # Database schemas
│   ├── routes/         # API routes
│   ├── middleware/     # Auth & validation
│   └── utils/          # Helpers
└── README.md

📈 Future Scope
📊 Admin analytics dashboard
📩 Email & SMS notifications
📱 Mobile-first UI improvements
🤖 AI-based event recommendations
🌍 Multi-language support
🤝 Contributing

Want to improve this project?

Fork the repository
Create a new branch
Commit your changes
Open a Pull Request
👨‍💻 Author

Ansh Rastogi
🔗 GitHub: https://github.com/Anshrastogi05

LICENSE MIT
