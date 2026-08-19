import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const str = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const sha256 = async (value: string) => Array.from(new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
)).map((x) => x.toString(16).padStart(2, "0")).join("");
const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }), {
  headers: { ...cors, "Content-Type": "application/json" },
});
const fail = (e: unknown, status = 400) => new Response(JSON.stringify({
  success: false,
  message: e instanceof Error ? e.message : String(e),
}), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function requireStaff(token: unknown) {
  const value = str(token);
  if (!value) throw new Error("선생님 로그인이 필요합니다.");
  const hash = await sha256(value);
  const { data, error } = await admin.from("admin_sessions").select("expires_at").eq("token_hash", hash).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("선생님 로그인이 만료되었습니다. 다시 로그인해주세요.");
  }
}

async function requireStudent(token: unknown) {
  const value = str(token);
  if (!value) throw new Error("학생 로그인이 필요합니다.");
  const { data: authData, error: authError } = await admin.auth.getUser(value);
  if (authError || !authData.user) throw new Error("학생 로그인이 만료되었습니다. 다시 로그인해주세요.");
  const tokenHash = await sha256(value);
  const { data: session, error: sessionError } = await admin.from("student_active_sessions")
    .select("token_hash,expires_at").eq("user_id", authData.user.id).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.token_hash !== tokenHash || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new Error("현재 기기의 로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.");
  }
  const { data: profile, error } = await admin.from("profiles").select("id,student_id,display_name,base_grade,enabled,role")
    .eq("id", authData.user.id).single();
  if (error || !profile || !profile.enabled || profile.role !== "student") throw new Error("사용할 수 없는 학생 계정입니다.");
  return profile;
}

