// The front door. It shows a way in to a visitor, and a way onward to
// somebody already signed in.

import { session } from "../session.js";

const signedOut = document.querySelector("[data-signed-out]");
const signedIn = document.querySelector("[data-signed-in]");

session()
  .then((current) => {
    signedOut.hidden = Boolean(current);
    signedIn.hidden = !current;
  })
  .catch(() => {
    // The server could not be asked. The sign-in and register buttons are
    // already on the page, and pressing one will say what is wrong, so the
    // page is left exactly as authored.
  });
