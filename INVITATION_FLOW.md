# Invitation Flow Documentation

## Overview
This document describes the complete invitation flow using Appwrite Magic URL for password-less authentication.

---

## Flow for New Users (Invited via Magic URL)

### 1. **Sending Invitation**
**Screen:** `InviteSend.tsx`

- User enters friend's email address
- System calls `invitationService.createInvitation({ email })`
- Service generates unique `invitationToken`
- Creates Magic URL: `https://nevermoreapp.com/invite?token={invitationToken}`
- Appwrite sends email with magic link (automatically appends `userId` and `secret`)
- Final link: `https://nevermoreapp.com/invite?token=ABC&userId=XYZ&secret=123`
- Invitation record saved to database with status: `pending`

**Code:**
```typescript
const invitationToken = ID.unique();
const deepLink = `https://nevermoreapp.com/invite?token=${invitationToken}`;

await account.createMagicURLToken({
  userId: ID.unique(),
  email,
  url: deepLink,
});

await tablesDB.createRow({
  // ... other fields
  invitationToken: invitationToken,
  deepLink: deepLink,
  status: 'pending',
});
```

---

### 2. **Accepting Invitation**
**Screen:** `Invite.tsx`

When user clicks magic link, the app opens with query parameters: `token`, `userId`, `secret`

**Process:**
1. ✅ Validates all parameters exist
2. ✅ Verifies invitation exists and status is `pending`
3. ✅ Creates session using Magic URL credentials
4. ✅ Checks if user is new (no password set) or existing
5. ✅ Creates user profile if needed
6. ✅ Marks invitation as accepted
7. ✅ Routes appropriately:
   - **New User** → `SetPassword` screen
   - **Existing User** → Complete onboarding → Home

**Code:**
```typescript
// Create session
await account.createSession({ userId, secret });

// Check if new user (no password)
const user = await getCurrentUser();
const isNewUser = !user.passwordUpdate || user.passwordUpdate === user.registration;

if (isNewUser) {
  // Redirect to SetPassword screen
  navigation.reset({
    index: 0,
    routes: [{ name: ScreenNames.SET_PASSWORD }],
  });
} else {
  // Existing user - go to home
  completeOnboarding();
  navigateToHomeTabs();
}
```

---

### 3. **Set Password** (New Users Only)
**Screen:** `SetPassword.tsx`

User creates their password with requirements:
- ✅ At least 1 capital letter
- ✅ At least 1 number
- ✅ At least 1 special character
- ✅ Minimum 8 characters
- ✅ Passwords must match

**Process:**
1. User enters and confirms password
2. System validates requirements
3. Updates password using `account.updatePassword(password)`
4. Sets onboarding step to `PERMISSION`
5. Redirects to onboarding flow

**Code:**
```typescript
await account.updatePassword(password);

showSuccessNotification('Password set successfully!', 'Success');

setCurrentStep(ScreenNames.PERMISSION);
navigation.reset({
  index: 0,
  routes: [{ name: ScreenNames.PERMISSION }],
});
```

---

### 4. **Onboarding Flow**
After setting password, new users go through full onboarding:

1. **Permission** (`Permission.tsx`) - Request notifications permission
2. **Purpose** (`Purpose.tsx`) - Select user role (patient/coach)
3. **Nickname** (`Nickname.tsx`) - Set display nickname
4. **Invite** (`Invite.tsx`) - Learn about inviting friends
5. **Invite Send** (`InviteSend.tsx`) - Send invitations (optional)
6. **Subscription** (`Subscription.tsx`) - Subscription options
7. **Home** - Main app

---

## Flow for Existing Users (Invited via Magic URL)

1. User clicks invitation link
2. System creates session with Magic URL credentials
3. Detects user already has password
4. Completes onboarding automatically
5. Redirects to Home

---

## Key Components

### Services

**`invitation.service.ts`**
- `createInvitation()` - Send invitation with Magic URL
- `getInvitationByToken()` - Retrieve invitation by token
- `acceptInvitation()` - Mark invitation as accepted
- `acceptInvitationByEmail()` - Accept by email (for existing users)

**`auth.service.ts`**
- `createMagicURLToken()` - Create Magic URL token (used by invitation)
- `createMagicURLSession()` - Create session from Magic URL
- `getCurrentUser()` - Get authenticated user

### Screens

1. **`InviteSend.tsx`** - Send invitations
2. **`Invite.tsx`** - Accept invitation (handles Magic URL)
3. **`SetPassword.tsx`** - Set password for new users
4. **Onboarding screens** - Permission → Purpose → Nickname → Invite → Subscription

### Store

**`authStore.ts`**
- Manages authentication state
- `checkAuth()` - Verify current authentication

**`onboardingStore.ts`**
- Tracks onboarding progress
- `setCurrentStep()` - Update current step
- `completeOnboarding()` - Mark as complete

---

## Database Schema

### Invitations Collection

Required attributes:
```typescript
{
  inviterId: string;           // User who sent invitation
  inviterProfileId: string;    // Profile ID of inviter
  email: string;               // Invited user's email
  status: 'pending' | 'accepted' | 'expired';
  invitationToken: string;     // Unique token for this invitation
  deepLink: string;            // Full deep link URL
  $createdAt: string;
  $updatedAt: string;
}
```

---

## Deep Linking Configuration

**URL Structure:**
- Invitation: `https://nevermoreapp.com/invite?token=ABC&userId=XYZ&secret=123`
- Magic URL Verify: `https://nevermore-admin-app.vercel.app/verify-magic-url?userId=XYZ&secret=123`
- Password Reset: `https://nevermore-admin-app.vercel.app/reset-password?userId=XYZ&secret=123`

**Navigation Config:** (`navigation/index.tsx`)
```typescript
[ScreenNames.INVITE]: {
  path: 'invite',
  parse: {
    token: (token: string) => token,
    userId: (userId: string) => userId,
    secret: (secret: string) => secret,
  },
}
```

---

## Error Handling

### Invalid Invitation
- Missing parameters → Show error, redirect to Sign Up
- Invitation not found → Show error, redirect to Sign Up
- Invitation already used → Show error, redirect to Sign Up

### Session Creation Failed
- Magic URL expired → Show error, redirect to Sign Up
- Invalid credentials → Show error, redirect to Sign Up

### Password Update Failed
- Show error message
- User can retry

---

## Security Features

1. ✅ Magic URL tokens are single-use (session creation invalidates them)
2. ✅ Invitation tokens are unique and stored in database
3. ✅ Password requirements enforced
4. ✅ Session maintained during password setup
5. ✅ Existing sessions cleared before creating new ones

---

## Testing Checklist

- [ ] Send invitation email
- [ ] Receive magic link email from Appwrite
- [ ] Click magic link and open app
- [ ] Verify invitation acceptance screen
- [ ] Set password (new user)
- [ ] Go through onboarding flow
- [ ] Reach home screen
- [ ] Test with existing user
- [ ] Test with invalid link
- [ ] Test with expired link

---

## Notes

- Magic URL tokens expire after 1 hour (Appwrite default)
- Sessions are maintained during password setup for seamless UX
- Existing users skip password setup and onboarding
- All errors gracefully redirect to Sign Up
- Invitation status automatically updates on acceptance

---

Last Updated: December 24, 2025

