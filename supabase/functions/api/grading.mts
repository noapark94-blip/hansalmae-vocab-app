// Grade against database records, never a client-provided answer key or total.
export function gradeEvidence(evidence: any[], candidates: any[]) {
  if (!Array.isArray(evidence) || !evidence.length || evidence.length > 2000) throw new Error('답안 정보가 없습니다. 앱을 업데이트한 뒤 시험을 다시 시작해주세요.');
  let correct = 0;
  const wrongs: any[] = [];
  for (const answer of evidence) {
    if (!['engToKor','korToEng','example'].includes(answer.type) || typeof answer.answer !== 'string') throw new Error('시험 답안을 다시 확인해주세요.');
    const matches = candidates.filter(w => w.word === answer.word && Number(w.day || 0) === Number(answer.day || 0) && String(w.word_sets?.name || '') === String(answer.sheetName || ''));
    if (!matches.length) throw new Error('시험 단어가 변경되었거나 답안 정보가 올바르지 않습니다.');
    const keys = new Set(matches.map(w => answer.type === 'engToKor' ? w.meaning : answer.type === 'example' ? (w.example_answer || w.word) : w.word));
    if (keys.size !== 1) throw new Error('같은 단어의 자료가 서로 다릅니다. 단어장을 확인해주세요.');
    if (answer.answer === [...keys][0]) correct++;
    else wrongs.push(matches[0]);
  }
  const count = evidence.length, score = Math.round(correct / count * 100);
  return {count,correct,score,wrongs};
}
