import axios from "axios";
import { wrapAxios, getGithubOpts, userError } from "./common";
import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  const { username } = event.queryStringParameters;
  if (!username) {
    return userError("username is required");
  }
  const opts = getGithubOpts();
  return wrapAxios(
    axios(`https://api.github.com/users/${username}/repos`, opts)
  );
};
