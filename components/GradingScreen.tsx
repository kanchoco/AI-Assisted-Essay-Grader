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

  // AI 결과
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiResult, setShowAiResult] = useState(false);

  // 상태 플래그
  const [aiDone, setAiDone] = useState(false);
  const [finalSaved, setFinalSaved] = useState(false);

    //  학생 조회
  const handleSearch = async () => {
    if (!searchText.trim()) {
      alert('학생 번호를 입력해주세요');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/student/${searchText}`);
      const data = await res.json();

      if (!res.ok) {
        alert('학생을 찾을 수 없습니다');
        return;
      }

      setStudentUid(data.student_uid);
      setStudentAnswer(data.student_answer);
      setIsGradingStarted(true);
    } catch {
      alert('서버 오류');
    }
  };

    //  AI 채점 (전문가 점수 + AI 점수)
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
          student_uid: studentUid,
          rater_uid: raterUid,          // 🔥 핵심
          expert_crt_score: Number(expertScore.critical),
          expert_knw_score: Number(expertScore.math),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert('AI 채점 실패');
        return;
      }

      setAiResult(data);
      setShowAiResult(true);
      setAiDone(true);
    } catch {
      alert('AI 서버 오류');
    }
  };

    //  점수 최종 확정
  const handleFinalSave = async () => {
    try {
      const res = await fetch(`${apiUrl}/add_final_score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_uid: studentUid,
          rater_uid: raterUid,         
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFinalSaved(true);
        alert('점수가 최종 확정되었습니다');
      } else {
        alert('저장 실패');
      }
    } catch {
      alert('서버 오류');
    }
  };

  return (
    <div className="grading-container">
      <header className="top-header">
        <div className="logo">Logo</div>
        <div className="rater-info">
          {raterId}
        </div>
        <button
          className="logout-btn"
          onClick={() => window.location.reload()}
        >
          Logout
        </button>
      </header>

      <main className="main-content">
        {/* 검색 */}
        <div className="search-section">
          <div className="search-bar-wrapper">
            <input
              type="text"
              placeholder="학생 ID 입력"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch}>Search</button>
          </div>
        </div>

        {!isGradingStarted ? (
          <div className="empty-state-container">
            <p>학생을 검색하세요</p>
          </div>
        ) : (
          <div className="workspace">
            {/* 왼쪽 */}
            <div className="left-panel">
              <h3>Student #{searchText}</h3>
              <p>{studentAnswer}</p>
            </div>

            {/* 오른쪽 */}
            <div className="right-panel">
              <h3>전문가 점수</h3>

              <input
                type="number"
                placeholder="비판적 사고"
                value={expertScore.critical}
                onChange={(e) =>
                  setExpertScore({
                    ...expertScore,
                    critical: e.target.value,
                  })
                }
                disabled={aiDone}
              />

              <input
                type="number"
                placeholder="수과학적 지식"
                value={expertScore.math}
                onChange={(e) =>
                  setExpertScore({
                    ...expertScore,
                    math: e.target.value,
                  })
                }
                disabled={aiDone}
              />

              <button onClick={handleAiGrade} disabled={aiDone}>
                AI 채점
              </button>

              {showAiResult && aiResult && (
                <div className="ai-result-section">
                  <h3>🤖 AI 채점 결과</h3>

                  <p>비판적 사고: {aiResult.scores.critical}</p>
                  <p>수과학적 지식: {aiResult.scores.scientific}</p>

                  <h4>채점 근거</h4>
                  <ul>
                    {aiResult.rationales.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>

                  <button
                    onClick={handleFinalSave}
                    disabled={finalSaved}
                  >
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
