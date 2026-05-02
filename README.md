🎟️ Event Management System 
Real-Time Event Booking Platform
🚀 Overview

The Event Management System is a scalable full-stack application that enables:

🎯 Real-time event creation and updates
🎟️ Seamless event booking and registration
💳 Secure online payments via Razorpay
📲 Instant ticket generation with QR codes and PDFs

This project simulates a production-grade event platform, focusing on:

Performance ⚡
Security 🔐
Real-time interactivity 🔄
✨ Features
👤 User
Browse and explore events
Register in real-time
Secure payment integration
Download PDF tickets
Access QR-based entry system
🛠️ Organizer
Create, update, and manage events
Upload media via Cloudinary
Track attendees in real-time
Export registrations as CSV
Perform QR / ID-based check-ins
🛡️ Admin
Approve or reject events
Moderate platform activity
Manage system operations end-to-end
⚡ Key Highlights
🔄 Real-time updates using Socket.IO
💳 Secure payments via Razorpay
🔐 Authentication system:
JWT-based login
Role-based access control (RBAC)
OTP verification
🧾 Dynamic ticket generation:
QR code-based entry
Auto-generated PDF tickets
☁️ Media storage using Cloudinary
🧠 Schema validation using Zod
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
🏗️ Tech Stack
🖥️ Frontend
React.js
Tailwind CSS
🔧 Backend
Node.js
Express.js
🗄️ Database
MongoDB (Mongoose)
🔌 Integrations & Tools
Socket.IO
Razorpay
Cloudinary
Zod
JWT Authentication
📂 Project Structure
.
├── client/             # React frontend
├── server/             # Express backend
│   ├── controllers/    # Business logic
│   ├── models/         # Database schemas
│   ├── routes/         # API routes
│   ├── middleware/     # Authentication & validation
│   └── utils/          # Helper functions
└── README.md
🔐 Security
JWT-based authentication
Role-Based Access Control (RBAC)
OTP verification system
Input validation using Zod
Secure payment verification via Razorpay
📈 Future Scope
📊 Admin analytics dashboard
📩 Email and SMS notifications
📱 Mobile-first UI optimization
🤖 AI-based event recommendations
🌍 Multi-language support
🤝 Contributing

Contributions are welcome!

Fork the repository
Create a feature branch
Commit your changes
Open a Pull Request
👨‍💻 Author

Ansh Rastogi
🔗 GitHub: https://github.com/Anshrastogi05

📄 License

This project is licensed under the MIT License.
