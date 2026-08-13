from pathlib import Path
import re
import sys


START = '    case "studentSubmitTeacherExam": {'
END = '    case "studentSaveTeacherExamProgress": {'


NEW_BLOCK = r'''    case "studentSubmitTeacherExam": {
      const payload: any = args[1] ?? {};
      const p = await profileFromToken(args[0]);
      const id = str(payload.examId);
      const { data: exam, error } = await admin.from("teacher_exams").select(
        "*,word_sets(name),teacher_exam_words(*)",
      ).eq("id", id).single();
      if (error) throw error;
      const { data: assignment, error: assignmentError } = await admin
        .from("exam_assignments").select("attempt,highest_score")
        .eq("exam_id", id).eq("user_id", p.id).single();
      if (assignmentError || !assignment) {
        throw assignmentError ?? new Error("배정되지 않은 시험입니다.");
      }
      const questions = teacherQuestions(
        exam.teacher_exam_words ?? [],
        str(exam.question_type),
      ).slice(0, num(exam.question_count, 100));
      const answers = new Map(
        (Array.isArray(payload.answers) ? payload.answers : []).map((x: any) => [
          str(x.questionId), str(x.answer),
        ]),
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
      const score = totalCount ? Math.round(correctCount / totalCount * 100) : 0;
      const earned = Math.max(0, Math.round(totalCount * score / 100));
      const grade = score >= 100 ? "S" : score >= 90 ? "A" : score >= 80
        ? "B" : score >= 70 ? "C" : "D";
      const testId = uuid();
      const wrongWords = details.filter((x: any) => !x.isCorrect).map((d: any) => {
        const q = questions.find((x: any) => x.questionId === d.questionId);
        return {
          word_set_id: exam.word_set_id ?? null,
          word: q.english,
          meaning: q.meaning,
          day: q.day || null,
          example: q.example || "",
          translation: q.translation || "",
        };
      });
      const resultRow = {
        id: testId,
        user_id: p.id,
        test_kind: "teacher",
        teacher_exam_id: id,
        word_set_id: exam.word_set_id ?? null,
        start_day: exam.start_day ?? null,
        end_day: exam.end_day ?? null,
        question_type: str(exam.question_type),
        question_count: totalCount,
        correct_count: correctCount,
        score,
        grade,
        points: earned,
        attempt: num(assignment.attempt) + 1,
        raw_result: {
          testKind: "teacher",
          examId: id,
          sheetName: exam.word_sets?.name ?? "",
          questionType: exam.question_type,
          questionCount: totalCount,
          correctCount,
          score,
        },
      };
      const { data: saved, error: saveError } = await admin.rpc(
        "submit_teacher_exam_atomic",
        {
          p_user_id: p.id,
          p_exam_id: id,
          p_test_id: testId,
          p_result: resultRow,
          p_wrongs: wrongWords,
          p_base_xp: earned,
        },
      );
      if (saveError) throw saveError;

      const emblemState: any = await dispatch(
        "getStudentEmblems", [str(args[0])], context,
      );
      const experience = emblemState?.experience ?? await experienceView(p.id);
      const awardedXp = num(saved?.awarded_xp);
      const awardedPoints = num(saved?.awarded_points);
      return {
        success: true,
        result: {
          success: true,
          testResultId: testId,
          title: exam.title,
          score,
          grade,
          passingScore: exam.passing_score,
          passed: score >= num(exam.passing_score, 60),
          correctCount,
          totalCount,
          questionCount: totalCount,
          wrongCount: wrongWords.length,
          savedWrongWordCount: num(saved?.saved_wrong_count, wrongWords.length),
          points: awardedPoints,
          point: awardedPoints,
          earnedXp: awardedXp,
          firstCompletion: saved?.first_completion === true,
          details,
          experience: {
            ...experience,
            earnedXp: awardedXp,
            newlyGrantedEmblems: emblemState?.newlyGrantedEmblems ?? [],
          },
        },
      };
    }
'''


