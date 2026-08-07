import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type Json = Record<string, unknown>;
const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }), { headers: { ...cors, "Content-Type": "application/json" } });
const fail = (e: unknown, status = 400) => new Response(JSON.stringify({ success: false, message: e instanceof Error ? e.message : String(e) }), { status, headers: { ...cors, "Content-Type": "application/json" } });
const str = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const uuid = () => crypto.randomUUID();
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");
const studentEmail = (id: string) => `${id.toLowerCase().replace(/[^a-z0-9._-]/g, "-")}@student.hansalmae.local`;

async function profileFromToken(token: unknown) {
  const value = str(token);
  if (!value) throw new Error("로그인 정보가 없습니다.");
  const { data, error } = await admin.auth.getUser(value);
  if (error || !data.user) throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해주세요.");
  const { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).single();
  if (!profile?.enabled) throw new Error("현재 사용할 수 없는 계정입니다.");
  return profile;
}

async function requireStaff(token: unknown) {
  const hash = await sha256(str(token));
  const { data } = await admin.from("admin_sessions").select("expires_at").eq("token_hash", hash).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) throw new Error("관리자 로그인이 만료되었습니다. 다시 로그인해주세요.");
}

function studentView(p: any) {
  const year = new Date().getFullYear();
  const grades = ["중1", "중2", "중3", "고1", "고2", "고3", "졸업"];
  const start = grades.indexOf(str(p.base_grade).replace(/\s/g, ""));
  const grade = start < 0 || !p.base_year ? p.base_grade : grades[Math.min(start + Math.max(year - Number(p.base_year), 0), grades.length - 1)];
  return { studentId: p.student_id, studentName: p.display_name, grade, baseGrade: p.base_grade, baseYear: p.base_year };
}

async function signupStudent(args: unknown[]) {
  const input = (args[0] ?? {}) as Json;
  const id = str(input.studentId ?? args[0]).toLowerCase();
  const password = str(input.password ?? args[1]);
  const name = str(input.studentName ?? input.name ?? args[2]);
  const grade = str(input.baseGrade ?? input.grade ?? args[3]);
  const year = num(input.baseYear ?? args[4], new Date().getFullYear());
  const signupCode = str(input.signupCode);
  if (!/^[a-z0-9._-]{3,30}$/.test(id)) throw new Error("학생ID는 영문 소문자와 숫자 3~30자로 입력해주세요.");
  if (password.length < 6) throw new Error("비밀번호는 6자 이상 입력해주세요.");
  if (!name) throw new Error("학생 이름을 입력해주세요.");
  if (!Deno.env.get("SIGNUP_CODE") || signupCode !== str(Deno.env.get("SIGNUP_CODE"))) return { success: false, message: "가입코드가 올바르지 않습니다." };
  const { data: exists } = await admin.from("profiles").select("id").eq("student_id", id).maybeSingle();
  if (exists) return { success: false, message: "이미 사용 중인 학생ID입니다." };
  const { data, error } = await admin.auth.admin.createUser({ email: studentEmail(id), password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("계정을 만들 수 없습니다.");
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, student_id: id, display_name: name, base_grade: grade, base_year: year, role: "student" });
  if (profileError) { await admin.auth.admin.deleteUser(data.user.id); throw profileError; }
  await admin.from("student_experience").insert({ user_id: data.user.id });
  await admin.from("vocabulary_books").insert({ user_id: data.user.id, name: "기본 단어장", is_default: true });
  return { success: true, studentId: id, message: "회원가입이 완료되었습니다." };
}

async function studentLogin(args: unknown[]) {
  const id = str(args[0]).toLowerCase(), password = str(args[1]);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: studentEmail(id), password });
  if (error || !data.session) return { success: false, message: "학생ID 또는 비밀번호가 올바르지 않습니다." };
  const profile = await profileFromToken(data.session.access_token);
  return { success: true, token: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at, student: studentView(profile) };
}

async function wordSetByName(name: unknown) {
  const { data } = await admin.from("word_sets").select("id,name").eq("name", str(name)).maybeSingle();
  if (!data) throw new Error(`단어 DB를 찾을 수 없습니다: ${str(name)}`);
  return data;
}

