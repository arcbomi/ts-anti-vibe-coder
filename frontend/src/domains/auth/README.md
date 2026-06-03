# Auth Domain

This domain handles frontend authentication.

Current features:
- Login
- Logout
- Current user session
- Auth state management

Future plan:
- Support Tomorrow School account authentication.
- Support Tomorrow School internal SSO.
- Allow students to log in with their Tomorrow School account

Rules:
- This domain should not depend on repository, analysis, question, or exam domains.
- Pages should import auth page sections instead of directly building auth logic.
