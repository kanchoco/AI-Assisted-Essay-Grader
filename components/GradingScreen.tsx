import React, { useState } from 'react';
import './Grading.css';

interface GradingProps {
  apiUrl: string;
  raterId: string;
  raterUid: string;
}

const GradingScreen: React.FC<GradingProps> = ({
  apiUrl,
  raterId,
  raterUid,
}) => {
  const [searchText, setSearchText] = useState('');
  const [isGradingStarted, setIsGradingStarted] = useState(false);

  // 학생 정보
  const [studentUid, setStudentUid] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');

  // 전문가 점수
  const [expertScore, setExpertScore] = useState({
    critical: '',
    math: '',
  });

  // AI 결과
  const [aiResult, setAiResult] = useState<any>(null);
  const [scoreUid, setScoreUid] = useState('');
  const [aiDone, setAiDone] = useState(false);
  const [finalSaved, setFinalSaved] = useState(false);

  // 학생 조회 (student_id 기준)
  const handleSearch = async () => {
    if (!searchText.trim()) {
      alert('학생 ID를 입력해주세요');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/student/${searchText}`);
      if (!res.ok) {
        alert('학생을 찾을 수 없습니다');
        return;
      }

      const data = await res.json();

      setStudentUid(data.student_uid);
      setStudentId(data.student_id);
      setStudentAnswer(data.student_answer);
      setIsGradingStarted(true);
    } catch (err) {
      alert('서버 오류');
    }
  };

  // AI 채점 (전문가 + AI)
  const handleAiGrade = async () => {
    if (!expertScore.critical || !expertScore.math) {
      alert('전문가 점수를 입력하세요');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/ai_grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_uid: studentUid,   // DB용
          student_id: studentId,     // 로그/확장용
          rater_uid: raterUid,
          expert_crt_score: Number(expertScore.critical),
          expert_knw_score: Number(expertScore.math),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert('AI 채점 실패');
        return;
      }

      setAiResult(data.ai_result);
      setScoreUid(data.score_uid);
      setAiDone(true);
    } catch (err) {
      alert('AI 서버 오류');
    }
  };

  const handleFinalSave = async () => {
    try {
      const res = await fetch(`${apiUrl}/add_final_score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score_uid: scoreUid,
          student_uid: studentUid,
          rater_uid: raterUid,
          knw_score: aiResult.scores.scientific,
          crt_score: aiResult.scores.critical,
        }),
      });

      const data = await res.json();

      if (data.status === 'ok') {
        setFinalSaved(true);
        alert('점수가 최종 확정되었습니다');
      } else {
        alert('확정 실패');
      }
    } catch (err) {
      alert('서버 오류');
    }
  };

  return (
    <div className="grading-container">
      <header className="top-header">
        <div className="logo">AI Essay Grader</div>
        <div>{raterId}</div>
        <button onClick={() => window.location.reload()}>Logout</button>
      </header>

      <main className="main-content">
        {/* 검색 */}
        <div className="search-section">
          <input
            placeholder="학생 ID 입력"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
        </div>

        {!isGradingStarted ? (
          <div className="empty-state-container">
            <p>학생 ID를 검색하세요</p>
          </div>
        ) : (
          <div className="workspace">
            {/* 왼쪽: 학생 답안 */}
            <div className="left-panel">
              <h3>Student #{studentId}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{studentAnswer}</p>
            </div>

            {/* 오른쪽: 채점 */}
            <div className="right-panel">
              <h3>전문가 채점</h3>

              <input
                type="number"
                placeholder="비판적 사고 (1~10)"
                value={expertScore.critical}
                disabled={aiDone}
                onChange={(e) =>
                  setExpertScore({ ...expertScore, critical: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="수과학적 지식 (1~10)"
                value={expertScore.math}
                disabled={aiDone}
                onChange={(e) =>
                  setExpertScore({ ...expertScore, math: e.target.value })
                }
              />

              <button onClick={handleAiGrade} disabled={aiDone}>
                AI 채점
              </button>

              {aiResult && (
                <div className="ai-result-section">
                  <h3>🤖 AI 채점 결과</h3>

                  <p>비판적 사고: {aiResult.scores.critical}</p>
                  <p>수과학적 지식: {aiResult.scores.scientific}</p>

                  <h4>채점 근거</h4>
                  <ul>
                    {[
                      ...aiResult.rationales.scientific,
                      ...aiResult.rationales.critical,
                    ].map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>

                  <button onClick={handleFinalSave} disabled={finalSaved}>
                    {finalSaved ? '확정 완료' : '점수 확정'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GradingScreen;
