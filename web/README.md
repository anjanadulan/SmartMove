# SmartMove Web Portal

A high-performance Next.js 16 web application for the SmartMove transit reservation and fleet management system, featuring dedicated Passenger and Administrator workspaces built with Tailwind CSS and shadcn/ui.

## Route Structure

| Passenger Portal | Administrator Workspace |
| --- | --- |
| `/` Transit Schedule & Search | `/admin/login` Secure Administrator Authentication |
| `/trips/[id]` Dedicated Seat Map & Checkout | `/admin` Operational Dashboard & KPIs |
| `/login`, `/signup` Authentication | `/admin/trips`, `/admin/routes` |
| `/account/bookings` History, Digital Tickets & Refunds | `/admin/vehicles`, `/admin/drivers` |
| `/account/profile` Profile Settings | `/admin/passengers`, `/admin/bookings`, `/admin/payments` |
| `/account/feedback` Support Inbox & Feedback | `/admin/maintenance`, `/admin/feedback` |
| `/account/notifications`, `/updates` | `/admin/content`, `/admin/reports` |

## Security & Access Control

* **Passenger Registration**: Public signup exclusively creates `PASSENGER` accounts in the database.
* **Administrator Access**: Restricted to authorized administrative credentials.
* **Session Management**: Session tokens are hashed and validated against database session tables with automatic expiry.
* **Role Verification**: All private API endpoints verify database roles and enforce ownership checks before executing mutations.

## Local Configuration

Create a local environment configuration file:

```bash
cp .env.example .env.local
```

Configure your local database parameters:
```ini
ORACLE_USER=SMARTMOVE_DATABASE_APP
ORACLE_PASSWORD=YourPassword
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1
ORACLE_SCHEMA=SMARTMOVE_DATABASE
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=smartmove
ALLOW_DEMO_PAYMENTS=true
```

## Running the Application

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Quality Checks & Verification

```bash
npm run typecheck
npm run lint
npm run check:database
npm run test:integration
```
