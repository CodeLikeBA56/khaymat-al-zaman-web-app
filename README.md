# Restaurant ERP

Initial Next.js + shadcn-style restaurant ERP foundation.

## Included

- Firebase Authentication
- Firestore users collection
- Admin-only login
- Collapsible sidebar navigation
- Reusable dialog component
- Employee create/update
- TanStack React Table
- Role and permission configuration
- Custom role aliases
- PIN stored on the employee profile
- Duty schedule
- Light/dark mode
- Responsive mobile navigation
- Firestore rules that prevent user deletion

## Important Firebase setup

1. Create a Firebase project.
2. Enable Email/Password Authentication.
3. Create the first admin user manually in Firebase Authentication.
4. Create the matching Firestore document at `users/{uid}`:

```js
{
  uid: "AUTH_UID",
  name: "Admin",
  email: "admin@example.com",
  role: "admin",
  salary: 0,
  workingHoursPerDay: 0,
  dutySchedule: [],
  alias: "Admin",
  pin: "",
  permissionOverrides: {
    allow: [],
    deny: []
  },
  workHistory: [
    {
      joinedAt: new Date(),
      leftAt: null
    }
  ],
  isActive: true
}
```

1. Copy `.env.example` to `.env.local` and fill in your Firebase config.
2. Deploy `firestore.rules`.

## Run

```bash
npm install
npm run dev
```

Then open `/login`.

## Note about creating employee accounts

The employee form uses a secondary Firebase app instance in the browser so creating an employee does not replace the currently logged-in admin session.

For a production deployment, you should eventually move account creation to a trusted server/Admin SDK endpoint. Do not put a Firebase Admin SDK service-account key in the browser.
