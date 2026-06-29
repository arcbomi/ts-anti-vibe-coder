export function tomorrowGraphqlUserRequest(userId: number) {
  return {
    query: `
query CurrentUser($userId: Int!) {
  user: user_by_pk(id: $userId) {
    login
    email
    firstName
    lastName
  }
}`,
    variables: {
      userId
    }
  };
}