function koreaDateTime(value: unknown) {
  const raw = str(value);
  if (!raw) return null;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}:00+09:00`;
  const parsed = new Date(zoned);
  if (Number.isNaN(parsed.getTime())) throw new Error("시험 시작·마감 시간을 확인해주세요.");
  return parsed.toISOString();
}

function cleanWords(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((x: any) => ({
    word: str(x?.word ?? x?.english),
    meaning: str(x?.meaning),
    example: str(x?.example),
    translation: str(x?.translation),
  })).filter((x) => x.word && x.meaning).slice(0, 2000);
}

async function teacherBooks() {
  const { data, error } = await admin.from("school_vocab_books").select(
    "id,title,school_name,grade_label,description,enabled,created_at,updated_at,school_vocab_words(count),school_vocab_assignments(count)",
  ).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((b: any) => ({
    bookId: b.id,
    title: b.title,
    schoolName: b.school_name,
    gradeLabel: b.grade_label,
    description: b.description,
    enabled: b.enabled,
    wordCount: b.school_vocab_words?.[0]?.count ?? 0,
    studentCount: b.school_vocab_assignments?.[0]?.count ?? 0,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  }));
}

async function teacherSetup(token: unknown) {
  await requireStaff(token);
  const { data: students, error } = await admin.from("profiles")
    .select("student_id,display_name,base_grade,base_year")
    .eq("role", "student").eq("enabled", true).order("display_name");
  if (error) throw error;
  return {
    books: await teacherBooks(),
    students: (students ?? []).map((s: any) => ({
      studentId: s.student_id,
      studentName: s.display_name,
      grade: s.base_grade,
      baseGrade: s.base_grade,
      baseYear: s.base_year,
    })),
  };
}

async function teacherGetBook(token: unknown, payload: any) {
  await requireStaff(token);
  const id = str(payload?.bookId);
  const { data: book, error } = await admin.from("school_vocab_books").select("*").eq("id", id).single();
  if (error) throw error;
  const [{ data: words, error: wordsError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    admin.from("school_vocab_words").select("position,word,meaning,example,translation").eq("book_id", id).order("position"),
    admin.from("school_vocab_assignments").select("user_id,profiles(student_id,display_name,base_grade)").eq("book_id", id).order("assigned_at"),
  ]);
  if (wordsError) throw wordsError;
  if (assignmentsError) throw assignmentsError;
  return {
    bookId: book.id,
    title: book.title,
    schoolName: book.school_name,
    gradeLabel: book.grade_label,
    description: book.description,
    enabled: book.enabled,
    words: words ?? [],
    students: (assignments ?? []).map((a: any) => ({
      studentId: a.profiles?.student_id,
      studentName: a.profiles?.display_name,
      grade: a.profiles?.base_grade,
    })),
  };
}

async function teacherSaveBook(token: unknown, payload: any) {
  await requireStaff(token);
  const words = cleanWords(payload?.words);
  if (!str(payload?.title)) throw new Error("단어장 이름을 입력해주세요.");
  if (!words.length) throw new Error("영단어와 뜻이 입력된 단어를 1개 이상 등록해주세요.");
  const requestedStudentIds = Array.isArray(payload?.studentIds) ? [...new Set(payload.studentIds.map(str).filter(Boolean))] : [];
  if (!requestedStudentIds.length) throw new Error("단어장을 받을 학생을 1명 이상 선택해주세요.");
  const { data: students, error: studentError } = await admin.from("profiles").select("id,student_id")
    .eq("role", "student").eq("enabled", true).in("student_id", requestedStudentIds);
  if (studentError) throw studentError;
  if (!students?.length) throw new Error("선택한 학생 계정을 찾을 수 없습니다.");
  const { data: creator } = await admin.from("profiles").select("id").in("role", ["teacher", "admin"]).limit(1).maybeSingle();
  let bookId = str(payload?.bookId);
  let created = false;
  if (bookId) {
    const { error } = await admin.from("school_vocab_books").update({
      title: str(payload.title), school_name: str(payload.schoolName), grade_label: str(payload.gradeLabel),
      description: str(payload.description), enabled: payload.enabled !== false, updated_at: new Date().toISOString(),
    }).eq("id", bookId);
    if (error) throw error;
  } else {
    const { data, error } = await admin.from("school_vocab_books").insert({
      title: str(payload.title), school_name: str(payload.schoolName), grade_label: str(payload.gradeLabel),
      description: str(payload.description), enabled: true, created_by: creator?.id ?? null,
    }).select("id").single();
    if (error) throw error;
    bookId = data.id;
    created = true;
  }
  try {
    await Promise.all([
      admin.from("school_vocab_words").delete().eq("book_id", bookId),
      admin.from("school_vocab_assignments").delete().eq("book_id", bookId),
    ]);
    const { error: wordError } = await admin.from("school_vocab_words").insert(words.map((w, i) => ({
      book_id: bookId, position: i + 1, ...w,
    })));
    if (wordError) throw wordError;
    const { error: assignmentError } = await admin.from("school_vocab_assignments").insert((students ?? []).map((s: any) => ({
      book_id: bookId, user_id: s.id,
    })));
    if (assignmentError) throw assignmentError;
  } catch (e) {
    if (created) await admin.from("school_vocab_books").delete().eq("id", bookId);
    throw e;
  }
  return { success: true, bookId, wordCount: words.length, studentCount: students?.length ?? 0 };
}

async function teacherDeleteBook(token: unknown, payload: any) {
  await requireStaff(token);
  const { error } = await admin.from("school_vocab_books").delete().eq("id", str(payload?.bookId));
  if (error) throw error;
  return { success: true };
}

async function teacherCreateExam(token: unknown, payload: any) {
  await requireStaff(token);
  const bookId = str(payload?.bookId);
  const { data: book, error: bookError } = await admin.from("school_vocab_books").select("id,title,enabled").eq("id", bookId).single();
  if (bookError) throw bookError;
  if (!book.enabled) throw new Error("사용 중지된 수행평가 단어장입니다.");
  const [{ data: words, error: wordError }, { data: assigned, error: assignError }] = await Promise.all([
    admin.from("school_vocab_words").select("position,word,meaning,example,translation").eq("book_id", bookId).order("position"),
    admin.from("school_vocab_assignments").select("user_id,profiles(student_id,display_name)").eq("book_id", bookId),
  ]);
  if (wordError) throw wordError;
  if (assignError) throw assignError;
  if ((words ?? []).length < 4) throw new Error("공식 시험 출제를 위해 단어가 최소 4개 필요합니다.");
  let targets = assigned ?? [];
  const requested = Array.isArray(payload?.studentIds) ? payload.studentIds.map(str).filter(Boolean) : [];
  if (requested.length) targets = targets.filter((x: any) => requested.includes(str(x.profiles?.student_id)));
  if (!targets.length) throw new Error("시험 대상 학생이 없습니다.");
  const startsAt = koreaDateTime(payload?.startAt);
  const endsAt = koreaDateTime(payload?.deadlineAt);
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new Error("마감 일시는 시작 일시보다 뒤여야 합니다.");
  const { data: creator } = await admin.from("profiles").select("id,display_name").in("role", ["teacher", "admin"]).limit(1).maybeSingle();
  if (!creator) throw new Error("교사 프로필을 찾을 수 없습니다.");
  const questionCount = Math.max(4, Math.min(num(payload?.questionCount, words?.length ?? 0), words?.length ?? 0));
  const { data: exam, error } = await admin.from("teacher_exams").insert({
    title: str(payload?.title) || `${book.title} 시험`,
    source_type: "수행평가",
    word_set_id: null,
    start_day: null,
    end_day: null,
    question_count: questionCount,
    question_type: str(payload?.questionMode) || "random",
    target_type: "학생선택",
    target_value: targets.map((x: any) => x.profiles?.student_id).filter(Boolean),
    starts_at: startsAt,
    ends_at: endsAt,
    passing_score: Math.max(0, Math.min(100, num(payload?.passingScore, 80))),
    allow_retake: Boolean(payload?.allowRetake),
    award_points: payload?.givePoint !== false,
    status: "active",
    created_by: creator.id,
  }).select("id,title").single();
  if (error) throw error;
  try {
    const { error: ewError } = await admin.from("teacher_exam_words").insert((words ?? []).map((w: any, i: number) => ({
      exam_id: exam.id, position: i + 1, word_id: null, source: "school_vocabulary", day: null,
      word: w.word, meaning: w.meaning, example: w.example, translation: w.translation, enabled: true,
    })));
    if (ewError) throw ewError;
    const { error: eaError } = await admin.from("exam_assignments").insert(targets.map((x: any) => ({ exam_id: exam.id, user_id: x.user_id })));
    if (eaError) throw eaError;
    const { error: nError } = await admin.from("notifications").insert(targets.map((x: any) => ({
      user_id: x.user_id, exam_id: exam.id, type: "assignment",
      title: "새로운 수행평가 단어시험이 등록되었습니다.",
      body: `${exam.title} 시험을 확인해주세요.`,
    })));
    if (nError) throw nError;
  } catch (e) {
    await admin.from("teacher_exams").delete().eq("id", exam.id);
    throw e;
  }
  return { success: true, examId: exam.id, title: exam.title, questionCount, targetCount: targets.length };
}

async function studentListBooks(token: unknown) {
  const p = await requireStudent(token);
  const { data, error } = await admin.from("school_vocab_assignments").select(
    "assigned_at,school_vocab_books!inner(id,title,school_name,grade_label,description,enabled,updated_at,school_vocab_words(count))",
  ).eq("user_id", p.id).eq("school_vocab_books.enabled", true).order("assigned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((x: any) => ({
    bookId: x.school_vocab_books.id,
    title: x.school_vocab_books.title,
    schoolName: x.school_vocab_books.school_name,
    gradeLabel: x.school_vocab_books.grade_label,
    description: x.school_vocab_books.description,
    wordCount: x.school_vocab_books.school_vocab_words?.[0]?.count ?? 0,
    assignedAt: x.assigned_at,
    updatedAt: x.school_vocab_books.updated_at,
  }));
}

async function studentGetBook(token: unknown, payload: any) {
  const p = await requireStudent(token);
  const bookId = str(payload?.bookId);
  const { data: assignment } = await admin.from("school_vocab_assignments").select("book_id").eq("book_id", bookId).eq("user_id", p.id).maybeSingle();
  if (!assignment) throw new Error("배정되지 않은 수행평가 단어장입니다.");
  const [{ data: book, error: bookError }, { data: words, error: wordError }] = await Promise.all([
    admin.from("school_vocab_books").select("id,title,school_name,grade_label,description,enabled").eq("id", bookId).single(),
    admin.from("school_vocab_words").select("position,word,meaning,example,translation").eq("book_id", bookId).order("position"),
  ]);
  if (bookError) throw bookError;
  if (wordError) throw wordError;
  if (!book.enabled) throw new Error("현재 사용할 수 없는 수행평가 단어장입니다.");
  return { bookId: book.id, title: book.title, schoolName: book.school_name, gradeLabel: book.grade_label, description: book.description, words: words ?? [] };
}

async function studentSaveSelfTestResult(token: unknown, payload: any) {
  const p = await requireStudent(token);
  const bookId = str(payload?.bookId);
  const { data: assignment } = await admin.from("school_vocab_assignments").select("book_id").eq("book_id", bookId).eq("user_id", p.id).maybeSingle();
  if (!assignment) throw new Error("배정되지 않은 수행평가 단어장입니다.");
  const count = Math.max(0, num(payload?.questionCount));
  const correct = Math.max(0, Math.min(count, num(payload?.correctCount)));
  const score = count ? Math.round(correct / count * 100) : 0;
  const wrongWords = Array.isArray(payload?.wrongWords) ? payload.wrongWords.slice(0, 500) : [];
  const { error } = await admin.from("school_vocab_test_results").insert({
    book_id: bookId, user_id: p.id, question_type: str(payload?.questionType) || "mixed",
    question_count: count, correct_count: correct, score, wrong_words: wrongWords,
  });
  if (error) throw error;
  return { success: true, score };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(new Error("POST 요청만 지원합니다."), 405);
  try {
    const body = await req.json();
    const action = str(body?.action);
    const token = body?.token;
    const payload = body?.payload ?? {};
    let result: unknown;
    switch (action) {
      case "teacherSetup": result = await teacherSetup(token); break;
      case "teacherGetBook": result = await teacherGetBook(token, payload); break;
      case "teacherSaveBook": result = await teacherSaveBook(token, payload); break;
      case "teacherDeleteBook": result = await teacherDeleteBook(token, payload); break;
      case "teacherCreateExam": result = await teacherCreateExam(token, payload); break;
      case "studentListBooks": result = await studentListBooks(token); break;
      case "studentGetBook": result = await studentGetBook(token, payload); break;
      case "studentSaveSelfTestResult": result = await studentSaveSelfTestResult(token, payload); break;
      default: throw new Error("지원하지 않는 수행평가 단어장 요청입니다.");
    }
    return ok(result);
  } catch (e) {
    console.error(e);
    return fail(e);
  }
});
