# Contact-only signup

The active flow uses a contact number, display name, and date of birth. No SMS or OTP is sent.

1. Enable anonymous sign-ins in Supabase Authentication settings. This supplies a session without asking the visitor for a code.
2. Run `contact-signup.sql` in Supabase SQL Editor (instead of `signup.sql`). It expects the existing users table with unique phone_number and UUID id.
3. Visit `/`, enter a contact number, and complete the profile.

Contact numbers are unverified. Entering an existing number never grants access to that profile. This flow has no cross-device account recovery: clearing browser storage can lose access. Add an account recovery method before production.

Date of birth is self-reported. Calling code is unchanged. Existing contacts read policies and the call-token endpoint still need production authorization work.