PUSH_START = "async function sendPushToStudents(userIds: string[], payload: Json) {"
PUSH_END = "async function recordDailyActivity(userId: string) {"
NEW_PUSH_BLOCK = r'''async function sendPushToStudents(userIds: string[], payload: Json) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) {
    return { sent: 0, failed: 0, configured: true, sentUserIds: [], failedUserIds: [] };
  }
  if (!configureWebPush()) {
    return { sent: 0, failed: ids.length, configured: false, sentUserIds: [], failedUserIds: ids };
  }
  const { data: subscriptions, error } = await admin
    .from("student_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", ids).eq("enabled", true);
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  const successfulUsers = new Set<string>();
  await Promise.all((subscriptions ?? []).map(async (subscription: any) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), { TTL: 86400, urgency: "high" });
      sent++;
      successfulUsers.add(str(subscription.user_id));
      const { error: updateError } = await admin.from("student_push_subscriptions").update({
        last_success_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", subscription.id);
      if (updateError) console.error("push success status update failed", updateError);
    } catch (pushError: any) {
      failed++;
      const statusCode = num(pushError?.statusCode);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("student_push_subscriptions").delete().eq("id", subscription.id);
      } else {
        await admin.from("student_push_subscriptions").update({
          last_error: str(pushError?.message).slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq("id", subscription.id);
      }
    }
  }));
  const sentUserIds = [...successfulUsers];
  const failedUserIds = ids.filter((id) => !successfulUsers.has(str(id)));
  return {
    sent,
    failed,
    configured: true,
    sentUserIds,
    failedUserIds,
  };
}

'''


CREATE_WRITE_START = '  await admin.from("teacher_exam_words").insert('
CREATE_WRITE_END = "}\n\nasync function requestRetake("
NEW_CREATE_WRITE_BLOCK = r'''  const { error: wordInsertError } = await admin.from("teacher_exam_words").insert(
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
  if (wordInsertError) {
    await admin.from("teacher_exams").delete().eq("id", exam.id);
    throw wordInsertError;
  }
  const { error: assignmentInsertError } = await admin.from("exam_assignments").insert(
    students.map((s: any) => ({
      exam_id: exam.id,
      user_id: s.id,
      notified: false,
      notified_at: null,
    })),
  );
  if (assignmentInsertError) {
    await admin.from("teacher_exams").delete().eq("id", exam.id);
    throw assignmentInsertError;
  }
  const { error: notificationInsertError } = await admin.from("notifications").insert(
    students.map((s: any) => ({
      user_id: s.id,
      exam_id: exam.id,
      type: "assignment",
      title: "새로운 단어시험이 등록되었습니다.",
      body: `${str(p.creator) || creator.display_name || "관리자"} 선생님이 ${
        str(p.title)
      } 시험을 등록했습니다. 마감 시간까지 응시해 주세요.`,
    })),
  );
  if (notificationInsertError) {
    await admin.from("teacher_exams").delete().eq("id", exam.id);
    throw notificationInsertError;
  }
  const push = await sendPushToStudents(students.map((s: any) => s.id), {
    title: "새로운 선생님 시험",
    body: `${str(p.title) || "단어시험"} 시험이 배정되었습니다. 마감 시간까지 응시해 주세요.`,
    url: "./?push=teacher-exams",
    examId: exam.id,
    tag: `teacher-exam-${exam.id}`,
  }).catch((pushError) => {
    console.error("teacher exam push failed", pushError);
    return {
      sent: 0,
      failed: students.length,
      configured: false,
      sentUserIds: [],
      failedUserIds: students.map((s: any) => s.id),
    };
  });
  if (push.sentUserIds.length) {
    const { error: notifiedError } = await admin.from("exam_assignments").update({
      notified: true,
      notified_at: new Date().toISOString(),
    }).eq("exam_id", exam.id).in("user_id", push.sentUserIds);
    if (notifiedError) console.error("assignment push status update failed", notifiedError);
  }
  return {
    success: true,
    message: `선생님 시험이 생성되었습니다.\n앱 알림 저장: ${students.length}명\n푸시 성공: ${push.sentUserIds.length}명\n푸시 미수신: ${push.failedUserIds.length}명`,
    examId: exam.id,
    title: p.title,
    totalWords: words.length,
    questionCount,
    targetCount: students.length,
    assignedCount: students.length,
    appNotificationSavedCount: students.length,
    pushSentCount: push.sent,
    pushFailedCount: push.failed,
    pushSentStudentCount: push.sentUserIds.length,
    pushFailedStudentCount: push.failedUserIds.length,
    pushConfigured: push.configured,
  };

'''


