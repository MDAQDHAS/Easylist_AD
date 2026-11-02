import { auth } from '../../lib/firebase';

export async function getAccessToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User is not logged in');
  }

  const token = await user.getIdToken();
  if (!token) {
    throw new Error('Unable to retrieve authentication token');
  }

  return token;
}