async function getAllDays(wordSetId: string) {
  const days: number[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
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
  const { data, error } = await admin.from("words").select("day,word,meaning,example,translation,example_answer").eq("word_set_id", set.id).gte("day", start).lte("day", end).order("day").order("sort_order");
  if (error) throw error;
  return (data ?? []).map(w => ({ day: w.day, word: w.word, meaning: w.meaning, example: w.example, translation: w.translation, exampleAnswer: w.example_answer }));
}

async function saveResult(token: unknown, result: any) {
  const p = await profileFromToken(token);
  const setName = str(result.sheetName ?? result.dbName ?? result.wordType);
  const { data: set } = setName ? await admin.from("word_sets").select("id").eq("name", setName).maybeSingle() : { data: null };
  const count = num(result.questionCount ?? result.totalQuestions ?? result.problemCount);
  const correct = num(result.correctCount ?? result.correctAnswers);
  const score = num(result.score, count ? Math.round(correct / count * 100) : 0);
  const id = uuid();
  const row = { id, user_id: p.id, test_kind: str(result.testKind ?? result.examType ?? "free"), teacher_exam_id: result.examId || null, word_set_id: set?.id ?? null, start_day: num(result.startDay) || null, end_day: num(result.endDay ?? result.lastDay) || null, question_type: str(result.questionType), question_count: count, correct_count: correct, score, grade: str(result.grade), points: num(result.points), raw_result: result };
  const { error } = await admin.from("test_results").insert(row); if (error) throw error;
  const wrongs = Array.isArray(result.wrongWords) ? result.wrongWords : Array.isArray(result.incorrectWords) ? result.incorrectWords : [];
  for (const w of wrongs) {
    const key = { user_id: p.id, word_set_id: set?.id ?? null, day: num(w.day) || null, word: str(w.word ?? w.english) };
    const { data: old } = await admin.from("wrong_words").select("id,wrong_count").match(key).maybeSingle();
    const payload = { ...key, meaning: str(w.meaning), example: str(w.example), translation: str(w.translation), last_wrong_at: new Date().toISOString(), mastered: false };
    if (old) await admin.from("wrong_words").update({ ...payload, wrong_count: old.wrong_count + 1 }).eq("id", old.id); else await admin.from("wrong_words").insert(payload);
  }
  const earned = Math.max(0, Math.round(count * score / 100));
  await grantXp(p.id, earned, `test:${id}`, { test_kind: row.test_kind, test_id: id, question_count: count, score });
  return { success: true, testResultId: id, score, correctCount: correct, points: row.points, earnedXp: earned };
}

async function grantXp(userId: string, amount: number, payoutKey: string, meta: any) {
  const { data: prior } = await admin.from("experience_logs").select("id,total_after").eq("payout_key", payoutKey).maybeSingle();
  if (prior) return prior.total_after;
  const { data: current } = await admin.from("student_experience").select("total_xp").eq("user_id", userId).maybeSingle();
  const total = num(current?.total_xp) + amount;
  const { data: level } = await admin.from("level_settings").select("level,title").lte("required_xp", total).order("required_xp", { ascending: false }).limit(1).single();
  await admin.from("student_experience").upsert({ user_id: userId, total_xp: total, level: level?.level ?? 1, title: level?.title ?? "새싹 학습자", last_earned_at: new Date().toISOString() });
  await admin.from("experience_logs").insert({ user_id: userId, earned_xp: amount, total_after: total, payout_key: payoutKey, ...meta });
  return total;
}

async function listBooks(p: any) {
  const { data } = await admin.from("vocabulary_books").select("id,name,is_default,created_at,updated_at,vocabulary_items(count)").eq("user_id", p.id).order("created_at");
  return (data ?? []).map((b: any) => ({ bookId: b.id, name: b.name, isDefault: b.is_default, wordCount: b.vocabulary_items?.[0]?.count ?? 0, createdAt: b.created_at, updatedAt: b.updated_at }));
}

async function personalItem(input: any, p: any, bookId?: unknown) {
  let target = str(bookId);
  if (!target) { const { data } = await admin.from("vocabulary_books").select("id").eq("user_id", p.id).eq("is_default", true).single(); target = data.id; }
  const setName = str(input.sheetName ?? input.dbName ?? input.wordType);
  const { data: set } = setName ? await admin.from("word_sets").select("id").eq("name", setName).maybeSingle() : { data: null };
  return { user_id: p.id, book_id: target, word_set_id: set?.id ?? null, day: num(input.day) || null, word: str(input.word ?? input.english), meaning: str(input.meaning), example: str(input.example), translation: str(input.translation ?? input.exampleTranslation) };
}

async function dispatch(name: string, args: unknown[]) {
  switch (name) {
    case "signupStudent": return signupStudent(args);
    case "checkStudentIdDuplicate": { const { data } = await admin.from("profiles").select("id").eq("student_id", str(args[0]).toLowerCase()).maybeSingle(); return !data; }
    case "studentLogin": return studentLogin(args);
    case "checkStudentSession": { try { const p = await profileFromToken(args[0]); return { success: true, student: studentView(p) }; } catch (e) { return { success: false, message: e instanceof Error ? e.message : String(e) }; } }
    case "studentLogout": return { success: true };
    case "claimDailyAttendanceBonus": { const p = await profileFromToken(args[0]); const day = new Date().toISOString().slice(0, 10); const key = `attendance:${p.id}:${day}`; const { data: prior } = await admin.from("bonus_xp_logs").select("xp,total_after").eq("payout_key", key).maybeSingle(); if (prior) return { success: true, alreadyClaimed: true, xp: 0, totalXp: prior.total_after }; const total = await grantXp(p.id, 10, key, { test_kind: "attendance", question_count: 0, score: 0 }); await admin.from("bonus_xp_logs").insert({ user_id: p.id, bonus_type: "attendance", xp: 10, payout_key: key, total_after: total }); return { success: true, alreadyClaimed: false, xp: 10, totalXp: total }; }
    case "checkAdminCode": return str(args[0]) === str(Deno.env.get("ADMIN_CODE"));
    case "adminLogin": { if (str(args[0]) !== str(Deno.env.get("ADMIN_CODE"))) throw new Error("관리자 코드가 올바르지 않습니다."); const token = uuid() + uuid(); await admin.from("admin_sessions").insert({ token_hash: await sha256(token), expires_at: new Date(Date.now() + 8 * 3600000).toISOString() }); return { success: true, token, expiresAt: new Date(Date.now() + 8 * 3600000).toISOString() }; }
    case "adminLogout": { await admin.from("admin_sessions").delete().eq("token_hash", await sha256(str(args[0]))); return { success: true }; }
    case "getSheetNames": { const { data } = await admin.from("word_sets").select("name").eq("enabled", true).order("sort_order"); return (data ?? []).map(x => x.name); }
    case "getDays": { const set = await wordSetByName(args[0]); return getAllDays(set.id); }
    case "getWords": return getWords(args);
    case "getVocabularyWords": return getWords(args, true);
    case "saveTestResult": return saveResult(args[0], args[1]);
    case "saveStudentTestProgress": { const p = await profileFromToken(args[0]); await admin.from("exam_progress").upsert({ user_id: p.id, exam_id: null, scope_key: "free", progress: args[1] ?? {}, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }, { onConflict: "user_id,scope_key" }); return { success: true }; }
    case "getStudentTestProgress": { const p = await profileFromToken(args[0]); const { data } = await admin.from("exam_progress").select("progress,updated_at").eq("user_id", p.id).eq("scope_key", "free").maybeSingle(); return data?.progress ?? null; }
    case "deleteStudentTestProgress": { const p = await profileFromToken(args[0]); await admin.from("exam_progress").delete().eq("user_id", p.id).eq("scope_key", "free"); return { success: true }; }
    case "getWrongNotebook": { const p = await profileFromToken(args[0]); const { data } = await admin.from("wrong_words").select("*,word_sets(name)").eq("user_id", p.id).order("last_wrong_at", { ascending: false }); return (data ?? []).map((x: any) => ({ rowNumber: x.id, id: x.id, sheetName: x.word_sets?.name ?? "", day: x.day, word: x.word, meaning: x.meaning, example: x.example, translation: x.translation, wrongCount: x.wrong_count, firstWrongDate: x.first_wrong_at, lastWrongDate: x.last_wrong_at, mastered: x.mastered })); }
    case "getWrongNotebookCount": { const p = await profileFromToken(args[0]); const { count } = await admin.from("wrong_words").select("id", { count: "exact", head: true }).eq("user_id", p.id).eq("mastered", false); return count ?? 0; }
    case "setWrongWordMastered": { const p = await profileFromToken(args[0]); await admin.from("wrong_words").update({ mastered: Boolean(args[2]) }).eq("id", str(args[1])).eq("user_id", p.id); return { success: true }; }
    case "deleteMasteredWrongWord": { const p = await profileFromToken(args[0]); await admin.from("wrong_words").delete().eq("id", str(args[1])).eq("user_id", p.id).eq("mastered", true); return { success: true }; }
    case "deleteAllMasteredWrongWords": { const p = await profileFromToken(args[0]); await admin.from("wrong_words").delete().eq("user_id", p.id).eq("mastered", true); return { success: true }; }
    case "deleteSelectedMasteredWrongWords": { const p = await profileFromToken(args[0]); await admin.from("wrong_words").delete().eq("user_id", p.id).eq("mastered", true).in("id", (args[1] as unknown[])?.map(str) ?? []); return { success: true }; }
    case "getVocabularyBooks": { const p = await profileFromToken(args[0]); return listBooks(p); }
    case "createVocabularyBook": { const p = await profileFromToken(args[0]); const { data, error } = await admin.from("vocabulary_books").insert({ user_id: p.id, name: str(args[1]) }).select().single(); if (error) throw error; return { success: true, bookId: data.id, book: { bookId: data.id, name: data.name } }; }
    case "renameVocabularyBook": { const p = await profileFromToken(args[0]); await admin.from("vocabulary_books").update({ name: str(args[2]) }).eq("id", str(args[1])).eq("user_id", p.id); return { success: true }; }
    case "deleteVocabularyBook": { const p = await profileFromToken(args[0]); const { data } = await admin.from("vocabulary_books").select("is_default").eq("id", str(args[1])).eq("user_id", p.id).single(); if (data.is_default) throw new Error("기본 단어장은 삭제할 수 없습니다."); await admin.from("vocabulary_books").delete().eq("id", str(args[1])).eq("user_id", p.id); return { success: true }; }
    case "getPersonalVocabularyByBook": { const p = await profileFromToken(args[0]); const { data } = await admin.from("vocabulary_items").select("*,word_sets(name)").eq("user_id", p.id).eq("book_id", str(args[1])).order("created_at", { ascending: false }); return (data ?? []).map((x: any) => ({ rowNumber: x.id, id: x.id, bookId: x.book_id, sheetName: x.word_sets?.name ?? "", day: x.day, word: x.word, meaning: x.meaning, example: x.example, translation: x.translation, mastered: x.mastered, registeredAt: x.created_at })); }
    case "getPersonalVocabulary": { const p = await profileFromToken(args[0]); const books = await listBooks(p); const book = books.find((x: any) => x.isDefault) ?? books[0]; args[1] = book?.bookId; return dispatch("getPersonalVocabularyByBook", args); }
    case "getPersonalVocabularyCount": { const p = await profileFromToken(args[0]); const { count } = await admin.from("vocabulary_items").select("id", { count: "exact", head: true }).eq("user_id", p.id); return count ?? 0; }
    case "addPersonalVocabulary": { const p = await profileFromToken(args[0]); const row = await personalItem(args[1], p); const { error } = await admin.from("vocabulary_items").upsert(row, { onConflict: "user_id,book_id,word_set_id,day,word", ignoreDuplicates: true }); if (error) throw error; return { success: true }; }
    case "addPersonalVocabularyToBook": { const p = await profileFromToken(args[0]); const row = await personalItem(args[2], p, args[1]); const { error } = await admin.from("vocabulary_items").upsert(row, { onConflict: "user_id,book_id,word_set_id,day,word", ignoreDuplicates: true }); if (error) throw error; return { success: true }; }
    case "addPersonalVocabularyBatchToBook": { const p = await profileFromToken(args[0]); const rows = []; for (const x of (args[2] as any[] ?? [])) rows.push(await personalItem(x, p, args[1])); if (rows.length) await admin.from("vocabulary_items").upsert(rows, { onConflict: "user_id,book_id,word_set_id,day,word", ignoreDuplicates: true }); return { success: true, addedCount: rows.length }; }
    case "removePersonalVocabulary": { const p = await profileFromToken(args[0]); await admin.from("vocabulary_items").delete().eq("id", str(args[1])).eq("user_id", p.id); return { success: true }; }
    case "setPersonalWordMastered": { const p = await profileFromToken(args[0]); await admin.from("vocabulary_items").update({ mastered: Boolean(args[2]) }).eq("id", str(args[1])).eq("user_id", p.id); return { success: true }; }
    case "movePersonalVocabularyToBook": { const p = await profileFromToken(args[0]); await admin.from("vocabulary_items").update({ book_id: str(args[2]) }).eq("id", str(args[1])).eq("user_id", p.id); return { success: true }; }
    case "movePersonalVocabularyBatchToBook": { const p = await profileFromToken(args[0]); await admin.from("vocabulary_items").update({ book_id: str(args[2]) }).in("id", (args[1] as any[]).map(str)).eq("user_id", p.id); return { success: true }; }
    case "deletePersonalVocabularyBatch": { const p = await profileFromToken(args[0]); await admin.from("vocabulary_items").delete().in("id", (args[1] as any[]).map(str)).eq("user_id", p.id); return { success: true }; }
    case "getSmartReviewWords": { const p = await profileFromToken(args[0]); const limit = Math.min(num(args[1], 20), 100); const { data } = await admin.from("wrong_words").select("*,word_sets(name)").eq("user_id", p.id).eq("mastered", false).order("wrong_count", { ascending: false }).limit(limit); return data ?? []; }
    case "getStudentExperience": { const p = await profileFromToken(args[0]); const { data: xp } = await admin.from("student_experience").select("*").eq("user_id", p.id).maybeSingle(); const { data: next } = await admin.from("level_settings").select("required_xp,title,level").gt("level", xp?.level ?? 1).order("level").limit(1).maybeSingle(); return { success: true, totalXp: xp?.total_xp ?? 0, currentLevel: xp?.level ?? 1, currentTitle: xp?.title ?? "새싹 학습자", nextLevelXp: next?.required_xp ?? null, progress: next ? Math.min(100, Math.round((xp?.total_xp ?? 0) / next.required_xp * 100)) : 100 }; }
    case "getStudentEmblems": { const p = await profileFromToken(args[0]); const { data } = await admin.from("student_emblems").select("earned_at,equipped,emblem_settings(*)").eq("user_id", p.id); return { success: true, emblems: data ?? [] }; }
    case "equipStudentEmblem": { const p = await profileFromToken(args[0]); await admin.from("student_emblems").update({ equipped: false }).eq("user_id", p.id); await admin.from("student_emblems").update({ equipped: true }).eq("user_id", p.id).eq("emblem_id", str(args[1])); return { success: true }; }
    case "getMonthlyRanking": { const start = new Date(); start.setUTCDate(1); start.setUTCHours(0,0,0,0); const { data } = await admin.from("test_results").select("user_id,points,profiles(display_name,student_id),word_sets(name)").gte("taken_at", start.toISOString()); const sums = new Map<string, any>(); for (const x of data ?? []) { const key = `${x.user_id}|${(x as any).word_sets?.name ?? "전체"}`; const old = sums.get(key) ?? { studentId: (x as any).profiles?.student_id, studentName: (x as any).profiles?.display_name, sheetName: (x as any).word_sets?.name ?? "전체", points: 0 }; old.points += x.points; sums.set(key, old); } return [...sums.values()].sort((a,b)=>b.points-a.points).map((x,i)=>({ ...x, rank:i+1 })); }
    case "getMyLearning": { const p = await profileFromToken(args[0]); const [{ data: tests }, { data: xp }] = await Promise.all([admin.from("test_results").select("*,word_sets(name)").eq("user_id", p.id).order("taken_at", { ascending: false }).limit(100), admin.from("student_experience").select("*").eq("user_id", p.id).maybeSingle()]); return { success: true, student: studentView(p), summary: { testCount: tests?.length ?? 0, totalPoints: (tests ?? []).reduce((s,x)=>s+x.points,0), totalXp: xp?.total_xp ?? 0 }, recentTests: tests ?? [] }; }
    case "teacherGetSetupData": { await requireStaff(args[0]); const [{ data: sets }, { data: students }] = await Promise.all([admin.from("word_sets").select("name").eq("enabled", true).order("sort_order"), admin.from("profiles").select("student_id,display_name,base_grade,base_year").eq("role", "student").eq("enabled", true).order("display_name")]); return { dbSheets: (sets ?? []).map(x=>x.name), students: (students ?? []).map(x=>({ studentId:x.student_id, studentName:x.display_name, grade:x.base_grade, baseGrade:x.base_grade, baseYear:x.base_year })), questionModes: ["영어→뜻","뜻→영어","예문 빈칸"] }; }
    case "teacherCreateExam": return teacherCreate(args);
    case "teacherListExams": { await requireStaff(args[0]); const { data } = await admin.from("teacher_exams").select("*,word_sets(name),exam_assignments(count)").order("created_at", { ascending: false }); return (data ?? []).map(examView); }
    case "teacherGetExamDetails": { await requireStaff(args[0]); const { data } = await admin.from("teacher_exams").select("*,word_sets(name),teacher_exam_words(*),exam_assignments(*,profiles(student_id,display_name))").eq("id", str(args[1])).single(); return examView(data, true); }
    case "teacherGetExamStatus": { await requireStaff(args[0]); const { data } = await admin.from("exam_assignments").select("*,profiles(student_id,display_name)").eq("exam_id", str(args[1])); return { examId: str(args[1]), students: (data ?? []).map((x:any)=>({ studentId:x.profiles.student_id, studentName:x.profiles.display_name, status:x.status, attempt:x.attempt, highestScore:x.highest_score, completedAt:x.completed_at, teacherConfirmed:x.teacher_confirmed })) }; }
    case "teacherCancelExam": { await requireStaff(args[0]); await admin.from("teacher_exams").update({ status: "cancelled" }).eq("id", str(args[1])); return { success: true }; }
    case "teacherSendReminder": { await requireStaff(args[0]); const id = str(args[1]); const { data } = await admin.from("exam_assignments").select("user_id").eq("exam_id", id).neq("status", "completed"); if (data?.length) await admin.from("notifications").insert(data.map(x=>({ user_id:x.user_id, exam_id:id, type:"reminder", title:"시험 응시 알림", body:"배정된 시험을 확인해주세요." }))); return { success: true, sentCount: data?.length ?? 0 }; }
    case "teacherRequestRetakeStudent": return requestRetake(args, [str(args[2])]);
    case "teacherRequestRetakeAll": return requestRetake(args);
    case "teacherRequestRetakeBelowScore": return requestRetake(args, undefined, num(args[2]));
    case "studentGetAssignedExams": { const p = await profileFromToken(args[0]); const { data } = await admin.from("exam_assignments").select("*,teacher_exams(*,word_sets(name))").eq("user_id", p.id).order("assigned_at", { ascending: false }); return (data ?? []).map((x:any)=>({ ...examView(x.teacher_exams), assignmentStatus:x.status, attempt:x.attempt, highestScore:x.highest_score })); }
    case "studentStartTeacherExam": { const p = await profileFromToken(args[0]); const id = str(args[1]); const { data: exam } = await admin.from("teacher_exams").select("*,teacher_exam_words(*)").eq("id", id).single(); const { data: assignment } = await admin.from("exam_assignments").select("*").eq("exam_id", id).eq("user_id", p.id).single(); if (!assignment) throw new Error("배정되지 않은 시험입니다."); if (exam.status === "cancelled") throw new Error("취소된 시험입니다."); await admin.from("exam_assignments").update({ status:"in_progress" }).eq("exam_id",id).eq("user_id",p.id); return { exam: examView(exam), words: (exam.teacher_exam_words ?? []).filter((x:any)=>x.enabled).sort((a:any,b:any)=>a.position-b.position), attempt: assignment.attempt + 1 }; }
    case "studentSubmitTeacherExam": { const payload:any = args[1] ?? {}; payload.testKind="teacher"; const result:any = await saveResult(args[0], payload); const p=await profileFromToken(args[0]); const id=str(payload.examId); const { data:a }=await admin.from("exam_assignments").select("attempt,highest_score").eq("exam_id",id).eq("user_id",p.id).single(); await admin.from("exam_assignments").update({ status:"completed", attempt:(a?.attempt??0)+1, highest_score:Math.max(num(a?.highest_score),result.score), completed_at:new Date().toISOString() }).eq("exam_id",id).eq("user_id",p.id); return result; }
    case "studentSaveTeacherExamProgress": { const p=await profileFromToken(args[0]); const id=str(args[1]); await admin.from("exam_progress").upsert({ user_id:p.id,exam_id:id,scope_key:`teacher:${id}`,progress:args[2]??{},expires_at:new Date(Date.now()+7*86400000).toISOString() }, {onConflict:"user_id,scope_key"}); return {success:true}; }
    case "studentGetTeacherExamProgress": { const p=await profileFromToken(args[0]); const {data}=await admin.from("exam_progress").select("progress").eq("user_id",p.id).eq("scope_key",`teacher:${str(args[1])}`).maybeSingle(); return data?.progress??null; }
    case "studentDeleteTeacherExamProgress": { const p=await profileFromToken(args[0]); await admin.from("exam_progress").delete().eq("user_id",p.id).eq("scope_key",`teacher:${str(args[1])}`); return {success:true}; }
    case "studentStopTeacherExam": { const p=await profileFromToken(args[0]); await admin.from("exam_assignments").update({status:"assigned"}).eq("exam_id",str(args[1])).eq("user_id",p.id); return {success:true}; }
    case "studentGetNotifications": { const p=await profileFromToken(args[0]); const {data}=await admin.from("notifications").select("*").eq("user_id",p.id).order("created_at",{ascending:false}); return (data??[]).map((x:any)=>({notificationId:x.id,examId:x.exam_id,type:x.type,title:x.title,content:x.body,read:Boolean(x.read_at),createdAt:x.created_at,readAt:x.read_at})); }
    case "studentMarkNotificationRead": { const p=await profileFromToken(args[0]); await admin.from("notifications").update({read_at:new Date().toISOString()}).eq("id",str(args[1])).eq("user_id",p.id); return {success:true}; }
    case "studentDeleteNotification": { const p=await profileFromToken(args[0]); await admin.from("notifications").delete().eq("id",str(args[1])).eq("user_id",p.id); return {success:true}; }
    case "studentDeleteAllReadNotifications": { const p=await profileFromToken(args[0]); await admin.from("notifications").delete().eq("user_id",p.id).not("read_at","is",null); return {success:true}; }
    default: throw new Error(`지원하지 않는 함수입니다: ${name}`);
  }
}

function examView(x:any, details=false) { if(!x)return null; return { examId:x.id, examTitle:x.title, title:x.title, sourceType:x.source_type, dbName:x.word_sets?.name??"", startDay:x.start_day, endDay:x.end_day, questionCount:x.question_count, questionType:x.question_type, targetType:x.target_type, targetValue:x.target_value, startDateTime:x.starts_at, endDateTime:x.ends_at, passingScore:x.passing_score, allowRetake:x.allow_retake, awardPoints:x.award_points, status:x.status, createdAt:x.created_at, assignedCount:x.exam_assignments?.[0]?.count??x.exam_assignments?.length??0, ...(details?{words:x.teacher_exam_words??[],assignments:x.exam_assignments??[]}:{}) }; }

async function teacherCreate(args:unknown[]) { await requireStaff(args[0]); const p:any=args[1]??{}; const {data:creator}=await admin.from("profiles").select("id").in("role",["teacher","admin"]).limit(1).maybeSingle(); if(!creator)throw new Error("교사 프로필이 없습니다. 설치 문서의 관리자 생성 단계를 실행해주세요."); const {data:set}=p.dbName?await admin.from("word_sets").select("id").eq("name",p.dbName).maybeSingle():{data:null}; const {data:exam,error}=await admin.from("teacher_exams").insert({title:str(p.examTitle??p.title),source_type:str(p.sourceType??"database"),word_set_id:set?.id??null,start_day:num(p.startDay)||null,end_day:num(p.endDay)||null,question_count:num(p.questionCount),question_type:str(p.questionType),target_type:str(p.targetType??"all"),target_value:p.targetValue??[],starts_at:p.startDateTime??p.startsAt??null,ends_at:p.endDateTime??p.endsAt??null,passing_score:num(p.passingScore,60),allow_retake:Boolean(p.allowRetake),award_points:p.awardPoints!==false,status:"active",created_by:creator.id}).select().single(); if(error)throw error; let words:any[]=Array.isArray(p.directWords)?p.directWords:[]; if(!words.length&&set){const {data}=await admin.from("words").select("id,day,word,meaning,example,translation").eq("word_set_id",set.id).gte("day",num(p.startDay)).lte("day",num(p.endDay)).limit(Math.max(num(p.questionCount),1000));words=data??[];} if(words.length)await admin.from("teacher_exam_words").insert(words.map((w:any,i:number)=>({exam_id:exam.id,position:i+1,word_id:w.id??null,source:w.id?"database":"manual",day:num(w.day)||null,word:str(w.word),meaning:str(w.meaning),example:str(w.example),translation:str(w.translation)}))); let students:any[]=[]; const ids=Array.isArray(p.studentIds)?p.studentIds:Array.isArray(p.targetValue)?p.targetValue:[]; if(str(p.targetType)==="all")({data:students}=await admin.from("profiles").select("id").eq("role","student").eq("enabled",true)); else if(str(p.targetType)==="grade")({data:students}=await admin.from("profiles").select("id").eq("role","student").eq("base_grade",str(p.targetGrade??p.targetValue))); else ({data:students}=await admin.from("profiles").select("id").in("student_id",ids)); if(students?.length){await admin.from("exam_assignments").insert(students.map(s=>({exam_id:exam.id,user_id:s.id})));await admin.from("notifications").insert(students.map(s=>({user_id:s.id,exam_id:exam.id,type:"assignment",title:"새 시험이 배정되었습니다",body:str(p.examTitle??p.title)})));} return {success:true,examId:exam.id,assignedCount:students?.length??0}; }

async function requestRetake(args:unknown[], studentIds?:string[], below?:number) { await requireStaff(args[0]); const examId=str(args[1]); let q=admin.from("exam_assignments").select("user_id,profiles!inner(student_id)").eq("exam_id",examId); if(studentIds?.length)q=q.in("profiles.student_id",studentIds); if(below!==undefined)q=q.lt("highest_score",below); const {data}=await q; const users=(data??[]).map((x:any)=>x.user_id); if(users.length){await admin.from("exam_assignments").update({status:"assigned",completed_at:null,teacher_confirmed:false}).eq("exam_id",examId).in("user_id",users);await admin.from("notifications").insert(users.map(user_id=>({user_id,exam_id:examId,type:"retake",title:"재시험이 요청되었습니다",body:"시험을 다시 응시해주세요."})));} return {success:true,count:users.length}; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(new Error("POST 요청만 지원합니다."), 405);
  try {
    const body = await req.json();
    if (body.action !== "call" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(str(body.functionName))) throw new Error("지원하지 않는 요청입니다.");
    return ok(await dispatch(str(body.functionName), Array.isArray(body.args) ? body.args : []));
  } catch (e) { console.error(e); return fail(e); }
});
