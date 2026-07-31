# Cube Dash - Standalone Level Hosting Server

This folder contains a dedicated Node.js / Express backend server designed to host, publish, and serve community levels for **Cube Dash**.

## 🚀 Overview

- **REST API Endpoints**:
  - `GET /api/levels` : List all hosted community levels.
  - `GET /api/levels/:id` : Fetch specific level details by ID.
  - `POST /api/levels` : Publish a new level to the server.
  - `DELETE /api/levels/:id` : Delete a community level.
  - `GET /api/health` : Server health status check.
- **Persistence**: Stores levels cleanly in `./data/levels.json` (can be swapped with MongoDB, PostgreSQL, or Firestore).
- **CORS Enabled**: Out-of-the-box support for cross-origin requests from the Cube Dash frontend web client.

## 📦 How to Run Locally

1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3001` (or port specified via `PORT` environment variable).

4. Connect from Cube Dash UI:
   In the **COMMUNITY** tab in Cube Dash, enter your server URL (e.g., `http://localhost:3001/api/levels`) into the **SERVER ENDPOINT** input field and click **SYNC SERVER**.

## ☁️ Deployment Instructions

You can deploy this level hosting server to any Cloud platform:

- **Cloud Run / Docker**: Package `server.js` and expose port `3001` or `$PORT`.
- **Render / Vercel / Railway**: Set root directory to `server`, run command `npm start`.
