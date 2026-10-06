# Sandwich Ordering App — Web Application Security Coursework

A full-stack university project built with React, Express and SQLite. Users can configure sandwiches, place orders and manage their own orders. I used the project to work on authentication, authorization and server-side validation in a complete web application.

## What the application does

- Shows the menu, prices and current availability.
- Lets authenticated users create and view orders.
- Lets users delete their own orders after a TOTP verification step.
- Calculates prices, credit and availability on the server rather than trusting values sent by the browser.

## Security-related implementation

- Passwords are stored as salted hashes in the demo database.
- Authentication uses server-side sessions.
- Order endpoints check authentication, and users can access only their own orders.
- The server validates order contents and recalculates prices before saving them.
- TOTP verification is required for order deletion; previously used codes are rejected.

This is a **coursework application, not a production-ready or independently audited security system**. The repository contains demo accounts and a seeded database. Further hardening would include replacing the hard-coded session secret, adding explicit CSRF protection and security headers, and configuring production session cookies.

## Run locally

You need Node.js and npm. Use two terminals from the repository directory.

**Terminal 1 — server**

```bash
cd server
npm ci
node index.mjs
```

The API listens on `http://localhost:3001`. The repository includes a seeded `sandwich.db`. If you want to reset it to its initial demo state, run `node init-db.mjs` **before** starting the server; this replaces the existing database.

**Terminal 2 — client**

```bash
cd client
npm ci
npm run dev
```

Open the local address printed by Vite (normally `http://localhost:5173`). Demo account details are listed in the project documentation/code and are intended only for local testing.

## Project structure

- `client/` — React interface and API calls
- `server/` — Express API, authentication, database access and seed script
- `img/` — application screenshots

Developed as university coursework at Politecnico di Torino by Riccardo Bartolini.
