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
├── client/                 # React frontend

│   └── src/

│       ├── components/     # Reusable UI components

│       ├── pages/          # Route-level pages

│       └── hooks/          # Custom React hooks

│
├── server/                 # Express backend

│   ├── controllers/        # Business logic

│   ├── models/             # Mongoose schemas

│   ├── routes/             # API route definitions

│   ├── middleware/         # Auth & validation middleware

│   └── utils/              # Helper functions

│
└── README.md

🚀 Getting Started


Prerequisites

Node.js v18+
MongoDB (local or Atlas)
Razorpay account
Cloudinary account

Installation
bash# Clone the repository
git clone https://github.com/Anshrastogi05/event-management-system.git
cd event-management-system

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
Environment Variables
Create a .env file inside the server/ directory:
envPORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret

RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
Run the App
bash# Start the backend server
cd server
npm run dev

# Start the frontend (in a separate terminal)
cd client
npm run dev

🔐 Security

✅ JWT-based authentication
✅ Role-Based Access Control (RBAC)
✅ OTP verification system
✅ Input validation using Zod
✅ Secure payment verification via Razorpay webhook signatures


📈 Future Scope

 📊 Admin analytics dashboard
 📩 Email and SMS notifications
 📱 Mobile-first UI optimization
 🤖 AI-based event recommendations
 🌍 Multi-language support


🤝 Contributing
Contributions are welcome!

Fork the repository
Create a feature branch: git checkout -b feature/your-feature
Commit your changes: git commit -m 'Add some feature'
Push to the branch: git push origin feature/your-feature
Open a Pull Request


👨‍💻 Author
Ansh Rastogi
🔗 GitHub: @Anshrastogi05

📄 License
This project is licensed under the MIT License.

<div align="center">
  <sub>Built with ❤️ by Ansh Rastogi</sub>
</div>

Ansh Rastogi
🔗 GitHub: https://github.com/Anshrastogi05

📄 License

This project is licensed under the MIT License.
