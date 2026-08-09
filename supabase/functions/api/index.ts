import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const STUDENT_SESSION_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

type Json = Record<string, unknown>;
class StudentSessionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StudentSessionError";
    this.code = code;
  }
}
const ok = (result: unknown) =>
  new Response(JSON.stringify({ success: true, result }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
const fail = (e: unknown, status = 400) =>
  new Response(
    JSON.stringify({
      success: false,
      message: e instanceof Error ? e.message : String(e),
      code: e instanceof StudentSessionError ? e.code : undefined,
    }),
    { status, headers: { ...cors, "Content-Type": "application/json" } },
  );
const str = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown, fallback = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;
const uuid = () => crypto.randomUUID();
const KOREA_TIME_ZONE = "Asia/Seoul";
const koreaParts = (value: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
};
const koreaDateKey = (value: Date = new Date()) => {
  const p = koreaParts(value);
  return `${p.year}-${p.month}-${p.day}`;
};
const koreaYear = () => Number(koreaParts().year);
const koreaMonthStartIso = () => {
  const p = koreaParts();
  return new Date(`${p.year}-${p.month}-01T00:00:00+09:00`).toISOString();
};
const formatKoreaDate = (value: unknown, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    ...options,
  }).format(new Date(str(value)));
const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ).map((x) => x.toString(16).padStart(2, "0")).join("");
const studentEmail = (id: string) =>
  `${id.toLowerCase().replace(/[^a-z0-9._-]/g, "-")}@student.hansalmae.local`;
const koreaDateTime = (value: unknown) => {
  const raw = str(value);
  if (!raw) return null;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}:00+09:00`;
  const parsed = new Date(zoned);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("시험 시작·마감 시간을 확인해주세요.");
  }
  return parsed.toISOString();
};

function configureWebPush() {
  const publicKey = str(Deno.env.get("VAPID_PUBLIC_KEY"));
  const privateKey = str(Deno.env.get("VAPID_PRIVATE_KEY"));
  const subject = str(Deno.env.get("VAPID_SUBJECT")) || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendPushToStudents(userIds: string[], payload: Json) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length || !configureWebPush()) {
    return { sent: 0, failed: 0, configured: false };
  }
  const { data: subscriptions, error } = await admin
    .from("student_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", ids).eq("enabled", true);
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  await Promise.all((subscriptions ?? []).map(async (subscription: any) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), { TTL: 86400, urgency: "high" });
      sent++;
      await admin.from("student_push_subscriptions").update({
        last_success_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", subscription.id);
    } catch (pushError: any) {
      failed++;
      const statusCode = num(pushError?.statusCode);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("student_push_subscriptions").delete().eq(
          "id",
          subscription.id,
        );
      } else {
        await admin.from("student_push_subscriptions").update({
          last_error: str(pushError?.message).slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq("id", subscription.id);
      }
    }
  }));
  return { sent, failed, configured: true };
}

async function recordDailyActivity(userId: string) {
  await admin.from("student_daily_activity").upsert({
    user_id: userId,
    activity_date: koreaDateKey(),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "user_id,activity_date" });
}

async function profileFromToken(token: unknown) {
  const value = str(token);
  if (!value) {
    throw new StudentSessionError("NO_SESSION", "로그인 정보가 없습니다.");
  }
  const { data, error } = await admin.auth.getUser(value);
  if (error || !data.user) {
    throw new StudentSessionError(
      "SESSION_EXPIRED",
      "로그인 정보가 만료되었습니다. 다시 로그인해주세요.",
    );
  }
  const tokenHash = await sha256(value);
  const { data: activeSession, error: sessionError } = await admin
    .from("student_active_sessions")
    .select("token_hash,expires_at,last_seen_at")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!activeSession) {
    // 기능 배포 전에 로그인되어 있던 계정은 첫 요청의 기기를 활성 기기로 등록합니다.
    const expiresAt = new Date(Date.now() + 55 * 60000).toISOString();
    const { error: bootstrapError } = await admin.from("student_active_sessions")
      .upsert({
        user_id: data.user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (bootstrapError) throw bootstrapError;
  } else {
    if (new Date(activeSession.expires_at).getTime() <= Date.now()) {
      await admin.from("student_active_sessions").delete().eq(
        "user_id",
        data.user.id,
      );
      throw new StudentSessionError(
        "SESSION_EXPIRED",
        "로그인 정보가 만료되었습니다. 다시 로그인해주세요.",
      );
    }
    if (activeSession.token_hash !== tokenHash) {
      throw new StudentSessionError(
        "LOGGED_IN_FROM_ANOTHER_DEVICE",
        "다른 기기에서 로그인되어 현재 기기의 접속이 종료되었습니다.",
      );
    }
    const lastSeen = new Date(activeSession.last_seen_at ?? 0).getTime();
    if (!lastSeen || Date.now() - lastSeen >= 5 * 60 * 1000) {
      await admin.from("student_active_sessions").update({
        last_seen_at: new Date().toISOString(),
      }).eq("user_id", data.user.id).eq("token_hash", tokenHash);
    }
  }
  const { data: profile } = await admin.from("profiles").select("*").eq(
    "id",
    data.user.id,
  ).single();
  if (!profile?.enabled) {
    throw new StudentSessionError("ACCOUNT_DISABLED", "현재 사용할 수 없는 계정입니다.");
  }
  return profile;
}

async function requireStaff(token: unknown) {
  const hash = await sha256(str(token));
  const { data } = await admin.from("admin_sessions").select("expires_at").eq(
    "token_hash",
    hash,
  ).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("관리자 로그인이 만료되었습니다. 다시 로그인해주세요.");
  }
}

async function checkAdminLoginRateLimit(clientKey: string) {
  const keyHash = await sha256(clientKey || "unknown");
  const { data } = await admin.from("admin_login_attempts").select("*").eq(
    "key_hash",
    keyHash,
  ).maybeSingle();
  if (data?.locked_until && new Date(data.locked_until).getTime() > Date.now()) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 60000),
    );
    throw new Error(`로그인 시도가 너무 많습니다. ${minutes}분 후 다시 시도해주세요.`);
  }
  return { keyHash, attempts: num(data?.attempts) };
}

async function recordAdminLoginFailure(keyHash: string, attempts: number) {
  const next = attempts + 1;
  const lockedUntil = next >= 5
    ? new Date(Date.now() + 15 * 60000).toISOString()
    : null;
  await admin.from("admin_login_attempts").upsert({
    key_hash: keyHash,
    attempts: lockedUntil ? 0 : next,
    locked_until: lockedUntil,
    last_attempt_at: new Date().toISOString(),
  }, { onConflict: "key_hash" });
  if (lockedUntil) {
    throw new Error("로그인에 5회 실패하여 15분 동안 잠겼습니다.");
  }
}

function studentView(p: any) {
  const year = koreaYear();
  const grades = ["중1", "중2", "중3", "고1", "고2", "고3", "졸업"];
  const start = grades.indexOf(str(p.base_grade).replace(/\s/g, ""));
  const grade = start < 0 || !p.base_year ? p.base_grade : grades[
    Math.min(
      start + Math.max(year - Number(p.base_year), 0),
      grades.length - 1,
    )
  ];
  return {
    studentId: p.student_id,
    studentName: p.display_name,
    grade,
    baseGrade: p.base_grade,
    baseYear: p.base_year,
    mustChangePassword: Boolean(p.must_change_password),
  };
}

async function backupAllRows(
  table: string,
  select = "*",
  orderColumns: string[] = ["id"],
) {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0;; from += pageSize) {
    let query: any = admin.from(table).select(select);
    for (const column of orderColumns) {
      query = query.order(column, { ascending: true });
    }
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`${table} 백업 중 오류가 발생했습니다: ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function signupStudent(args: unknown[]) {
  const input = (args[0] ?? {}) as Json;
  const id = str(input.studentId ?? args[0]).toLowerCase();
  const password = str(input.password ?? args[1]);
  const name = str(input.studentName ?? input.name ?? args[2]);
  const grade = str(input.baseGrade ?? input.grade ?? args[3]);
  const year = num(input.baseYear ?? args[4], koreaYear());
  const signupCode = str(input.signupCode);
  if (!/^[a-z0-9._-]{3,30}$/.test(id)) {
    throw new Error("학생ID는 영문 소문자와 숫자 3~30자로 입력해주세요.");
  }
  if (password.length < 6) throw new Error("비밀번호는 6자 이상 입력해주세요.");
  if (!name) throw new Error("학생 이름을 입력해주세요.");
  if (
    !Deno.env.get("SIGNUP_CODE") ||
    signupCode !== str(Deno.env.get("SIGNUP_CODE"))
  ) return { success: false, message: "가입코드가 올바르지 않습니다." };
  const { data: exists } = await admin.from("profiles").select("id").eq(
    "student_id",
    id,
  ).maybeSingle();
  if (exists) {
    return { success: false, message: "이미 사용 중인 학생ID입니다." };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: studentEmail(id),
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("계정을 만들 수 없습니다.");
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    student_id: id,
    display_name: name,
    base_grade: grade,
    base_year: year,
    role: "student",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }
  await admin.from("student_experience").insert({ user_id: data.user.id });
  await admin.from("vocabulary_books").insert({
    user_id: data.user.id,
    name: "기본 단어장",
    is_default: true,
  });
  return {
    success: true,
    studentId: id,
    message: "회원가입이 완료되었습니다.",
  };
}

