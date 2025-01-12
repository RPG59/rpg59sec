import { BasicAuthCreds } from "./types";

export function makeBasicAuthHeader(basicAUthCreds: BasicAuthCreds) {
  return `Basic ${btoa(
    [basicAUthCreds.username, basicAUthCreds.password].join(":")
  )}`;
}
