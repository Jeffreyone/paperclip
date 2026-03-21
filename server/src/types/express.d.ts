export {};

declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "board" | "agent" | "none";
        userId?: string;
        agentId?: string;
        companyId?: string;
        companyIds?: string[];
        isInstanceAdmin?: boolean;
        keyId?: string;
        runId?: string;
        source?: "local_implicit" | "session" | "agent_key" | "agent_jwt" | "none";
      };
    }
    interface Response {
      __errorContext?: {
        error: { message: string; stack?: string; name?: string; details?: unknown; raw?: unknown };
        method: string;
        url: string;
        reqBody?: unknown;
        reqParams?: unknown;
        reqQuery?: unknown;
      };
      err?: Error;
    }
  }
}