async function studentLogin(args: unknown[]) {
  const id = str(args[0]).toLowerCase(), password = str(args[1]);
  const replaceExisting = args[2] === true;
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: studentEmail(id),
    password,
  });
  if (error || !data.session) {
    return {
      success: false,
      message: "학생ID 또는 비밀번호가 올바르지 않습니다.",
    };
  }
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("*").eq("id", data.user.id).single();
  if (profileError || !profile?.enabled) {
    return { success: false, code: "ACCOUNT_DISABLED", message: "현재 사용할 수 없는 계정입니다." };
  }
  const { data: activeSession, error: activeError } = await admin
    .from("student_active_sessions")
    .select("expires_at")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (activeError) throw activeError;
  const activeSessionExists = activeSession &&
    new Date(activeSession.expires_at).getTime() > Date.now();
  if (activeSessionExists && !replaceExisting) {
    return {
      success: false,
      code: "ACTIVE_SESSION_EXISTS",
      message: "다른 기기에서 로그인 중입니다.",
    };
  }
  const expiresAt = data.session.expires_at
    ? new Date(data.session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 55 * 60000).toISOString();
  const { error: saveSessionError } = await admin.from("student_active_sessions")
    .upsert({
      user_id: profile.id,
      token_hash: await sha256(data.session.access_token),
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  if (saveSessionError) throw saveSessionError;
  await recordDailyActivity(profile.id);
  return {
    success: true,
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    student: studentView(profile),
  };
}

async function refreshStudentSession(args: unknown[]) {
  const oldAccessToken = str(args[0]);
  const refreshToken = str(args[1]);
  if (!oldAccessToken || !refreshToken) {
    throw new StudentSessionError("SESSION_EXPIRED", "로그인 갱신 정보가 없습니다.");
  }
  const oldHash = await sha256(oldAccessToken);
  const { data: activeSession, error: activeError } = await admin
    .from("student_active_sessions")
    .select("user_id,last_seen_at")
    .eq("token_hash", oldHash)
    .maybeSingle();
  if (activeError) throw activeError;
  if (!activeSession) {
    throw new StudentSessionError(
      "LOGGED_IN_FROM_ANOTHER_DEVICE",
      "다른 기기에서 로그인되어 현재 기기의 접속이 종료되었습니다.",
    );
  }
  const lastSeenAt = new Date(activeSession.last_seen_at ?? 0).getTime();
  if (!lastSeenAt || Date.now() - lastSeenAt > STUDENT_SESSION_INACTIVITY_MS) {
    await admin.from("student_active_sessions").delete().eq("token_hash", oldHash);
    throw new StudentSessionError(
      "SESSION_EXPIRED",
      "30일 동안 사용하지 않아 로그인이 만료되었습니다. 다시 로그인해주세요.",
    );
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error || !data.session || !data.user) {
    throw new StudentSessionError(
      "SESSION_EXPIRED",
      "로그인 정보가 만료되었습니다. 다시 로그인해주세요.",
    );
  }
  const expiresAt = data.session.expires_at
    ? new Date(data.session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 55 * 60000).toISOString();
  const { data: replaced, error: replaceError } = await admin
    .from("student_active_sessions")
    .update({
      token_hash: await sha256(data.session.access_token),
      expires_at: expiresAt,
      last_seen_at: new Date().toISOString(),
    })
    .eq("user_id", data.user.id)
    .eq("token_hash", oldHash)
    .select("user_id")
    .maybeSingle();
  if (replaceError) throw replaceError;
  if (!replaced) {
    throw new StudentSessionError(
      "LOGGED_IN_FROM_ANOTHER_DEVICE",
      "다른 기기에서 로그인되어 현재 기기의 접속이 종료되었습니다.",
    );
  }
  return {
    success: true,
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  };
}

async function wordSetByName(name: unknown) {
  const { data } = await admin.from("word_sets").select("id,name").eq(
    "name",
    str(name),
  ).maybeSingle();
  if (!data) throw new Error(`단어 DB를 찾을 수 없습니다: ${str(name)}`);
  return data;
}

async function getAllDays(wordSetId: string) {
  const days: number[] = [];
  const pageSize = 1000;
  for (let from = 0;; from += pageSize) {
    const { data, error } = await admin
      .from("words")
      .select("day")
      .eq("word_set_id", wordSetId)
      .order("day")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    days.push(...page.map((row) => row.day));
    if (page.length < pageSize) break;
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

async function getWords(args: unknown[], vocabulary = false) {
  const set = await wordSetByName(args[0]);
  const start = num(args[1]), end = vocabulary ? start : num(args[2], start);
  const { data, error } = await admin.from("words").select(
    "day,word,meaning,example,translation,example_answer",
  ).eq("word_set_id", set.id).gte("day", start).lte("day", end).order("day")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((w) => ({
    day: w.day,
    word: w.word,
    meaning: w.meaning,
    example: w.example,
    translation: w.translation,
    exampleAnswer: w.example_answer,
  }));
}

async function saveResult(token: unknown, result: any) {
  const p = await profileFromToken(token);
  const setName = str(result.sheetName ?? result.dbName ?? result.wordType);
  const { data: set } = setName
    ? await admin.from("word_sets").select("id").eq("name", setName)
      .maybeSingle()
    : { data: null };
  const count = num(
    result.questionCount ?? result.totalQuestions ?? result.problemCount,
  );
  const correct = num(result.correctCount ?? result.correctAnswers);
  const score = num(
    result.score,
    count ? Math.round(correct / count * 100) : 0,
  );
  const id = uuid();
  const earned = Math.max(0, Math.round(count * score / 100));
  const points = num(result.points, earned);
  const grade = str(result.grade) ||
    (score >= 100
      ? "S"
      : score >= 90
      ? "A"
      : score >= 80
      ? "B"
      : score >= 70
      ? "C"
      : "D");
  const row = {
    id,
    user_id: p.id,
    test_kind: str(result.testKind ?? result.examType ?? "free"),
    teacher_exam_id: result.examId || null,
    word_set_id: set?.id ?? null,
    start_day: num(result.startDay) || null,
    end_day: num(result.endDay ?? result.lastDay) || null,
    question_type: str(result.questionType),
    question_count: count,
    correct_count: correct,
    score,
    grade,
    points,
    attempt: num(result.attempt, 1),
    raw_result: result,
  };
  const wrongs = Array.isArray(result.wrongWords)
    ? result.wrongWords
    : Array.isArray(result.incorrectWords)
    ? result.incorrectWords
    : [];
  const atomicResult = {
    ...row,
    raw_result: result,
  };
  const atomicWrongs = wrongs.map((w: any) => ({
    word_set_id: set?.id ?? null,
    day: num(w.day) || null,
    word: str(w.word ?? w.english),
    meaning: str(w.meaning),
    example: str(w.example),
    translation: str(w.translation),
  })).filter((w: any) => Boolean(w.word));
  const payoutKey = row.test_kind === "teacher" && row.teacher_exam_id
    ? `teacher:${p.id}:${row.teacher_exam_id}:${row.attempt}`
    : `test:${id}`;
  const { data: saved, error } = await admin.rpc(
    "save_student_test_result_atomic",
    {
      p_user_id: p.id,
      p_test_id: id,
      p_result: atomicResult,
      p_wrongs: atomicWrongs,
      p_earned_xp: earned,
      p_payout_key: payoutKey,
    },
  );
  if (error) throw error;
  const emblemState: any = await dispatch("getStudentEmblems", [str(token)], {});
  const experience = emblemState?.experience ?? await experienceView(p.id);
  return {
    success: true,
    testResultId: id,
    score,
    correctCount: correct,
    questionCount: count,
    totalCount: count,
    points,
    point: points,
    grade,
    earnedXp: earned,
    savedWrongWordCount: num(saved?.saved_wrong_count, atomicWrongs.length),
    wrongCount: wrongs.length,
    experience: {
      ...experience,
      earnedXp: earned,
      newlyGrantedEmblems: emblemState?.newlyGrantedEmblems ?? [],
    },
  };
}

async function grantXp(
  userId: string,
  amount: number,
  payoutKey: string,
  meta: any,
) {
  const { data: prior } = await admin.from("experience_logs").select(
    "id,total_after",
  ).eq("payout_key", payoutKey).maybeSingle();
  if (prior) return prior.total_after;
  const { data: current } = await admin.from("student_experience").select(
    "total_xp",
  ).eq("user_id", userId).maybeSingle();
  const total = num(current?.total_xp) + amount;
  const { data: level } = await admin.from("level_settings").select(
    "level,title",
  ).lte("required_xp", total).order("required_xp", { ascending: false }).limit(
    1,
  ).single();
  await admin.from("student_experience").upsert({
    user_id: userId,
    total_xp: total,
    level: level?.level ?? 1,
    title: level?.title ?? "새싹 학습자",
    last_earned_at: new Date().toISOString(),
  });
  await admin.from("experience_logs").insert({
    user_id: userId,
    earned_xp: amount,
    total_after: total,
    payout_key: payoutKey,
    ...meta,
  });
  return total;
}

async function experienceView(userId: string) {
  const { data: xp } = await admin.from("student_experience").select("*").eq(
    "user_id",
    userId,
  ).maybeSingle();
  const totalXp = num(xp?.total_xp);
  const { data: current } = await admin.from("level_settings").select(
    "level,required_xp,title",
  ).lte("required_xp", totalXp).order("required_xp", { ascending: false })
    .limit(1).maybeSingle();
  const level = num(current?.level, 1);
  const { data: next } = await admin.from("level_settings").select(
    "level,required_xp,title",
  ).gt("level", level).order("level").limit(1).maybeSingle();
  const floor = num(current?.required_xp);
  const ceiling = num(next?.required_xp, floor);
  const progressPercent = next
    ? Math.max(
      0,
      Math.min(
        100,
        Math.round((totalXp - floor) / Math.max(ceiling - floor, 1) * 100),
      ),
    )
    : 100;
  return {
    level,
    currentLevel: level,
    title: current?.title ?? xp?.title ?? "단어병아리",
    totalXp,
    currentLevelXp: floor,
    nextLevelXp: next?.required_xp ?? null,
    remainingXp: next ? Math.max(0, ceiling - totalXp) : 0,
    progressPercent,
    progress: progressPercent,
    maxLevel: !next,
  };
}

function attendanceStreak(rows: any[]) {
  const days = new Set((rows ?? []).map((x: any) => str(x.activity_date)));
  let cursor = new Date(`${koreaDateKey()}T00:00:00+09:00`);
  let streak = 0;
  while (days.has(koreaDateKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

function perfectTestStreak(rows: any[]) {
  let streak = 0;
  for (const row of rows ?? []) {
    if (num(row.question_count) < 100) continue;
    if (num(row.score) < 100) break;
    streak++;
  }
  return streak;
}

function allowedRankingCategory(grade: string, setName: string) {
  if (grade.includes("고")) return setName.includes("고등") || setName.includes("수능");
  if (grade.includes("중")) return setName.includes("중등");
  return true;
}

function eligibleFinalRankingWin(row: any) {
  if (!row?.finalized || num(row.rank) !== 1) return false;
  const category = str(row.category) || (str(row.word_sets?.name).includes("중등")
    ? "middle"
    : str(row.word_sets?.name).includes("고등")
    ? "high"
    : str(row.word_sets?.name).includes("수능") ? "csat" : "");
  const gradeGroup = str(row.winner_grade_group);
  return gradeGroup === "middle"
    ? category === "middle"
    : gradeGroup === "high"
    ? category === "high" || category === "csat"
    : false;
}

function consecutiveMonthlyWins(rows: any[]) {
  const groups = new Map<string, number[]>();
  for (const row of rows ?? []) {
    if (!eligibleFinalRankingWin(row)) continue;
    const setName = str(row.word_sets?.name);
    const month = str(row.month).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const category = setName.includes("중등")
      ? "middle"
      : setName.includes("고등")
      ? "high"
      : setName.includes("수능")
      ? "csat"
      : setName;
    const number = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
    groups.set(category, [...(groups.get(category) ?? []), number]);
  }
  let best = 0;
  for (const values of groups.values()) {
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    let streak = sorted.length ? 1 : 0;
    best = Math.max(best, streak);
    for (let i = 1; i < sorted.length; i++) {
      streak = sorted[i] === sorted[i - 1] + 1 ? streak + 1 : 1;
      best = Math.max(best, streak);
    }
  }
  return best;
}

function wrongWordView(x: any) {
  return {
    rowNumber: x.public_id,
    id: x.id,
    sheetName: x.word_sets?.name ?? "",
    rawSheetName: x.word_sets?.name ?? "",
    day: x.day,
    word: x.word,
    meaning: x.meaning,
    example: x.example,
    translation: x.translation,
    wrongCount: x.wrong_count,
    firstWrongDate: x.first_wrong_at,
    lastWrongDate: x.last_wrong_at,
    mastered: x.mastered,
  };
}

function vocabularyItemView(x: any) {
  return {
    rowNumber: x.public_id,
    id: x.id,
    bookId: x.book_id,
    sheetName: x.word_sets?.name ?? "",
    day: x.day,
    word: x.word,
    meaning: x.meaning,
    example: x.example,
    translation: x.translation,
    mastered: x.mastered,
    registeredAt: x.created_at,
    registeredDate: formatKoreaDate(x.created_at, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
  };
}

function shuffle<T>(values: T[]) {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function spreadWordsAcrossDays(words: any[]) {
  const grouped = new Map<string, any[]>();
  for (const word of words) {
    const key = word.day === null || word.day === undefined
      ? "manual"
      : `day:${word.day}`;
    const group = grouped.get(key) ?? [];
    group.push(word);
    grouped.set(key, group);
  }
  const queues = shuffle([...grouped.values()]).map((group) => shuffle(group));
  const result: any[] = [];
  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of shuffle(queues.filter((item) => item.length > 0))) {
      const word = queue.shift();
      if (word) result.push(word);
    }
  }
  return result;
}

function teacherQuestions(words: any[], questionType: string) {
  const enabled = words.filter((x: any) => x.enabled).sort((a: any, b: any) =>
    a.position - b.position
  );
  return enabled.map((w: any, index: number) => {
    const mixed = questionType === "mixed";
    const random = questionType === "random";
    const randomModes = ["englishToMeaning", "meaningToEnglish", "exampleBlank"];
    const randomMode = randomModes[index % randomModes.length];
    const mode = random
      ? (randomMode === "exampleBlank" && !w.example
        ? "englishToMeaning"
        : randomMode)
      : questionType === "korToEng" || questionType.includes("뜻→") ||
          (mixed && index % 2 === 1)
      ? "meaningToEnglish"
      : questionType === "example" || questionType.includes("예문")
      ? "exampleBlank"
      : "englishToMeaning";
    const correct = mode === "meaningToEnglish" || mode === "exampleBlank"
      ? w.word
      : w.meaning;
    const pool = enabled.map((x: any) =>
      mode === "meaningToEnglish" || mode === "exampleBlank"
        ? x.word
        : x.meaning
    ).filter((x: string) => x && x !== correct);
    const options = shuffle([
      correct,
      ...shuffle([...new Set(pool)]).slice(0, 3),
    ]);
    const prompt = mode === "meaningToEnglish"
      ? w.meaning
      : mode === "exampleBlank"
      ? (w.example
        ? w.example.replace(new RegExp(w.word, "ig"), "____")
        : w.meaning)
      : w.word;
    return {
      questionId: String(w.position ?? index + 1),
      mode,
      prompt,
      example: "",
      options,
      correctAnswer: correct,
      english: w.word,
      meaning: w.meaning,
      day: w.day,
      translation: w.translation,
    };
  });
}

function legacyExamView(x: any) {
  return {
    "시험ID": x.id,
    "시험제목": x.title,
    "출제방식": x.source_type,
    "DB명": x.word_sets?.name ?? "",
    "시작Day": x.start_day ?? "",
    "마지막Day": x.end_day ?? "",
    "문제수": x.question_count,
    "문제유형": x.question_type,
    "대상구분": x.target_type,
    "대상값": Array.isArray(x.target_value)
      ? x.target_value.join(",")
      : x.target_value,
    "시작일시": x.starts_at,
    "마감일시": x.ends_at,
    "기준점수": x.passing_score,
    "재시험허용": x.allow_retake,
    "포인트지급": x.award_points,
    "상태": x.status === "cancelled" ? "취소" : "공개",
    "생성일시": x.created_at,
    "생성자": x.creator_name ?? "관리자",
  };
}

function legacyExamWordView(x: any) {
  return {
    "번호": x.position,
    "출처": x.source,
    "Day": x.day ?? "",
    "영어": x.word,
    "뜻": x.meaning,
    "예문": x.example,
    "해석": x.translation,
    "사용여부": x.enabled,
  };
}

async function listBooks(p: any) {
  const { data } = await admin.from("vocabulary_books").select(
    "id,name,is_default,created_at,updated_at,vocabulary_items(count)",
  ).eq("user_id", p.id).order("created_at");
  return (data ?? []).map((b: any) => ({
    bookId: b.id,
    name: b.name,
    bookName: b.name,
    isDefault: b.is_default,
    wordCount: b.vocabulary_items?.[0]?.count ?? 0,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  }));
}

async function personalItem(input: any, p: any, bookId?: unknown) {
  let target = str(bookId);
  if (!target) {
    const { data } = await admin.from("vocabulary_books").select("id").eq(
      "user_id",
      p.id,
    ).eq("is_default", true).single();
    target = data.id;
  }
  const setName = str(input.sheetName ?? input.dbName ?? input.wordType);
  const { data: set } = setName
    ? await admin.from("word_sets").select("id").eq("name", setName)
      .maybeSingle()
    : { data: null };
  return {
    user_id: p.id,
    book_id: target,
    word_set_id: set?.id ?? null,
    day: num(input.day) || null,
    word: str(input.word ?? input.english),
    meaning: str(input.meaning),
    example: str(input.example),
    translation: str(input.translation ?? input.exampleTranslation),
  };
}

async function dispatch(
  name: string,
  args: unknown[],
  context: { clientKey?: string } = {},
) {
  switch (name) {
    case "signupStudent":
      return signupStudent(args);
    case "checkStudentIdDuplicate": {
      const studentId = str(args[0]).toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(studentId)) {
        return {
          available: false,
          message: "학생 아이디는 영문 소문자와 숫자 3~30자로 입력해주세요.",
        };
      }
      const { data } = await admin.from("profiles").select("id").eq(
        "student_id",
        studentId,
      ).maybeSingle();
      return data
        ? { available: false, message: "이미 사용 중인 아이디입니다." }
        : { available: true, message: "사용할 수 있는 아이디입니다." };
    }
    case "studentLogin":
      return studentLogin(args);
    case "studentRefreshSession":
      return refreshStudentSession(args);
    case "checkStudentSession": {
      try {
        const p = await profileFromToken(args[0]);
        await recordDailyActivity(p.id);
        return { success: true, student: studentView(p) };
      } catch (e) {
        return {
          success: false,
          code: e instanceof StudentSessionError ? e.code : "INVALID_SESSION",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    }
    case "studentLogout": {
      const tokenHash = await sha256(str(args[0]));
      await admin.from("student_active_sessions").delete().eq(
        "token_hash",
        tokenHash,
      );
      return { success: true };
    }
    case "studentGetPushPublicKey": {
      await profileFromToken(args[0]);
      const publicKey = str(Deno.env.get("VAPID_PUBLIC_KEY"));
      if (!publicKey) throw new Error("푸시 알림 서버 설정이 아직 완료되지 않았습니다.");
      return { success: true, publicKey };
    }
    case "studentSavePushSubscription": {
      const p = await profileFromToken(args[0]);
      const subscription: any = args[1] ?? {};
      const endpoint = str(subscription.endpoint);
      const p256dh = str(subscription.keys?.p256dh);
      const auth = str(subscription.keys?.auth);
      if (!endpoint || !p256dh || !auth) throw new Error("푸시 알림 구독 정보가 올바르지 않습니다.");
      const { error } = await admin.from("student_push_subscriptions").upsert({
        user_id: p.id, endpoint, p256dh, auth,
        user_agent: str(args[2]).slice(0, 500), enabled: true,
        updated_at: new Date().toISOString(), last_error: null,
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return { success: true, message: "이 기기의 앱 푸시 알림이 켜졌습니다." };
    }
    case "studentDeletePushSubscription": {
      const p = await profileFromToken(args[0]);
      const endpoint = str(args[1]);
      if (endpoint) {
        const { error } = await admin.from("student_push_subscriptions").delete()
          .eq("user_id", p.id).eq("endpoint", endpoint);
        if (error) throw error;
      }
      return { success: true, message: "이 기기의 앱 푸시 알림이 꺼졌습니다." };
    }
    case "studentChangePassword": {
      const p = await profileFromToken(args[0]);
      const currentPassword = str(args[1]);
      const newPassword = str(args[2]);
      if (newPassword.length < 8) {
        throw new Error("새 비밀번호는 8자 이상이어야 합니다.");
      }
      if (currentPassword === newPassword) {
        throw new Error("현재 비밀번호와 다른 비밀번호를 입력해주세요.");
      }
      const verifyClient = createClient(url, anonKey, {
        auth: { persistSession: false },
      });
      const { error: verifyError } = await verifyClient.auth.signInWithPassword({
        email: studentEmail(str(p.student_id)),
        password: currentPassword,
      });
      if (verifyError) throw new Error("현재 비밀번호가 올바르지 않습니다.");
      const { error } = await admin.auth.admin.updateUserById(p.id, {
        password: newPassword,
      });
      if (error) throw error;
      const { error: auditError } = await admin.from("password_change_audit").insert({
        user_id: p.id,
        change_type: "self_change",
      });
      if (auditError) console.warn("password audit failed", auditError.message);
      const { error: flagError } = await admin.from("profiles").update({
        must_change_password: false,
      }).eq("id", p.id);
      if (flagError) throw flagError;
      return { success: true, message: "비밀번호가 변경되었습니다." };
    }
    case "studentCompleteForcedPasswordChange": {
      const p = await profileFromToken(args[0]);
      const newPassword = str(args[1]);
      if (!p.must_change_password) {
        throw new Error("비밀번호 변경 대상 계정이 아닙니다.");
      }
      if (newPassword.length < 8) {
        throw new Error("새 비밀번호는 8자 이상이어야 합니다.");
      }
      const { error } = await admin.auth.admin.updateUserById(p.id, {
        password: newPassword,
      });
      if (error) throw error;
      const { error: flagError } = await admin.from("profiles").update({
        must_change_password: false,
      }).eq("id", p.id);
      if (flagError) throw flagError;
      const { error: auditError } = await admin.from("password_change_audit").insert({
        user_id: p.id,
        change_type: "forced_change",
      });
      if (auditError) console.warn("password audit failed", auditError.message);
      return { success: true, message: "새 비밀번호가 저장되었습니다." };
    }
    case "claimDailyAttendanceBonus": {
      const p = await profileFromToken(args[0]);
      const day = koreaDateKey();
      const key = `attendance:${p.id}:${day}`;
      const { data: prior } = await admin.from("bonus_xp_logs").select(
        "xp,total_after",
      ).eq("payout_key", key).maybeSingle();
      if (prior) {
        return {
          success: true,
          alreadyClaimed: true,
          xp: 0,
          totalXp: prior.total_after,
        };
      }
      const total = await grantXp(p.id, 10, key, {
        test_kind: "attendance",
        question_count: 0,
        score: 0,
      });
      await admin.from("bonus_xp_logs").insert({
        user_id: p.id,
        bonus_type: "attendance",
        xp: 10,
        payout_key: key,
        total_after: total,
      });
      const emblemState: any = await dispatch(
        "getStudentEmblems",
        [str(args[0])],
        context,
      );
      return {
        success: true,
        alreadyClaimed: false,
        xp: 10,
        earnedXp: 10,
        totalXp: emblemState?.experience?.totalXp ?? total,
        achievements: emblemState?.newlyGrantedEmblems ?? [],
      };
    }
    case "checkAdminCode":
      return str(args[0]) === str(Deno.env.get("ADMIN_CODE"));
    case "adminLogin": {
      const rate = await checkAdminLoginRateLimit(context.clientKey ?? "unknown");
      if (str(args[0]) !== str(Deno.env.get("ADMIN_CODE"))) {
        await recordAdminLoginFailure(rate.keyHash, rate.attempts);
        throw new Error("관리자 코드가 올바르지 않습니다.");
      }
      await admin.from("admin_login_attempts").delete().eq("key_hash", rate.keyHash);
      const token = uuid() + uuid();
      await admin.from("admin_sessions").insert({
        token_hash: await sha256(token),
        expires_at: new Date(Date.now() + 8 * 3600000).toISOString(),
      });
      return {
        success: true,
        token,
        expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
      };
    }
    case "teacherResetStudentPassword": {
      await requireStaff(args[0]);
      const studentId = str(args[1]).toLowerCase();
      const newPassword = str(args[2]);
      if (newPassword.length < 8) {
        throw new Error("임시 비밀번호는 8자 이상이어야 합니다.");
      }
      const { data: student } = await admin.from("profiles").select("id,display_name")
        .eq("student_id", studentId).eq("role", "student").maybeSingle();
      if (!student) throw new Error("학생 계정을 찾을 수 없습니다.");
      const { error } = await admin.auth.admin.updateUserById(student.id, {
        password: newPassword,
      });
      if (error) throw error;
      const { error: flagError } = await admin.from("profiles").update({
        must_change_password: true,
      }).eq("id", student.id);
      if (flagError) throw flagError;
      const { error: auditError } = await admin.from("password_change_audit").insert({
        user_id: student.id,
        change_type: "teacher_reset",
      });
      if (auditError) console.warn("password audit failed", auditError.message);
      return {
        success: true,
        message: `${student.display_name} 학생의 임시 비밀번호를 설정했습니다.`,
      };
    }
    case "teacherExportBackup": {
      await requireStaff(args[0]);
      const entries = await Promise.all([
        backupAllRows("profiles"),
        backupAllRows("word_sets"),
        backupAllRows("words"),
        backupAllRows("test_results"),
        backupAllRows("wrong_words"),
        backupAllRows("vocabulary_books"),
        backupAllRows("vocabulary_items"),
        backupAllRows("student_experience", "*", ["user_id"]),
        backupAllRows("experience_logs"),
        backupAllRows("bonus_xp_logs"),
        backupAllRows("student_emblems", "*", ["user_id", "emblem_id"]),
        backupAllRows("emblem_settings"),
        backupAllRows("level_settings", "*", ["level"]),
        backupAllRows("monthly_ranking_history", "*", ["month", "word_set_id", "user_id"]),
        backupAllRows("student_daily_activity", "*", ["activity_date", "user_id"]),
        backupAllRows("teacher_exams"),
        backupAllRows("teacher_exam_words", "*", ["exam_id", "position"]),
        backupAllRows("exam_assignments", "*", ["exam_id", "user_id"]),
        backupAllRows("exam_progress"),
        backupAllRows("notifications"),
      ]);
      const names = [
        "students", "wordSets", "words", "testResults", "wrongWords",
        "vocabularyBooks", "vocabularyItems", "studentExperience",
        "experienceLogs", "bonusXpLogs", "studentEmblems", "emblemSettings",
        "levelSettings", "monthlyRankingHistory", "studentDailyActivity",
        "teacherExams", "teacherExamWords", "examAssignments", "examProgress",
        "notifications",
      ];
      const data = Object.fromEntries(names.map((name, index) => [name, entries[index]]));
      const counts = Object.fromEntries(names.map((name, index) => [name, entries[index].length]));
      return {
        success: true,
        backupVersion: 2,
        complete: true,
        scope: "public application data",
        excluded: ["Supabase Auth password hashes", "API keys and secrets"],
        exportedAt: new Date().toISOString(),
        timeZone: KOREA_TIME_ZONE,
        counts,
        data,
      };
    }
    case "adminLogout": {
      await admin.from("admin_sessions").delete().eq(
        "token_hash",
        await sha256(str(args[0])),
      );
      return { success: true };
    }
    case "getSheetNames": {
      const { data } = await admin.from("word_sets").select("name").eq(
        "enabled",
        true,
      ).order("sort_order");
      return (data ?? []).map((x) => x.name);
    }
    case "getDays": {
      const set = await wordSetByName(args[0]);
      return getAllDays(set.id);
    }
    case "getWords":
      return getWords(args);
    case "getVocabularyWords":
      return getWords(args, true);
    case "saveTestResult":
      return saveResult(args[0], args[1]);
    case "saveStudentTestProgress": {
      const p = await profileFromToken(args[0]);
      await admin.from("exam_progress").upsert({
        user_id: p.id,
        exam_id: null,
        scope_key: "free",
        progress: args[1] ?? {},
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      }, { onConflict: "user_id,scope_key" });
      return { success: true };
    }
    case "getStudentTestProgress": {
      const p = await profileFromToken(args[0]);
      const { data } = await admin.from("exam_progress").select(
        "progress,updated_at",
      ).eq("user_id", p.id).eq("scope_key", "free").maybeSingle();
      return data?.progress ?? null;
    }
    case "deleteStudentTestProgress": {
      const p = await profileFromToken(args[0]);
      await admin.from("exam_progress").delete().eq("user_id", p.id).eq(
        "scope_key",
        "free",
      );
      return { success: true };
    }
    case "getWrongNotebook": {
      const p = await profileFromToken(args[0]);
      const { data, error } = await admin.from("wrong_words").select(
        "*,word_sets(name)",
      ).eq("user_id", p.id).order("last_wrong_at", { ascending: false });
      if (error) throw error;
      const words = (data ?? []).map(wrongWordView);
      return {
        success: true,
        words,
        activeCount: words.filter((x: any) => !x.mastered).length,
        masteredCount: words.filter((x: any) => x.mastered).length,
        totalCount: words.length,
      };
    }
    case "getWrongNotebookCount": {
      const p = await profileFromToken(args[0]);
      const { data, error } = await admin.from("wrong_words").select("mastered")
        .eq("user_id", p.id);
      if (error) throw error;
      return {
        success: true,
        activeCount: (data ?? []).filter((x) => !x.mastered).length,
        masteredCount: (data ?? []).filter((x) => x.mastered).length,
        totalCount: data?.length ?? 0,
      };
    }
    case "setWrongWordMastered": {
      const p = await profileFromToken(args[0]);
      await admin.from("wrong_words").update({ mastered: Boolean(args[2]) }).eq(
        "public_id",
        num(args[1]),
      ).eq("user_id", p.id);
      return { success: true };
    }
    case "deleteMasteredWrongWord": {
      const p = await profileFromToken(args[0]);
      await admin.from("wrong_words").delete().eq("public_id", num(args[1])).eq(
        "user_id",
        p.id,
      ).eq("mastered", true);
      return { success: true };
    }
    case "deleteAllMasteredWrongWords": {
      const p = await profileFromToken(args[0]);
      await admin.from("wrong_words").delete().eq("user_id", p.id).eq(
        "mastered",
        true,
      );
      return { success: true };
    }
    case "deleteSelectedMasteredWrongWords": {
      const p = await profileFromToken(args[0]);
      await admin.from("wrong_words").delete().eq("user_id", p.id).eq(
        "mastered",
        true,
      ).in("public_id", (args[1] as unknown[])?.map((x) => num(x)) ?? []);
      return { success: true };
    }
    case "getVocabularyBooks": {
      const p = await profileFromToken(args[0]);
      return { success: true, books: await listBooks(p) };
    }
    case "createVocabularyBook": {
      const p = await profileFromToken(args[0]);
      const { data, error } = await admin.from("vocabulary_books").insert({
        user_id: p.id,
        name: str(args[1]),
      }).select().single();
      if (error) throw error;
      const emblemState: any = await dispatch(
        "getStudentEmblems",
        [str(args[0])],
        context,
      );
      return {
        success: true,
        bookId: data.id,
        book: { bookId: data.id, name: data.name, bookName: data.name },
        achievements: emblemState?.newlyGrantedEmblems ?? [],
      };
    }
    case "renameVocabularyBook": {
      const p = await profileFromToken(args[0]);
      await admin.from("vocabulary_books").update({ name: str(args[2]) }).eq(
        "id",
        str(args[1]),
      ).eq("user_id", p.id);
      return { success: true };
    }
    case "deleteVocabularyBook": {
      const p = await profileFromToken(args[0]);
      const { data } = await admin.from("vocabulary_books").select("is_default")
        .eq("id", str(args[1])).eq("user_id", p.id).single();
      if (data.is_default) throw new Error("기본 단어장은 삭제할 수 없습니다.");
      await admin.from("vocabulary_books").delete().eq("id", str(args[1])).eq(
        "user_id",
        p.id,
      );
      return { success: true };
    }
    case "getPersonalVocabularyByBook": {
      const p = await profileFromToken(args[0]);
      const { data, error } = await admin.from("vocabulary_items").select(
        "*,word_sets(name)",
      ).eq("user_id", p.id).eq("book_id", str(args[1])).order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      const words = (data ?? []).map(vocabularyItemView);
      return {
        success: true,
        words,
        activeCount: words.filter((x: any) => !x.mastered).length,
        masteredCount: words.filter((x: any) => x.mastered).length,
        totalCount: words.length,
      };
    }
    case "getPersonalVocabulary": {
      const p = await profileFromToken(args[0]);
      const books = await listBooks(p);
      const book = books.find((x: any) => x.isDefault) ?? books[0];
      args[1] = book?.bookId;
      return dispatch("getPersonalVocabularyByBook", args);
    }
    case "getPersonalVocabularyCount": {
      const p = await profileFromToken(args[0]);
      const { data, error } = await admin.from("vocabulary_items").select(
        "mastered",
      ).eq("user_id", p.id);
      if (error) throw error;
      return {
        success: true,
        activeCount: (data ?? []).filter((x) => !x.mastered).length,
        masteredCount: (data ?? []).filter((x) => x.mastered).length,
        totalCount: data?.length ?? 0,
      };
    }
    case "addPersonalVocabulary": {
      const p = await profileFromToken(args[0]);
      const row = await personalItem(args[1], p);
      const { error } = await admin.from("vocabulary_items").upsert(row, {
        onConflict: "user_id,book_id,word_set_id,day,word",
        ignoreDuplicates: true,
      });
      if (error) throw error;
      return { success: true };
    }
    case "addPersonalVocabularyToBook": {
      const p = await profileFromToken(args[0]);
      const row = await personalItem(args[2], p, args[1]);
      const { error } = await admin.from("vocabulary_items").upsert(row, {
        onConflict: "user_id,book_id,word_set_id,day,word",
        ignoreDuplicates: true,
      });
      if (error) throw error;
      return { success: true };
    }
    case "addPersonalVocabularyBatchToBook": {
      const p = await profileFromToken(args[0]);
      const rows = [];
      for (const x of (args[2] as any[] ?? [])) {
        rows.push(await personalItem(x, p, args[1]));
      }
      if (rows.length) {
        await admin.from("vocabulary_items").upsert(rows, {
          onConflict: "user_id,book_id,word_set_id,day,word",
          ignoreDuplicates: true,
        });
      }
      return { success: true, addedCount: rows.length };
    }
    case "removePersonalVocabulary": {
      const p = await profileFromToken(args[0]);
      await admin.from("vocabulary_items").delete().eq(
        "public_id",
        num(args[1]),
      ).eq("user_id", p.id);
      return { success: true };
    }
    case "setPersonalWordMastered": {
      const p = await profileFromToken(args[0]);
      await admin.from("vocabulary_items").update({
        mastered: Boolean(args[2]),
      }).eq("public_id", num(args[1])).eq("user_id", p.id);
      return { success: true };
    }
    case "movePersonalVocabularyToBook": {
      const p = await profileFromToken(args[0]);
      await admin.from("vocabulary_items").update({ book_id: str(args[2]) }).eq(
        "public_id",
        num(args[1]),
      ).eq("user_id", p.id);
      return { success: true };
    }
    case "movePersonalVocabularyBatchToBook": {
      const p = await profileFromToken(args[0]);
      await admin.from("vocabulary_items").update({ book_id: str(args[2]) }).in(
        "public_id",
        (args[1] as any[]).map((x) => num(x)),
      ).eq("user_id", p.id);
      return { success: true };
    }
    case "deletePersonalVocabularyBatch": {
      const p = await profileFromToken(args[0]);
      await admin.from("vocabulary_items").delete().in(
        "public_id",
        (args[1] as any[]).map((x) => num(x)),
      ).eq("user_id", p.id);
      return { success: true };
    }
    case "getSmartReviewWords": {
      const p = await profileFromToken(args[0]);
      const limit = Math.min(num(args[1], 20), 100);
      const { data, error } = await admin.from("wrong_words").select(
        "*,word_sets(name)",
      ).eq("user_id", p.id).eq("mastered", false).order("wrong_count", {
        ascending: false,
      }).limit(limit);
      if (error) throw error;
      return {
        success: true,
        words: (data ?? []).map((x: any) => ({
          ...wrongWordView(x),
          reason: x.wrong_count > 1
            ? `${x.wrong_count}회 틀린 단어`
            : "최근 틀린 단어",
        })),
      };
    }
    case "getStudentExperience": {
      const p = await profileFromToken(args[0]);
      return { success: true, experience: await experienceView(p.id) };
    }
    case "getStudentEmblems": {
      const p = await profileFromToken(args[0]);
      const exp = await experienceView(p.id);
      const { error: finalizeError } = await admin.rpc(
        "finalize_due_monthly_rankings",
      );
      if (finalizeError) throw finalizeError;
      const [
        { data: settings, error },
        { count: teacherCount },
        { count: bookCount },
        { count: wrongCount },
        { count: zeroCorrectCount },
        { data: testRows },
        { data: attendanceRows },
        { data: rankingRows },
      ] = await Promise.all([
        admin.from("emblem_settings").select("*").eq("enabled", true).order(
          "sort_order",
        ),
        admin.from("test_results").select("id", { count: "exact", head: true })
          .eq("user_id", p.id).eq("test_kind", "teacher"),
        admin.from("vocabulary_books").select("id", {
          count: "exact",
          head: true,
        }).eq("user_id", p.id).eq("is_default", false),
        admin.from("wrong_words").select("id", { count: "exact", head: true })
          .eq("user_id", p.id),
        admin.from("test_results").select("id", { count: "exact", head: true })
          .eq("user_id", p.id).eq("correct_count", 0).eq("status", "completed"),
        admin.from("test_results").select("question_count,score,taken_at")
          .eq("user_id", p.id).eq("status", "completed")
          .gte("question_count", 100)
          .order("taken_at", { ascending: false }).limit(10),
        admin.from("student_daily_activity").select("activity_date")
          .eq("user_id", p.id).order("activity_date", { ascending: false })
          .limit(400),
        admin.from("monthly_ranking_history").select(
          "month,rank,category,winner_grade_group,finalized,word_sets(name)",
        )
          .eq("user_id", p.id).eq("rank", 1).order("month"),
      ]);
      if (error) throw error;
      const attendanceCount = attendanceStreak(attendanceRows ?? []);
      const perfectCount = perfectTestStreak(testRows ?? []);
      const allowedWins = (rankingRows ?? []).filter(eligibleFinalRankingWin);
      const monthlyWinCount = allowedWins.length;
      const consecutiveWinCount = consecutiveMonthlyWins(rankingRows ?? []);
      const conditionValue = (e: any) =>
        num(
          Array.isArray(e.condition_value)
            ? e.condition_value[0]
            : e.condition_value,
        );
      const currentConditionValue = (e: any) =>
        e.condition_type === "LEVEL"
          ? exp.level
          : e.condition_type === "TEACHER_TEST_COUNT"
          ? num(teacherCount)
          : e.condition_type === "VOCABULARY_BOOK_COUNT"
          ? num(bookCount)
          : e.condition_type === "WRONG_NOTEBOOK_COUNT"
          ? num(wrongCount)
          : e.condition_type === "ZERO_CORRECT_COUNT"
          ? num(zeroCorrectCount)
          : e.condition_type === "ATTENDANCE_STREAK"
          ? attendanceCount
          : e.condition_type === "PERFECT_STREAK"
          ? perfectCount
          : e.condition_type === "MONTHLY_RANK_1"
          ? monthlyWinCount
          : e.condition_type === "CONSECUTIVE_MONTHLY_RANK_1"
          ? consecutiveWinCount
          : 0;
      const qualifies = (e: any) =>
        e.condition_type === "LEVEL"
          ? exp.level >= conditionValue(e)
          : e.condition_type === "TEACHER_TEST_COUNT"
          ? num(teacherCount) >= conditionValue(e)
          : e.condition_type === "VOCABULARY_BOOK_COUNT"
          ? num(bookCount) >= conditionValue(e)
          : e.condition_type === "WRONG_NOTEBOOK_COUNT"
          ? num(wrongCount) >= conditionValue(e)
          : e.condition_type === "ZERO_CORRECT_COUNT"
          ? num(zeroCorrectCount) >= conditionValue(e)
          : e.condition_type === "ATTENDANCE_STREAK"
          ? attendanceCount >= conditionValue(e)
          : e.condition_type === "PERFECT_STREAK"
          ? perfectCount >= conditionValue(e)
          : e.condition_type === "MONTHLY_RANK_1"
          ? monthlyWinCount >= conditionValue(e)
          : e.condition_type === "CONSECUTIVE_MONTHLY_RANK_1"
          ? consecutiveWinCount >= conditionValue(e)
          : false;
      const eligible = (settings ?? []).filter(qualifies);
      const { data: beforeOwnedRows } = await admin.from("student_emblems")
        .select("emblem_id").eq("user_id", p.id);
      const beforeOwned = new Set(
        (beforeOwnedRows ?? []).map((x: any) => str(x.emblem_id)),
      );
      const newlyEligible = eligible.filter((e: any) => !beforeOwned.has(str(e.id)));
      if (eligible.length) {
        await admin.from("student_emblems").upsert(
          eligible.map((e: any) => ({ user_id: p.id, emblem_id: e.id })),
          { onConflict: "user_id,emblem_id", ignoreDuplicates: true },
        );
      }
      for (const emblem of newlyEligible) {
        await grantXp(p.id, 30, `emblem:${p.id}:${emblem.id}`, {
          test_kind: "emblem",
          question_count: 0,
          score: 0,
        });
      }
      const { data: owned } = await admin.from("student_emblems").select(
        "emblem_id,earned_at,equipped",
      ).eq("user_id", p.id);
      const ownership = new Map(
        (owned ?? []).map((x: any) => [x.emblem_id, x]),
      );
      const emblems = (settings ?? []).map((e: any) => {
        const o: any = ownership.get(e.id);
        const value = conditionValue(e);
        const rawProgressValue = currentConditionValue(e);
        const progressValue = o ? Math.max(rawProgressValue, value) : rawProgressValue;
        const progressPercent = value > 0
          ? Math.max(0, Math.min(100, Math.round(progressValue / value * 100)))
          : 0;
        const progressLabel = e.condition_type === "LEVEL"
          ? `현재 Lv.${progressValue} / 목표 Lv.${value}`
          : e.condition_type === "ATTENDANCE_STREAK"
          ? `현재 ${progressValue}일 / 목표 ${value}일`
          : e.condition_type === "CONSECUTIVE_MONTHLY_RANK_1"
          ? `같은 부문 연속 ${progressValue}개월 / 목표 ${value}개월`
          : e.condition_type === "MONTHLY_RANK_1"
          ? `확정 1위 ${progressValue}회 / 목표 ${value}회`
          : `현재 ${progressValue} / 목표 ${value}`;
        return {
          emblemId: e.id,
          emblemName: e.name,
          imagePath: e.image_path,
          conditionText: e.condition_type === "LEVEL"
            ? `Lv.${value} 달성`
            : e.condition_type === "TEACHER_TEST_COUNT"
            ? `선생님 시험 ${value}회 응시`
            : e.condition_type === "VOCABULARY_BOOK_COUNT"
            ? `나만의 단어장 ${value}개 만들기 (기본 단어장 제외)`
            : e.condition_type === "WRONG_NOTEBOOK_COUNT"
            ? `오답노트에 단어 ${value}개 이상 추가`
            : e.condition_type === "ZERO_CORRECT_COUNT"
            ? `정답 0개 시험 ${value}회 기록`
            : e.condition_type === "ATTENDANCE_STREAK"
            ? `${value}일 연속 출석`
            : e.condition_type === "PERFECT_STREAK"
            ? `100문항 이상 PERFECT ${value}회 연속 달성`
            : e.condition_type === "MONTHLY_RANK_1"
            ? `학년에 맞는 부문의 월간 최종 1위`
            : e.condition_type === "CONSECUTIVE_MONTHLY_RANK_1"
            ? `같은 인정 부문에서 월간 최종 1위 ${value}개월 연속`
            : `조건 달성 시 획득`,
          owned: Boolean(o),
          equipped: Boolean(o?.equipped),
          earnedAt: o?.earned_at ?? null,
          progressValue,
          progressTarget: value,
          progressPercent,
          progressLabel: o ? `달성 완료 · ${progressLabel}` : progressLabel,
        };
      });
      const equippedEmblem = emblems.find((e: any) => e.equipped) ?? null;
      const finalExperience = newlyEligible.length
        ? await experienceView(p.id)
        : exp;
      return {
        success: true,
        equippedEmblem,
        acquiredCount: emblems.filter((e: any) => e.owned).length,
        totalCount: emblems.length,
        currentLevel: finalExperience.level,
        experience: finalExperience,
        newlyGrantedEmblems: newlyEligible.map((e: any) => ({
          emblemId: e.id,
          emblemName: e.name,
          imagePath: e.image_path,
          earnedXp: 30,
        })),
        emblems,
      };
    }
    case "equipStudentEmblem": {
      const p = await profileFromToken(args[0]);
      const id = str(args[1]);
      const { error } = await admin.rpc("equip_student_emblem_atomic", {
        p_user_id: p.id,
        p_emblem_id: id,
      });
      if (error) throw error;
      return { success: true, message: "엠블럼을 장착했습니다." };
    }
    case "getMonthlyRanking": {
      const now = koreaParts();
      const start = koreaMonthStartIso();
      const { data, error } = await admin.from("test_results").select(
        "user_id,points,grade,score,profiles(display_name,student_id),word_sets(id,name)",
      ).gte("taken_at", start);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((x: any) => x.user_id))];
      const [{ data: xp }, { data: equipped }] = await Promise.all([
        ids.length
          ? admin.from("student_experience").select("user_id,level,title").in(
            "user_id",
            ids,
          )
          : Promise.resolve({ data: [] }),
        ids.length
          ? admin.from("student_emblems").select(
            "user_id,emblem_settings(id,name,image_path)",
          ).eq("equipped", true).in("user_id", ids)
          : Promise.resolve({ data: [] }),
      ]);
      const xpMap = new Map((xp ?? []).map((x: any) => [x.user_id, x]));
      const emblemMap = new Map(
        (equipped ?? []).map((x: any) => [x.user_id, x.emblem_settings]),
      );
      const groups: { [key: string]: Map<string, any> } = {
        middle: new Map(),
        high: new Map(),
        csat: new Map(),
      };
      for (const x of data ?? []) {
        const setName = (x as any).word_sets?.name ?? "";
        const category = setName.includes("중등")
          ? "middle"
          : setName.includes("고등")
          ? "high"
          : setName.includes("수능")
          ? "csat"
          : "";
        if (!category || num(x.points) <= 0) continue;
        const p: any = (x as any).profiles ?? {};
        const old = groups[category].get(x.user_id) ??
          {
            studentId: p.student_id ?? "",
            name: p.display_name ?? "",
            points: 0,
            perfectCount: 0,
            testCount: 0,
          };
        old.points += num(x.points);
        old.testCount++;
        if (str(x.grade).toUpperCase() === "PERFECT" || num(x.score) >= 100) {
          old.perfectCount++;
        }
        groups[category].set(x.user_id, old);
      }
      const rank = (map: Map<string, any>) =>
        [...map.entries()].map(([userId, x]) => {
          const e: any = emblemMap.get(userId);
          const level: any = xpMap.get(userId);
          return {
            ...x,
            userId,
            point: x.points,
            level: level?.level ?? 1,
            title: level?.title ?? "단어병아리",
            equippedEmblem: e
              ? { emblemId: e.id, emblemName: e.name, imagePath: e.image_path }
              : null,
          };
        }).sort((a, b) =>
          b.points - a.points || b.perfectCount - a.perfectCount ||
          b.testCount - a.testCount || a.name.localeCompare(b.name, "ko")
        ).slice(0, 100).map((x, i) => ({ ...x, rank: i + 1 }));
      const result: any = {
        year: Number(now.year),
        month: Number(now.month),
        middle: rank(groups.middle),
        high: rank(groups.high),
        csat: rank(groups.csat),
      };
      return result;
    }
    case "getMyLearning": {
      const p = await profileFromToken(args[0]);
      const { data: tests, error } = await admin.from("test_results").select(
        "*,word_sets(name)",
      ).eq("user_id", p.id).order("taken_at", { ascending: false }).limit(100);
      if (error) throw error;
      const rows = tests ?? [];
      const recentTests = rows.map((x: any) => ({
        date: formatKoreaDate(x.taken_at, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        sheetName: x.word_sets?.name ??
          (x.test_kind === "teacher" ? "선생님 시험" : "단어 시험"),
        dayText: x.start_day
          ? `Day ${x.start_day}${
            x.end_day && x.end_day !== x.start_day ? `~${x.end_day}` : ""
          }`
          : "",
        correctCount: x.correct_count,
        questionCount: x.question_count,
        grade: x.grade,
        percentage: Math.round(num(x.score)),
        point: x.points,
      }));
      return {
        success: true,
        student: studentView(p),
        monthText: formatKoreaDate(new Date(), {
          year: "numeric",
          month: "long",
        }),
        summary: {
          testCount: rows.length,
          averageScore: rows.length
            ? Math.round(
              rows.reduce((s: any, x: any) => s + num(x.score), 0) /
                rows.length,
            )
            : 0,
          totalPoint: rows.reduce((s: any, x: any) => s + num(x.points), 0),
          perfectCount: rows.filter((x: any) => num(x.score) >= 100).length,
        },
        experience: await experienceView(p.id),
        recentTests,
      };
    }
    case "teacherGetSetupData": {
      await requireStaff(args[0]);
      const [{ data: sets }, { data: students }] = await Promise.all([
        admin.from("word_sets").select("name").eq("enabled", true).order(
          "sort_order",
        ),
        admin.from("profiles").select(
          "student_id,display_name,base_grade,base_year",
        ).eq("role", "student").eq("enabled", true).order("display_name"),
      ]);
      return {
        success: true,
        dbSheets: (sets ?? []).map((x) => x.name),
        students: (students ?? []).map((x) => ({
          studentId: x.student_id,
          studentName: x.display_name,
          grade: studentView(x).grade,
          baseGrade: x.base_grade,
          baseYear: x.base_year,
        })),
        questionModes: [
          { value: "random", label: "랜덤 출제" },
          { value: "engToKor", label: "영어 → 한글" },
          { value: "korToEng", label: "한글 → 영어" },
          { value: "mixed", label: "영한·한영 혼합" },
          { value: "example", label: "예문 문제" },
        ],
        sourceTypes: [{ value: "DB", label: "DB에서 출제" }, {
          value: "직접입력",
          label: "직접 단어 입력",
        }, { value: "혼합", label: "DB + 직접 입력" }],
      };
    }
    case "teacherCreateExam":
      return teacherCreate(args);
    case "teacherListExams": {
      await requireStaff(args[0]);
      const { data, error } = await admin.from("teacher_exams").select(
        "*,word_sets(name)",
      ).order("created_at", { ascending: false });
      if (error) throw error;
      return { success: true, exams: (data ?? []).map(legacyExamView) };
    }
    case "teacherGetExamDetails": {
      await requireStaff(args[0]);
      const { data, error } = await admin.from("teacher_exams").select(
        "*,word_sets(name),teacher_exam_words(*)",
      ).eq("id", str(args[1])).single();
      if (error) throw error;
      return {
        success: true,
        exam: legacyExamView(data),
        words: (data.teacher_exam_words ?? []).sort((a: any, b: any) =>
          a.position - b.position
        ).map(legacyExamWordView),
      };
    }
    case "teacherGetExamStatus": {
      await requireStaff(args[0]);
      const id = str(args[1]);
      const [{ data: exam }, { data: assignments, error }] = await Promise.all([
        admin.from("teacher_exams").select("ends_at").eq("id", id).single(),
        admin.from("exam_assignments").select(
          "*,profiles(student_id,display_name,base_grade)",
        ).eq("exam_id", id),
      ]);
      if (error) throw error;
      const users = (assignments ?? []).map((x: any) => x.user_id);
      const [{ data: results }, { data: equipped }] = await Promise.all([
        users.length
          ? admin.from("test_results").select(
            "user_id,score,correct_count,question_count,attempt,submitted_at",
          ).eq("teacher_exam_id", id).in("user_id", users).order(
            "submitted_at",
            { ascending: false },
          )
          : Promise.resolve({ data: [] }),
        users.length
          ? admin.from("student_emblems").select(
            "user_id,emblem_settings(name,image_path)",
          ).eq("equipped", true).in("user_id", users)
          : Promise.resolve({ data: [] }),
      ]);
      const resultMap = new Map<string, any[]>();
      for (const r of results ?? []) {
        const list = resultMap.get(r.user_id) ?? [];
        list.push(r);
        resultMap.set(r.user_id, list);
      }
      const emblemMap = new Map(
        (equipped ?? []).map((x: any) => [x.user_id, x.emblem_settings]),
      );
      const ended = Boolean(
        exam?.ends_at && new Date(exam.ends_at).getTime() < Date.now(),
      );
      const students = (assignments ?? []).map((x: any) => {
        const latest = (resultMap.get(x.user_id) ?? [])[0];
        const status = x.status === "completed"
          ? "완료"
          : x.status === "in_progress"
          ? "시험중"
          : "미응시";
        const missed = ended && status !== "완료";
        const e: any = emblemMap.get(x.user_id);
        return {
          "학생ID": x.profiles?.student_id,
          "학생이름": x.profiles?.display_name,
          "학년": x.profiles?.base_grade,
          "장착엠블럼": e
            ? { emblemName: e.name, imagePath: e.image_path }
            : null,
          "응시상태": status,
          "표시상태": missed
            ? (status === "시험중"
              ? "시험 중 · 마감 종료"
              : "미응시 · 마감 종료")
            : status,
          "마감종료": missed,
          "재응시가능": false,
          "응시회차": x.attempt,
          "최고점": x.highest_score ?? "",
          "최근점수": latest?.score ?? "",
          "정답수": latest?.correct_count ?? "",
          "문제수": latest?.question_count ?? "",
          "완료일시": x.completed_at ?? latest?.submitted_at ?? "",
        };
      });
      return {
        success: true,
        examId: id,
        totalCount: students.length,
        completedCount:
          students.filter((x: any) => x["응시상태"] === "완료").length,
        inProgressCount:
          students.filter((x: any) => x["응시상태"] === "시험중").length,
        notStartedCount:
          students.filter((x: any) => x["응시상태"] === "미응시").length,
        deadlineMissedCount: students.filter((x: any) => x["마감종료"]).length,
        examDeadlineEnded: ended,
        deadlineAt: exam?.ends_at ?? "",
        students,
      };
    }
    case "teacherCancelExam": {
      await requireStaff(args[0]);
      const id = str(args[1]);
      await admin.from("teacher_exams").update({ status: "cancelled" }).eq(
        "id",
        id,
      );
      await admin.from("notifications").delete().eq("exam_id", id).is(
        "read_at",
        null,
      );
      return { success: true, message: "시험 출제를 취소했습니다." };
    }
    case "teacherDeleteExam": {
      await requireStaff(args[0]);
      const id = str(args[1]);
      const { error } = await admin.from("teacher_exams").delete().eq("id", id);
      if (error) throw error;
      return { success: true, message: "시험을 목록에서 완전히 삭제했습니다." };
    }
    case "teacherDeleteAllExams": {
      await requireStaff(args[0]);
      const { count } = await admin.from("teacher_exams").select("id", {
        count: "exact",
        head: true,
      });
      const { error } = await admin.from("teacher_exams").delete().not(
        "id",
        "is",
        null,
      );
      if (error) throw error;
      return {
        success: true,
        deletedCount: count ?? 0,
        message: `시험 ${count ?? 0}개를 모두 삭제했습니다.`,
      };
    }
    case "teacherSendReminder": {
      await requireStaff(args[0]);
      const id = str(args[1]);
      const { data } = await admin.from("exam_assignments").select("user_id")
        .eq("exam_id", id).neq("status", "completed");
      if (data?.length) {
        await admin.from("notifications").insert(
          data.map((x) => ({
            user_id: x.user_id,
            exam_id: id,
            type: "reminder",
            title: "시험 응시 알림",
            body: "배정된 시험을 확인해주세요.",
          })),
        );
      }
      return {
        success: true,
        sentCount: data?.length ?? 0,
        message: `미완료 학생 ${data?.length ?? 0}명에게 알림을 보냈습니다.`,
      };
    }
    case "teacherRequestRetakeStudent":
      return requestRetake(args, [str(args[2])]);
    case "teacherRequestRetakeAll":
      return requestRetake(args);
    case "teacherRequestRetakeBelowScore":
      return requestRetake(args, undefined, num(args[2]));
    case "studentGetAssignedExams": {
      const p = await profileFromToken(args[0]);
      const { data, error } = await admin.from("exam_assignments").select(
        "*,teacher_exams(*,word_sets(name),profiles!teacher_exams_created_by_fkey(display_name))",
      ).eq("user_id", p.id).order("assigned_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      const exams = (data ?? []).filter((x: any) => {
        const exam = x.teacher_exams;
        if (!exam || exam.status === "cancelled") return false;
        const deadlineExpired = exam.ends_at &&
          new Date(exam.ends_at).getTime() + threeDays < now;
        const completionExpired = x.status === "completed" && x.completed_at &&
          new Date(x.completed_at).getTime() + threeDays < now;
        return !deadlineExpired && !completionExpired;
      }).map((x: any) => {
        const e = x.teacher_exams;
        const early = e.starts_at && new Date(e.starts_at).getTime() > now;
        const late = e.ends_at && new Date(e.ends_at).getTime() < now;
        const blocked = e.status === "cancelled" || early || late ||
          (x.status === "completed" && !e.allow_retake);
        return {
          ...examView(e),
          creator: e.profiles?.display_name ?? "관리자",
          attempt: x.attempt,
          bestScore: x.highest_score,
          highestScore: x.highest_score,
          status: x.status === "in_progress"
            ? "시험중"
            : x.status === "completed"
            ? "응시완료"
            : "미응시",
          availability: blocked
            ? (e.status === "cancelled"
              ? "취소됨"
              : early
              ? "응시 전"
              : late
              ? "마감됨"
              : "응시완료")
            : "응시가능",
          deadlineAt: e.ends_at,
        };
      });
      return { success: true, exams };
    }
    case "studentStartTeacherExam": {
      const p = await profileFromToken(args[0]);
      const id = str(args[1]);
      const { data: exam, error } = await admin.from("teacher_exams").select(
        "*,word_sets(name),teacher_exam_words(*)",
      ).eq("id", id).single();
      if (error) throw error;
      const { data: assignment } = await admin.from("exam_assignments").select(
        "*",
      ).eq("exam_id", id).eq("user_id", p.id).single();
      if (!assignment) throw new Error("배정되지 않은 시험입니다.");
      if (exam.status === "cancelled") throw new Error("취소된 시험입니다.");
      const now = Date.now();
      if (exam.starts_at && new Date(exam.starts_at).getTime() > now) {
        throw new Error("아직 응시 시간이 아닙니다.");
      }
      if (exam.ends_at && new Date(exam.ends_at).getTime() < now) {
        throw new Error("응시 기간이 끝났습니다.");
      }
      if (assignment.status === "completed" && !exam.allow_retake) {
        throw new Error("이미 응시를 완료한 시험입니다.");
      }
      const questions = teacherQuestions(
        exam.teacher_exam_words ?? [],
        str(exam.question_type),
      ).slice(0, num(exam.question_count, 100));
      await admin.from("exam_assignments").update({ status: "in_progress" }).eq(
        "exam_id",
        id,
      ).eq("user_id", p.id);
      const { data: progress } = await admin.from("exam_progress").select(
        "progress",
      ).eq("user_id", p.id).eq("scope_key", `teacher:${id}`).maybeSingle();
      return {
        success: true,
        exam: { ...examView(exam), attempt: num(assignment.attempt) + 1 },
        questions,
        answers: progress?.progress?.answers ?? {},
        currentIndex: num(progress?.progress?.currentIndex),
      };
    }
    case "studentSubmitTeacherExam": {
      const payload: any = args[1] ?? {};
      const p = await profileFromToken(args[0]);
      const id = str(payload.examId);
      const { data: exam, error } = await admin.from("teacher_exams").select(
        "*,word_sets(name),teacher_exam_words(*)",
      ).eq("id", id).single();
      if (error) throw error;
      const { data: a } = await admin.from("exam_assignments").select(
        "attempt,highest_score",
      ).eq("exam_id", id).eq("user_id", p.id).single();
      if (!a) throw new Error("배정되지 않은 시험입니다.");
      const questions = teacherQuestions(
        exam.teacher_exam_words ?? [],
        str(exam.question_type),
      ).slice(0, num(exam.question_count, 100));
      const answers = new Map(
        (Array.isArray(payload.answers) ? payload.answers : []).map((
          x: any,
        ) => [str(x.questionId), str(x.answer)]),
      );
      const details = questions.map((q: any) => {
        const submittedAnswer = str(answers.get(q.questionId));
        const isCorrect = submittedAnswer.toLocaleLowerCase() ===
          str(q.correctAnswer).toLocaleLowerCase();
        return {
          questionId: q.questionId,
          prompt: q.prompt,
          english: q.english,
          meaning: q.meaning,
          submittedAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect,
        };
      });
      const correctCount = details.filter((x: any) => x.isCorrect).length;
      const totalCount = details.length;
      const score = totalCount
        ? Math.round(correctCount / totalCount * 100)
        : 0;
      const wrongWords = details.filter((x: any) => !x.isCorrect).map(
        (d: any) => {
          const q = questions.find((x: any) => x.questionId === d.questionId);
          return {
            word: q.english,
            meaning: q.meaning,
            day: q.day,
            translation: q.translation,
          };
        },
      );
      const result: any = await saveResult(args[0], {
        testKind: "teacher",
        examId: id,
        attempt: num(a.attempt) + 1,
        sheetName: exam.word_sets?.name ?? "",
        questionType: exam.question_type,
        questionCount: totalCount,
        correctCount,
        score,
        wrongWords,
      });
      await admin.from("exam_assignments").update({
        status: "completed",
        attempt: num(a.attempt) + 1,
        highest_score: Math.max(num(a.highest_score), score),
        completed_at: new Date().toISOString(),
      }).eq("exam_id", id).eq("user_id", p.id);
      await admin.from("exam_progress").delete().eq("user_id", p.id).eq(
        "scope_key",
        `teacher:${id}`,
      );
      await admin.from("notifications").update({
        read_at: new Date().toISOString(),
      }).eq("user_id", p.id).eq("exam_id", id).is("read_at", null);
      return {
        success: true,
        result: {
          ...result,
          title: exam.title,
          passingScore: exam.passing_score,
          passed: score >= num(exam.passing_score, 60),
          correctCount,
          totalCount,
          wrongCount: wrongWords.length,
          details,
        },
      };
    }
    case "studentSaveTeacherExamProgress": {
      const p = await profileFromToken(args[0]);
      const id = str(args[1]);
      await admin.from("exam_progress").upsert({
        user_id: p.id,
        exam_id: id,
        scope_key: `teacher:${id}`,
        progress: args[2] ?? {},
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      }, { onConflict: "user_id,scope_key" });
      return { success: true };
    }
    case "studentGetTeacherExamProgress": {
      const p = await profileFromToken(args[0]);
      const { data } = await admin.from("exam_progress").select("progress").eq(
        "user_id",
        p.id,
      ).eq("scope_key", `teacher:${str(args[1])}`).maybeSingle();
      return data?.progress ?? null;
    }
    case "studentDeleteTeacherExamProgress": {
      const p = await profileFromToken(args[0]);
      await admin.from("exam_progress").delete().eq("user_id", p.id).eq(
        "scope_key",
        `teacher:${str(args[1])}`,
      );
      return { success: true };
    }
    case "studentStopTeacherExam": {
      const p = await profileFromToken(args[0]);
      await admin.from("exam_assignments").update({ status: "assigned" }).eq(
        "exam_id",
        str(args[1]),
      ).eq("user_id", p.id);
      return { success: true };
    }
    case "studentGetNotifications": {
      const p = await profileFromToken(args[0]);
      const { data: completedAssignments } = await admin.from("exam_assignments")
        .select("exam_id").eq("user_id", p.id).eq("status", "completed");
      const completedExamIds = (completedAssignments ?? []).map((x: any) => x.exam_id);
      if (completedExamIds.length) {
        await admin.from("notifications").update({
          read_at: new Date().toISOString(),
        }).eq("user_id", p.id).in("exam_id", completedExamIds).is("read_at", null);
      }
      const { data, error } = await admin.from("notifications").select("*").eq(
        "user_id",
        p.id,
      ).order("created_at", { ascending: false });
      if (error) throw error;
      const notifications = (data ?? []).map((x: any) => ({
        notificationId: x.id,
        examId: x.exam_id,
        type: x.type,
        title: x.title,
        content: x.body,
        read: Boolean(x.read_at),
        createdAt: x.created_at,
        readAt: x.read_at,
      }));
      return {
        success: true,
        notifications,
        unreadCount: notifications.filter((x: any) => !x.read).length,
      };
    }
    case "studentMarkNotificationRead": {
      const p = await profileFromToken(args[0]);
      await admin.from("notifications").update({
        read_at: new Date().toISOString(),
      }).eq("id", str(args[1])).eq("user_id", p.id);
      return { success: true };
    }
    case "studentDeleteNotification": {
      const p = await profileFromToken(args[0]);
      await admin.from("notifications").delete().eq("id", str(args[1])).eq(
        "user_id",
        p.id,
      );
      return { success: true };
    }
    case "studentDeleteAllReadNotifications": {
      const p = await profileFromToken(args[0]);
      await admin.from("notifications").delete().eq("user_id", p.id).not(
        "read_at",
        "is",
        null,
      );
      return { success: true };
    }
    default:
      throw new Error(`지원하지 않는 함수입니다: ${name}`);
  }
}

function examView(x: any, details = false) {
  if (!x) return null;
  return {
    examId: x.id,
    examTitle: x.title,
    title: x.title,
    sourceType: x.source_type,
    dbName: x.word_sets?.name ?? "",
    startDay: x.start_day,
    endDay: x.end_day,
    questionCount: x.question_count,
    questionType: x.question_type,
    targetType: x.target_type,
    targetValue: x.target_value,
    startDateTime: x.starts_at,
    endDateTime: x.ends_at,
    passingScore: x.passing_score,
    allowRetake: x.allow_retake,
    awardPoints: x.award_points,
    status: x.status,
    createdAt: x.created_at,
    assignedCount: x.exam_assignments?.[0]?.count ??
      x.exam_assignments?.length ?? 0,
    ...(details
      ? {
        words: x.teacher_exam_words ?? [],
        assignments: x.exam_assignments ?? [],
      }
      : {}),
  };
}

async function teacherCreate(args: unknown[]) {
  await requireStaff(args[0]);
  const p: any = args[1] ?? {};
  const { data: creator } = await admin.from("profiles").select(
    "id,display_name",
  ).in("role", ["teacher", "admin"]).limit(1).maybeSingle();
  if (!creator) throw new Error("교사 프로필이 없습니다.");
  const { data: set } = p.dbName
    ? await admin.from("word_sets").select("id").eq("name", p.dbName)
      .maybeSingle()
    : { data: null };
  let words: any[] = [];
  if ((p.sourceType === "DB" || p.sourceType === "혼합") && set) {
    const { data, error } = await admin.from("words").select(
      "id,day,word,meaning,example,translation",
    ).eq("word_set_id", set.id).gte("day", num(p.startDay)).lte(
      "day",
      num(p.endDay),
    ).order("day").order("sort_order").limit(5000);
    if (error) throw error;
    words = data ?? [];
  }
  if (p.sourceType === "직접입력" || p.sourceType === "혼합") {
    const direct = str(p.directWordsText).split(/\r?\n/).map((line: string) =>
      line.split(/\t|,/).map(str)
    ).filter((x: string[]) => x[0] && x[1]).map((x: string[]) => ({
      word: x[0],
      meaning: x[1],
      example: x[2] ?? "",
      translation: x[3] ?? "",
    }));
    words = words.concat(direct);
  }
  if (words.length < 4) {
    throw new Error(
      "시험을 만들려면 사용할 수 있는 단어가 최소 4개 필요합니다.",
    );
  }
  words = spreadWordsAcrossDays(words);
  const questionCount = Math.min(
    num(p.questionCount, words.length),
    words.length,
  );
  let students: any[] = [];
  const ids = Array.isArray(p.targetStudentIds) ? p.targetStudentIds : [];
  if (p.targetType === "전체") {
    ({ data: students } = await admin.from("profiles").select(
      "id,student_id,display_name",
    ).eq("role", "student").eq("enabled", true));
  } else if (p.targetType === "학년") {
    ({ data: students } = await admin.from("profiles").select(
      "id,student_id,display_name",
    ).eq("role", "student").eq("enabled", true).eq(
      "base_grade",
      str(p.targetGrade),
    ));
  } else if (ids.length) {
    ({ data: students } = await admin.from("profiles").select(
      "id,student_id,display_name",
    ).eq("role", "student").eq("enabled", true).in("student_id", ids));
  }
  if (!students?.length) {
    throw new Error("시험 대상 학생이 선택되지 않았습니다.");
  }
  const { data: exam, error } = await admin.from("teacher_exams").insert({
    title: str(p.title),
    source_type: str(p.sourceType ?? "DB"),
    word_set_id: set?.id ?? null,
    start_day: num(p.startDay) || null,
    end_day: num(p.endDay) || null,
    question_count: questionCount,
    question_type: str(p.questionMode ?? "random"),
    target_type: str(p.targetType ?? "학생선택"),
    target_value: students.map((s: any) => s.student_id),
    starts_at: koreaDateTime(p.startAt),
    ends_at: koreaDateTime(p.deadlineAt),
    passing_score: num(p.passingScore, 80),
    allow_retake: Boolean(p.allowRetake),
    award_points: p.givePoint !== false,
    status: "active",
    created_by: creator.id,
  }).select().single();
  if (error) throw error;
  await admin.from("teacher_exam_words").insert(
    words.map((w: any, i: number) => ({
      exam_id: exam.id,
      position: i + 1,
      word_id: w.id ?? null,
      source: w.id ? "database" : "manual",
      day: num(w.day) || null,
      word: str(w.word),
      meaning: str(w.meaning),
      example: str(w.example),
      translation: str(w.translation),
      enabled: true,
    })),
  );
  await admin.from("exam_assignments").insert(
    students.map((s: any) => ({
      exam_id: exam.id,
      user_id: s.id,
      notified: true,
      notified_at: new Date().toISOString(),
    })),
  );
  await admin.from("notifications").insert(students.map((s: any) => ({
    user_id: s.id,
    exam_id: exam.id,
    type: "assignment",
    title: "새로운 단어시험이 등록되었습니다.",
    body: `${str(p.creator) || creator.display_name || "관리자"} 선생님이 ${
      str(p.title)
    } 시험을 등록했습니다. 마감 시간까지 응시해 주세요.`,
  })));
  const push = await sendPushToStudents(students.map((s: any) => s.id), {
    title: "새로운 선생님 시험",
    body: `${str(p.title) || "단어시험"} 시험이 배정되었습니다. 마감 시간까지 응시해 주세요.`,
    url: "./?push=teacher-exams",
    examId: exam.id,
    tag: `teacher-exam-${exam.id}`,
  }).catch((pushError) => {
    console.error("teacher exam push failed", pushError);
    return { sent: 0, failed: students.length, configured: false };
  });
  return {
    success: true,
    message: "선생님 시험이 생성되었습니다.",
    examId: exam.id,
    title: p.title,
    totalWords: words.length,
    questionCount,
    targetCount: students.length,
    assignedCount: students.length,
    pushSentCount: push.sent,
    pushFailedCount: push.failed,
    pushConfigured: push.configured,
  };
}

async function requestRetake(
  args: unknown[],
  studentIds?: string[],
  below?: number,
) {
  await requireStaff(args[0]);
  const examId = str(args[1]);
  let q = admin.from("exam_assignments").select(
    "user_id,profiles!inner(student_id)",
  ).eq("exam_id", examId);
  if (studentIds?.length) q = q.in("profiles.student_id", studentIds);
  if (below !== undefined) q = q.lt("highest_score", below);
  const { data } = await q;
  const users = (data ?? []).map((x: any) => x.user_id);
  if (users.length) {
    await admin.from("exam_assignments").update({
      status: "assigned",
      completed_at: null,
      teacher_confirmed: false,
    }).eq("exam_id", examId).in("user_id", users);
    await admin.from("notifications").insert(
      users.map((user_id) => ({
        user_id,
        exam_id: examId,
        type: "retake",
        title: "재시험이 요청되었습니다",
        body: "시험을 다시 응시해주세요.",
      })),
    );
  }
  return { success: true, count: users.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return fail(new Error("POST 요청만 지원합니다."), 405);
  }
  try {
    const body = await req.json();
    if (
      body.action !== "call" ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(str(body.functionName))
    ) throw new Error("지원하지 않는 요청입니다.");
    return ok(
      await dispatch(
        str(body.functionName),
        Array.isArray(body.args) ? body.args : [],
        {
          clientKey: `${req.headers.get("x-forwarded-for") ?? "unknown"}|${
            req.headers.get("user-agent") ?? "unknown"
          }`,
        },
      ),
    );
  } catch (e) {
    console.error(e);
    return fail(e);
  }
});
