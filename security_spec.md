# Security Specification: F11 Hotkey - Live Tracker

## 1. Data Invariants
- Each session document has an ID matching the authenticated user's anonymous or standard UID.
- The `lastSeen` property of a Session must be a valid timestamp set to the request's time.
- Users can write (increment) the total download counter, but cannot decrease it.
- No user can modify or delete another user's session document.

## 2. Invariant Policies & The Dirty Dozen Payloads
We enforce the following schema rules:
- **CREATE/UPDATE Session /sessions/{userId}**: Must be authenticated, matching `userId == request.auth.uid`. No ghost fields allowed.
- **WRITE Stats /stats/global**: Must only update the `downloads` increment. No one can write custom values or decrease it.

Here are 12 specific hostile payloads (The "Dirty Dozen"):
1. **Unauthenticated Session Creation**: Trying to register a session without logging in. (Result: PERMISSION_DENIED)
2. **Session Impersonation**: Attempting to write a session document inside `sessions/userB` when authenticated as `userA`. (Result: PERMISSION_DENIED)
3. **Session Back-dating**: Crafting `lastSeen` as a past date (e.g. 2000-01-01) instead of `request.time`. (Result: PERMISSION_DENIED)
4. **Session Future-dating**: Crafting `lastSeen` in the future. (Result: PERMISSION_DENIED)
5. **Session Pollution**: Adding a non-specified ghost property like `isAdmin: true` to a session document. (Result: PERMISSION_DENIED)
6. **Negative Download Counter Increment**: Trying to set the `downloads` status to a negative offset or decreasing it. (Result: PERMISSION_DENIED)
7. **Absolute Download Counter Setter**: Overwriting the whole stats document to set `downloads: 999999`. (Result: PERMISSION_DENIED)
8. **Junk Field Inject on Stats**: Spoofing and adding administrative options like `statsOwner` to the global stats document. (Result: PERMISSION_DENIED)
9. **Unauthenticated Stats Read**: Reading the list of sessions (if listed) by query scraping without validation. (Result: PERMISSION_DENIED)
10. **Session Deletion by Stranger**: Stranger trying to delete a user's session tracker document. (Result: PERMISSION_DENIED)
11. **Session ID Poisoning**: Trying to create a session document using a 1 MB long string with junk characters as the document ID. (Result: PERMISSION_DENIED)
12. **Global Stats Deletion**: Any attempt to run delete on the `/stats/global` path. (Result: PERMISSION_DENIED)
