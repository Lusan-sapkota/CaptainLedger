# 🎯 **CaptainLedger – Architecture & Design Guide**

## 🎨 **Color Palette & Their Purpose**

| Color          | Purpose                                | Hex       |
| -------------- | -------------------------------------- | --------- |
| **Green**      | Finance, trust, growth, success        | `#27AE60` |
| **Dark Blue**  | Security, professionalism, reliability | `#2C3E50` |
| **Light Gray** | Neutral background, subtle contrast    | `#ECF0F1` |
| **White**      | Clarity, minimalism, clean UI          | `#FFFFFF` |

Use these colors consistently across UI screens, splash, icons, and themes for a professional and cohesive look. For dark mode, invert Light Gray with Dark Blue, and preserve contrast for readability.

---

## 🧱 **CaptainLedger App Architecture**

### 🔹 1. **Frontend (React Native via Expo)**

| Layer              | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| **UI Layer**       | Screens like Dashboard, Auth, Settings, Loans, Transactions              |
| **State Layer**    | Manages app state using Redux, Zustand, or Context API                   |
| **Local DB Layer** | Stores data offline using `expo-sqlite` or `react-native-sqlite-storage` |
| **Sync Module**    | Syncs local data with the server, handles offline/online transitions     |
| **Network Layer**  | Uses Axios or Fetch to call Flask backend APIs                           |

> ✅ **Fully offline capable** – user can use the app without internet. Sync is optional.

---

### 🔹 2. **Backend (Flask API – Self-Hosted)**

| Component           | Role & Functionality                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| **Auth API**        | Login/Register using JWT tokens (`/api/auth/login`, `/api/auth/register`)        |
| **Sync API**        | Upload/download user data for syncing (`/api/sync/upload`, `/api/sync/download`) |
| **User API**        | Update user settings/profile                                                     |
| **Finance APIs**    | Manage transactions, loans, bank balance, currencies                             |
| **Currency API**    | Real-time currency conversion using external APIs                                |
| **Migration Logic** | Handles initial data import when user links app to a server                      |
| **Database Layer**  | SQLAlchemy ORM with SQLite or PostgreSQL                                         |

> 🔐 **User hosts their own server**, ensuring **privacy** and **data ownership**.

---

### 🔹 3. **Database Schema (SQLite/PostgreSQL)**

| Table              | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| **users**          | Stores login credentials, token, account creation date          |
| **transactions**   | All income/expenses with amount, category, date, currency, etc. |
| **loans**          | Loans given/taken with amount, status, contact name             |
| **bank\_accounts** | Track bank account balances in different currencies             |
| **sync\_log**      | Tracks when and what device synced last                         |
| **settings**       | Stores user preferences: server IP, currency, sync status, etc. |

> 🧠 Clean relational schema designed to **scale** and **sync efficiently**.

---

### 🔁 **Offline-First Sync Workflow**

| Step | Description                                                                 |
| ---- | --------------------------------------------------------------------------- |
| 1.   | App uses local SQLite DB — works offline immediately                        |
| 2.   | User goes to **Settings → Enable Sync**, enters self-hosted Flask server IP |
| 3.   | App tests the connection, validates the token                               |
| 4.   | App uploads unsynced data to `/api/sync/upload`                             |
| 5.   | Server sends back updated records from `/api/sync/download`                 |
| 6.   | Device is marked synced; sync continues in background if enabled            |

> 🔄 Minimal bandwidth, safe syncing, and **user control over their data**.

---

## 🌐 **Network Design**

```
[📱 Mobile App]  ⇄  [🖥️ Flask Backend (User-Hosted)]
     ↑                        ↑
 Local SQLite DB     PostgreSQL / SQLite on server
     ↓                        ↓
 Offline Mode          Cloud Sync (Private)
```

---

## 🛠️ **Extra Features to Build Later**

| Feature                     | Why it’s useful                                                       |
| --------------------------- | --------------------------------------------------------------------- |
| 🔐 SQLCipher Encryption     | Protects offline database with encryption                             |
| 🔑 Biometric Login          | Use fingerprint or Face ID for quick login                            |
| ☁️ Backup Options           | Sync encrypted backups to Google Drive, Dropbox                       |
| 🕒 Sync Conflict Resolution | Handles overlapping changes using timestamp or priority rules         |
| 🌙 Theme Sync               | Splash, icon, and theme adapt to system light/dark mode automatically |

--