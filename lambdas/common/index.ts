import type { APIGatewayProxyResult, APIGatewayProxyEvent } from "aws-lambda";
import type { AxiosRequestConfig, AxiosPromise } from "axios";
import headers from "roamjs-components/backend/headers";

// Github Creds
const personalAccessToken = process.env.ROAMJS_RELEASE_TOKEN || "";

export const getGithubOpts = (): AxiosRequestConfig => ({
  headers: {
    Accept: "application/vnd.github.inertia-preview+json",
    Authorization: `Basic ${Buffer.from(
      `dvargas92495:${personalAccessToken}`
    ).toString("base64")}`,
  },
});

export const userError = (body: string): APIGatewayProxyResult => ({
  statusCode: 400,
  body,
  headers,
});

export const wrapAxios = (
  req: AxiosPromise<Record<string, unknown>>
): Promise<APIGatewayProxyResult> =>
  req
    .then((r) => ({
      statusCode: 200,
      body: JSON.stringify(r.data),
      headers,
    }))
    .catch((e) => ({
      statusCode: e.response?.status || 500,
      body: e.response?.data ? JSON.stringify(e.response.data) : e.message,
      headers,
    }));
