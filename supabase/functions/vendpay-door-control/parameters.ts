// Repair only the observed Yemot second-question-mark format.
// Never accept an arbitrary action prefix or conflicting duplicate fields.
export async function readParameters(req: Request): Promise<URLSearchParams> {
  const params = new URL(req.url).searchParams;
  if (req.method === "POST") {
    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (type === "application/x-www-form-urlencoded") {
      const body = await req.text();
      if (body.length > 16384) throw new Error("body_too_large");
      for (const [key, value] of new URLSearchParams(body)) params.append(key, value);
    }
  }
  for (const key of ["action", "source"]) {
    const values = params.getAll(key);
    if (values.length !== 1) continue;
    const value = values[0];
    const match = /^([^?]+)\?(ApiCallId|ApiYFCallId)=([^?]+)$/.exec(value);
    if (!match) continue;
    const nested = new URLSearchParams(value.slice(value.indexOf("?") + 1));
    // The repair may only introduce call metadata, never an action or a secret.
    if ([...nested.keys()].some(k => !/^Api[A-Za-z0-9_]+$/.test(k))) continue;
    params.set(key, match[1]);
    for (const [name, data] of nested) params.append(name, data);
  }
  return params;
}

export function uniqueValue(params: URLSearchParams, key: string): string | null {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}
