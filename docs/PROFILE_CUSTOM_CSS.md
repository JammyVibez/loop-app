# Profile custom CSS

Loop Pro members can add up to **21,000 UTF-8 bytes** of CSS from **Settings → Profile → Custom profile CSS**.

- CSS is stored on the member's profile and applied to the public profile page.
- Every selector is scoped to the profile root; document-root selectors such as :root, html and body are mapped to that root.
- @media, @supports, @container, @layer and namespaced @keyframes are supported.
- External resource loading (url(), @import, remote @font-face), executable CSS values and unsupported at-rules are rejected.
- The API validates Pro entitlement and the byte limit independently of the UI. PostgreSQL also enforces the 21,000-byte limit.

## Database

Apply scripts/migrations/005_profile_custom_css.sql to the production database before enabling this feature. The migration is idempotent.
