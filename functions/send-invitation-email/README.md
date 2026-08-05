# send-invitation-email

Appwrite Function that sends the Nevermore invitation email through Brevo's transactional email API instead of Appwrite's built-in Magic URL email. It creates the invitee's login token server-side (so Appwrite does not fire its own email) and then calls Brevo with the styled template ("You matter to someone's recovery.", template ID 1 by default).

## Deployment

1. In the Appwrite Console, go to Functions and create a new function pointing at this folder (`functions/send-invitation-email`), runtime Node.js 18+ or 20+, entrypoint `src/main.js`.
2. 2. Set the function's execute permission to allow authenticated Users (or whichever role should be allowed to trigger invitations).
   3. 3. Add the environment variables listed below in the function's Settings tab. Do this yourself in the Appwrite Console; secrets should never be pasted into chat, code, or version control.
      4. 4. Copy the deployed function's ID into `APPWRITE_INVITATION_FUNCTION_ID` in the app's `.env` file.
        
         5. ## Required environment variables
        
         6. - `BREVO_API_KEY` — your Brevo API key (Brevo dashboard under SMTP & API > API Keys).
            - - `BREVO_INVITATION_TEMPLATE_ID` — optional, defaults to `1` (the invitation template already created in Brevo).
              - - `APPWRITE_API_KEY` — an Appwrite API key with `users.read` and `users.write` scopes, used to look up/create the invitee and issue their login token.
               
                - `APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` are provided automatically by Appwrite at runtime.
               
                - ## Request payload
               
                - ```json
                  {
                  "email": "invitee@example.com",
                  "deepLink": "https://nevermore-admin-app-seven.vercel.app/invite?token=...",
                  "firstName": "optional"
                  }
                  ```

                  ## Response

                  ```json
                  { "success": true, "userId": "..." }
                  ```

                  On failure, `success` is `false` and `message` explains what went wrong.

                  ## Note on the Brevo sender domain

                  Brevo currently reports that the sender `louis@nevermoreapp.com` is not domain-authenticated, which will block delivery. Authenticate the sending domain (or switch to an authenticated sender) in Brevo before relying on this function in production.
                  
