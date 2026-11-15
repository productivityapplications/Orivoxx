export type User = {
  id: string;
};

export async function requireUser(): Promise<User> {
  // Synthetic fixture: a real deployment would verify a session cookie.
  return { id: "user-synthetic-001" };
}
