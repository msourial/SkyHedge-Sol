import type { IncomingMessage, ServerResponse } from "node:http";
import { createMobileApiHandler } from "../server/services/mobile-api.js";

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default function mobileApi(req: IncomingMessage, res: ApiResponse) {
  return createMobileApiHandler()(req, res);
}
