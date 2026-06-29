export function mapTomorrowUser(input: {
  id: string;
  login: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  return {
    id: input.id,
    login: input.login,
    email: input.email,
    displayName: [input.firstName, input.lastName].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ") || undefined
  };
}
