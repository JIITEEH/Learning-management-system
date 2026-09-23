// The dashboard.
//
// For now it only puts the shared bar in place and turns anyone signed out
// away. The cards below it are still the placeholders from the design pass:
// they show a dash rather than a number, because the courses, lessons and
// deadlines they would report do not exist yet. Roadmap step 9 fills them in,
// once there is something real to count.

import { mountShell } from "../shell.js";

await mountShell();
