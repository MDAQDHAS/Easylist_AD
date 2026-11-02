import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updatePassword,
  updateProfile,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export function getFriendlyAuthErrorMessage(errorCode: string, defaultMessage?: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in or use password recovery.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters with a mix of letters and numbers.';
    case 'auth/invalid-email':
      return 'Please provide a valid email address.';
    case 'auth/too-many-requests':
      return 'Access temporarily disabled due to multiple failed attempts. Please try again later or reset your password.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    case 'auth/expired-action-code':
      return 'The action code or password reset link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'The action code or password reset link is invalid. Please request a new one.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact support.';
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please sign out and sign in again.';
    default:
      return defaultMessage || 'An unexpected authentication error occurred. Please try again.';
  }
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    } catch (err) {
      console.warn('Failed to set user displayName:', err);
    }
  }
  try {
    await sendEmailVerification(credential.user);
  } catch (err) {
    console.warn('Failed to send initial verification email:', err);
  }
  return credential.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function sendVerificationEmail(targetUser?: User | null): Promise<void> {
  const user = targetUser || auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user found to send verification email.');
  }
  await sendEmailVerification(user);
}

export async function sendPasswordReset(email: string, actionUrl?: string): Promise<void> {
  const cleanEmail = email.trim();
  if (actionUrl) {
    await sendPasswordResetEmail(auth, cleanEmail, { url: actionUrl, handleCodeInApp: true });
  } else {
    await sendPasswordResetEmail(auth, cleanEmail);
  }
}

export async function verifyResetCode(oobCode: string): Promise<string> {
  return await verifyPasswordResetCode(auth, oobCode);
}

export async function confirmPasswordResetCode(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

export async function updateUserPassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be signed in to update password.');
  }
  await updatePassword(user, newPassword);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export async function getCurrentUserToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(forceRefresh);
}
