// Email to applicants (people outside the company) is switched OFF for now (owner, 2026-10-28): the interview
// invitation and the offering-letter link are not emailed, so nobody sends such an email by mistake while the process is
// still being tried. The app shows the WhatsApp message and the link to copy instead, exactly as it does when an email
// cannot be sent. To switch it on later, change this one value and deploy. Emails to staff (interviewers, reviewers,
// the HR Manager, request changes) and login invitations are not affected.
export const APPLICANT_EMAILS_ENABLED = false;
