import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const FEATURE_KEY = "school_assessment_new";

const str = (value: unknown) => String(value ?? "").trim();
const sha256 = async (value: string) => Array.from(new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
)).map((x) => x.toString(16).padStart(2, "0")).join("");

const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }), {
  headers: { ...cors, "Content-Type": "application/json" },
});

const fail = (error: unknown, status = 400) => new Response(JSON.stringify({
  success: false,
  message: error instanceof Error ? error.message : String(error),
}), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function requireStudent(token: unknown) {
  const value = str(token);
  if (!value) throw new Error("학생 로그인이 필요합니다.");

  const { data: authData, error: authError } = await admin.auth.getUser(value);
  if (authError || !authData.user) throw new Error("학생 로그인이 만료되었습니다. 다시 로그인해주세요.");

  const tokenHash = await sha256(value);
  const { data: session, error: sessionError } = await admin.from("student_active_sessions")
    .select("token_hash,expires_at")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.token_hash !== tokenHash || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new Error("현재 기기의 로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.");
  }

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,enabled,role")
    .eq("id", authData.user.id)
    .single();
  if (profileError || !profile || !profile.enabled || profile.role !== "student") {
    throw new Error("사용할 수 없는 학생 계정입니다.");
  }
  return profile;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(new Error("POST 요청만 지원합니다."), 405);

  try {
    const body = await req.json();
    const action = str(body?.action);
    const student = await requireStudent(body?.token);

    if (action === "getSchoolAssessmentNewState") {
      const { data, error } = await admin.from("student_feature_views")
        .select("first_seen_at")
        .eq("user_id", student.id)
        .eq("feature_key", FEATURE_KEY)
        .maybeSingle();
      if (error) throw error;
      return ok({ seen: Boolean(data), firstSeenAt: data?.first_seen_at ?? null });
    }

    if (action === "markSchoolAssessmentNewSeen") {
      const { data, error } = await admin.from("student_feature_views")
        .upsert({ user_id: student.id, feature_key: FEATURE_KEY }, { onConflict: "user_id,feature_key", ignoreDuplicates: true })
        .select("first_seen_at")
        .single();
      if (error) throw error;
      return ok({ seen: true, firstSeenAt: data?.first_seen_at ?? null });
    }

    throw new Error("지원하지 않는 기능 상태 요청입니다.");
  } catch (error) {
    console.error(error);
    return fail(error);
  }
});
