export type Session = {
  userId: string;
};

export async function getSession(): Promise<Session> {
  return { userId: "user-synthetic-001" };
}