REMINDER_START = '    case "teacherSendReminder": {'
REMINDER_END = '    case "teacherRequestRetakeStudent":'
NEW_REMINDER_BLOCK = r'''    case "teacherSendReminder": {
      await requireStaff(args[0]);
      const id = str(args[1]);
      const { data: exam, error: examError } = await admin.from("teacher_exams")
        .select("title").eq("id", id).single();
      if (examError) throw examError;
      const { data, error: assignmentError } = await admin.from("exam_assignments")
        .select("user_id").eq("exam_id", id).neq("status", "completed");
      if (assignmentError) throw assignmentError;
      const users = (data ?? []).map((x: any) => x.user_id);
      if (users.length) {
        const { error: notificationError } = await admin.from("notifications").insert(
          users.map((user_id) => ({
            user_id,
            exam_id: id,
            type: "reminder",
            title: "시험 응시 알림",
            body: `${str(exam?.title) || "배정된 시험"}을 확인해주세요.`,
          })),
        );
        if (notificationError) throw notificationError;
      }
      const push = await sendPushToStudents(users, {
        title: "선생님 시험 응시 알림",
        body: `${str(exam?.title) || "배정된 시험"}을 확인해주세요.`,
        url: "./?push=teacher-exams",
        examId: id,
        tag: `teacher-exam-reminder-${id}`,
      }).catch((pushError) => {
        console.error("teacher reminder push failed", pushError);
        return { sent: 0, failed: users.length, configured: false, sentUserIds: [], failedUserIds: users };
      });
      if (push.sentUserIds.length) {
        await admin.from("exam_assignments").update({
          notified: true,
          notified_at: new Date().toISOString(),
        }).eq("exam_id", id).in("user_id", push.sentUserIds);
      }
      return {
        success: true,
        sentCount: users.length,
        appNotificationSavedCount: users.length,
        pushSentStudentCount: push.sentUserIds.length,
        pushFailedStudentCount: push.failedUserIds.length,
        pushConfigured: push.configured,
        message: `미완료 학생 ${users.length}명에게 앱 알림을 저장하고, ${push.sentUserIds.length}명에게 푸시를 보냈습니다.`,
      };
    }
'''


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("사용법: python tools\\apply_teacher_exam_backend_fix.py supabase\\functions\\api\\index.ts")
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    replacements = [
        (START, END, NEW_BLOCK, "시험 제출"),
        (PUSH_START, PUSH_END, NEW_PUSH_BLOCK, "푸시 발송"),
        (CREATE_WRITE_START, CREATE_WRITE_END, NEW_CREATE_WRITE_BLOCK, "시험 생성 알림"),
        (REMINDER_START, REMINDER_END, NEW_REMINDER_BLOCK, "미완료 알림 재전송"),
    ]
    updated = text
    for start, end, block, label in replacements:
        pattern = re.escape(start) + r".*?(?=" + re.escape(end) + r")"
        updated, count = re.subn(pattern, block, updated, count=1, flags=re.S)
        if count != 1:
            raise SystemExit(f"현재 백엔드 코드에서 {label} 부분을 찾지 못했습니다. 파일 버전을 확인해주세요.")
    if updated == text:
        raise SystemExit("현재 백엔드 코드에서 교체할 제출 함수를 찾지 못했습니다. 파일 버전을 확인해주세요.")
    path.write_text(updated, encoding="utf-8", newline="\n")
    print("선생님 시험 백엔드 수정 완료:", path)


if __name__ == "__main__":
    main()
