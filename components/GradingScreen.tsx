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

  // 학생
  const [studentUid, setStudentUid] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');

  // 전문가 점수
  const [expertScore, setExpertScore] = useState({
    critical: '',
    math: '',
  });

  // AI
  const [aiResult, setAiResult] = useState<any>(null);
  const [scoreUid, setScoreUid] = useState('');
  const [aiDone, setAiDone] = useState(false);
  const [finalSaved, setFinalSaved] = useState(false);

  // 학생 조회
  const handleSearch = async () => {
    if (!searchText.trim()) {
      alert('학생 번호를 입력해주세요');
      return;
    }

    const res = await fetch(`${apiUrl}/student/${searchText}`);
    if (!res.ok) {
      alert('학생을 찾을 수 없습니다');
      return;
    }

    const data = await res.json();
    setStudentUid(data.student_uid);
    setStudentAnswer(data.student_answer);
    setIsGradingStarted(true);
  };

  // AI 채점
  const handleAiGrade = async () => {
    if (!expertScore.critical || !expertScore.math) {
      alert('전문가 점수를 입력하세요');
      return;
    }

    const res = await fetch(`${apiUrl}/ai_grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_uid: studentUid,
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
  };

  // 최종 확정
  const handleFinalSave = async () => {
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
  };

  return (
    <div className="grading-container">
      <header className="top-header">
        <div className="logo">Logo</div>
        <div>{raterId}</div>
        <button onClick={() => window.location.reload()}>Logout</button>
      </header>

      <main className="main-content">
        <input
          placeholder="학생 ID"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>Search</button>

        {isGradingStarted && (
          <div className="workspace">
            <div className="left-panel">
              <p>{studentAnswer}</p>
            </div>

            <div className="right-panel">
              <input
                type="number"
                placeholder="비판적 사고"
                value={expertScore.critical}
                disabled={aiDone}
                onChange={(e) =>
                  setExpertScore({ ...expertScore, critical: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="수과학적 지식"
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
                <>
                  <h3>AI 점수</h3>
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
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GradingScreen;
