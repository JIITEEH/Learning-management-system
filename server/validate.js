// Checks on what people type into the account forms: an email address, a
// name, a password. Shared by routes/auth.js and routes/users.js, so that
// registering, an administrator creating an account, and editing one all
// accept exactly the same things.
//
// Each function returns the cleaned-up value, or throws a 400 saying what to
// fix.

import { httpError } from "./middleware/errors.js";

// The longest address the email standard allows.
const EMAIL_MAX = 254;
// users.full_name is VARCHAR(160).
const NAME_MAX = 160;

export const PASSWORD_MIN = 8;
// The password scrambler (bcrypt) reads only the first 72 bytes and quietly
// ignores the rest, so a longer password would be weaker than it looks.
// Most letters are one byte; accented letters and emoji take two to four.
const PASSWORD_MAX_BYTES = 72;

// Something, an @, something with a dot in it, and no spaces or line breaks
// anywhere. Deliberately loose — the real test of an address is whether mail
// arrives — but a line break is refused, because in an email's headers it
// would start a new header, such as a hidden Bcc.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email) || email.length > EMAIL_MAX) {
    throw httpError(400, "Email address is not valid");
  }
  return email;
}

export function readFullName(value) {
  const fullName = String(value ?? "").trim();
  if (!fullName) throw httpError(400, "Full name is required");
  if (fullName.length > NAME_MAX) {
    throw httpError(400, `Full name must be ${NAME_MAX} characters or fewer`);
  }
  return fullName;
}

export function assertPasswordStrength(password) {
  if (password.length < PASSWORD_MIN) {
    throw httpError(400, `Password must be at least ${PASSWORD_MIN} characters`);
  }
  if (Buffer.byteLength(password) > PASSWORD_MAX_BYTES) {
    throw httpError(400, `Password must be ${PASSWORD_MAX_BYTES} characters or fewer`);
  }
}
