export function tomorrowGraphqlProjectRequest(userId: number) {
  return {
    query: `
query SucceededProjects($userId: Int!) {
  progress(where: {userId: {_eq: $userId}, isDone: {_eq: true}}) {
    path
    object {
      name
      type
    }
  }
}`,
    variables: {
      userId
    }
  };
}
