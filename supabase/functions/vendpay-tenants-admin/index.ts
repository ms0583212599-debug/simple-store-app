
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OWNER_ID = "56ae10cb-f40c-4a41-8112-ab8c9f1616c8";

const allowedOrigins = new Set([
  "https://simple-store-app-ms0583212599-1490s-projects.vercel.app",
  "https://simple-store-app-ten.vercel.app",
  "https://simple-store-app-git-main-ms0583212599-1490s-projects.vercel.app",
]);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Vary": "Origin",
  };

  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type";
    headers["Access-Control-Allow-Methods"] =
      "GET, POST, OPTIONS";
  }

  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });

  if (!allowedOrigins.has(origin)) {
    return reply({ error: "Origin not allowed" }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  const authorization =
    req.headers.get("authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return reply({ error: "Login required" }, 401);
  }

  const token = authorization.slice(7);

  const authClient = createClient(
    SUPABASE_URL,
    ANON_KEY,
    { auth: { persistSession: false } }
  );

  const { data: userData, error: authError } =
    await authClient.auth.getUser(token);

  if (
    authError ||
    !userData.user ||
    userData.user.id !== OWNER_ID ||
    userData.user.is_anonymous
  ) {
    return reply({ error: "Access denied" }, 403);
  }

  const admin = createClient(
    SUPABASE_URL,
    SERVICE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

 
  const deriveTenantKey = async (secret: string, usage: KeyUsage[]) => {
    if (!secret || secret.length !== 64) throw new Error("Encryption key not configured");
    const raw = /^[0-9a-f]{64}$/i.test(secret)
      ? Uint8Array.from(secret.match(/../g)!, h => parseInt(h, 16))
      : new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, usage);
  };

  if (
    req.method === "POST" &&
    new URL(req.url).searchParams.get("action") === "check_connection"
  ) {
    let input: Record<string, unknown>;

    try {
      input = await req.json();
    } catch {
      return reply({ error: "Invalid JSON" }, 400);
    }

    const tenantId = input?.tenant_id;

    if (
      typeof tenantId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)
    ) {
      return reply({ error: "Invalid customer" }, 400);
    }

    const secret = Deno.env.get("VENDPAY_TENANT_ENCRYPTION_KEY") ?? "";

    if (!secret || secret.length !== 64) {
      return reply({ error: "Encryption key not configured" }, 503);
    }

    const { data: stored, error: readError } = await admin
      .from("vendpay_tenant_credentials")
      .select("ciphertext, iv")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (readError) {
      return reply({ error: "Unable to read credentials" }, 500);
    }

    if (!stored) {
      return reply({ error: "Credentials not configured" }, 404);
    }

    const decode = (value: string) =>
      Uint8Array.from(atob(value), ch => ch.charCodeAt(0));

    let credentials: { username: string; password: string; code?: string; rememberMe?: boolean; role?: string };

    try {
      const key = await deriveTenantKey(secret, ["decrypt"]);

      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decode(stored.iv) },
        key,
        decode(stored.ciphertext)
      );

      credentials = JSON.parse(
        new TextDecoder().decode(plaintext)
      );

      if (
        typeof credentials.username !== "string" ||
        typeof credentials.password !== "string"
      ) {
        throw new Error("Invalid credentials");
      }
    } catch {
      return reply({
        error: "Unable to decrypt credentials"
      }, 409);
    }

    if (typeof credentials.code !== "string") {
      return reply({connected:false,status:"pending",reason:"credentials_need_code"});
    }
    let connected = false;
    let reason = "connection_failed";

    try {
      const auth = await fetch(
        "https://vendpay24.com/VendPayDeltaHeb/authenticate?lang=heb&apiloc=VendPayDeltaHeb",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({username:credentials.username,password:credentials.password,code:credentials.code,rememberMe:credentials.rememberMe ?? false,role:credentials.role ?? ""}),
          redirect: "manual",
          signal: AbortSignal.timeout(7000)
        }
      );

      if (auth.ok) {
        const result = await auth.json();

        if (
          typeof result.token === "string" &&
          result.token.length >= 20
        ) {
          const check = await fetch(
            "https://vendpay24.com/VendPayDeltaHeb/terminal/getOnline?lang=heb&apiloc=VendPayDeltaHeb",
            {
              headers: {
                "Authorization": "Bearer " + result.token,
                "Accept": "application/json, text/plain, */*"
              },
              redirect: "manual",
              signal: AbortSignal.timeout(7000)
            }
          );

          const checkBody = await check.text();
          let checkData: any;
          try { checkData = JSON.parse(checkBody); } catch {}
          connected = check.ok && !/^\s*</.test(checkBody) &&
            !/\b(unauthorized|forbidden|invalid token|token expired)\b/i.test(checkBody) &&
            !(checkData && (checkData.success === false || checkData.ok === false || checkData.error || checkData.status === "error"));
          reason = connected
            ? "connected"
            : "read_only_check_failed";


        } else {
          reason = "unexpected_auth_response";
        }
      } else {
        const responseType = auth.headers.get("content-type") ?? "";
        let safeCategory = "unknown";
        if (responseType.includes("json")) {
          try {
            const failure = await auth.json();
            const candidates = [
              failure?.code, failure?.error_code, failure?.statusCode,
              failure?.status, failure?.error?.code
            ];
            const safeCode = candidates.find(v => typeof v === "number" || (typeof v === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(v)));
            if (safeCode !== undefined) safeCategory = String(safeCode);
          } catch { safeCategory = "invalid_json"; }
        } else {
          await auth.body?.cancel();
        }
        reason = "authentication_http_" + auth.status +
          (responseType.includes("json") ? "_json" : responseType.includes("html") ? "_html" : "_other") +
          (safeCategory !== "unknown" ? "_" + safeCategory : "");
      }
    } catch {
      reason = "network_error";
    }

    const status = connected ? "connected" : "failed";
    const checkedAt = new Date().toISOString();

    const { error: updateError } = await admin
      .from("vendpay_tenants")
      .update({
        connection_status: status,
        last_checked_at: checkedAt
      })
      .eq("id", tenantId);

    if (updateError) {
      return reply({ error: "Unable to record check" }, 500);
    }

    await admin
      .from("vendpay_tenant_audit")
      .insert({
        tenant_id: tenantId,
        action: "check_connection",
        result: status
      });

    return reply({
      connected,
      status,
      checked_at: checkedAt,
      reason
    });
  }

  if (req.method === "POST" && new URL(req.url).searchParams.get("action") === "save_credentials") {
    let input: Record<string, unknown>;
    try { input = await req.json(); } catch { return reply({error:"Invalid JSON"},400); }
    const tenantId = input?.tenant_id;
    const username = input?.username;
    const password = input?.password;
    const code = input?.code;
    const rememberMe = input?.rememberMe ?? false;
    const role = input?.role ?? "";
    if (typeof tenantId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(tenantId) ||
        typeof username !== "string" || !username.trim() || username.length > 200 ||
        typeof password !== "string" || password.length > 500 ||
        typeof code !== "string" || code.length > 500 || (!password && !code) ||
        typeof rememberMe !== "boolean" || typeof role !== "string" || role.length > 100) {
      return reply({error:"Invalid credentials fields"},400);
    }
    const secret = Deno.env.get("VENDPAY_TENANT_ENCRYPTION_KEY") ?? "";
    if (!secret || secret.length !== 64) return reply({error:"Encryption key not configured"},503);
    const {data: tenant,error: tenantError} = await admin.from("vendpay_tenants").select("id").eq("id",tenantId).maybeSingle();
    if (tenantError) return reply({error:"Unable to verify customer"},500);
    if (!tenant) return reply({error:"Customer not found"},404);
    const key = await deriveTenantKey(secret, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(JSON.stringify({username:username.trim(),password,code,rememberMe,role}));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,payload));
    const encode = (arr:Uint8Array)=>btoa(Array.from(arr,b=>String.fromCharCode(b)).join(""));
    const {error:saveError}=await admin.from("vendpay_tenant_credentials").upsert({
      tenant_id:tenantId,ciphertext:encode(encrypted),iv:encode(iv),updated_at:new Date().toISOString()
    },{onConflict:"tenant_id"});
    if(saveError)return reply({error:"Unable to save credentials"},500);
    const {error:statusError}=await admin.from("vendpay_tenants").update({connection_status:"pending",last_checked_at:null}).eq("id",tenantId);
    if(statusError)return reply({error:"Credentials saved but status update failed"},500);
    await admin.from("vendpay_tenant_audit").insert({tenant_id:tenantId,action:"save_credentials",result:"pending"});
    return reply({saved:true,status:"pending"});
  }

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("vendpay_tenants")
      .select(
        "id, display_name, extension, is_active, connection_status, last_checked_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return reply(
        { error: "Unable to load customers" },
        500
      );
    }

    return reply({ tenants: data });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid JSON" }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return reply({ error: "Invalid data" }, 400);
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.display_name !== "string" ||
    typeof input.extension !== "string"
  ) {
    return reply({ error: "Invalid fields" }, 400);
  }

  const name = input.display_name.trim();
  const extension = input.extension.trim();

  if (
    name.length < 1 ||
    name.length > 120 ||
    !/^[0-9]{1,8}$/.test(extension)
  ) {
    return reply(
      { error: "Invalid name or extension" },
      400
    );
  }

  const { data, error } = await admin
    .from("vendpay_tenants")
    .insert({
      display_name: name,
      extension,
      is_active: false,
    })
    .select(
      "id, display_name, extension, is_active, created_at"
    )
    .single();

  if (error) {
    return reply(
      {
        error:
          error.code === "23505"
            ? "Extension already exists"
            : "Unable to create customer",
      },
      error.code === "23505" ? 409 : 500
    );
  }

  await admin
    .from("vendpay_tenant_audit")
    .insert({
      tenant_id: data.id,
      action: "create_tenant",
      result: "inactive",
    });

  return reply({ tenant: data }, 201);
});

