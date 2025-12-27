import React, { useState } from 'react';
import './Grading.css';

interface GradingProps {
  apiUrl: string;
  raterId: string;
}

const GradingScreen: React.FC<GradingProps> = ({ apiUrl, raterId }) => {

  const [searchText, setSearchText] = useState('');
  const [isGradingStarted, setIsGradingStarted] = useState(false);

  const [studentAnswer, setStudentAnswer] = useState('');
  const [studentUid, setStudentUid] = useState('');

  const [expertScore, setExpertScore] = useState({ critical: '', math: '' });
  const [isExpertSaved, setIsExpertSaved] = useState(false);

  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiResult, setShowAiResult] = useState(false);

  // 학생 답안 조회 API
  const fetchStudentAnswer = async () => {
    try {
      const res = await fetch(`${apiUrl}/student/${searchText}`);
      const data = await res.json();

      if (data.success) {
        setStudentAnswer(data.student_answer);
        setStudentUid(data.student_uid);
        setIsGradingStarted(true);
      } else {
        alert(data.message || "학생을 찾을 수 없습니다.");
      }
    } catch {
      alert("서버 연결 오류");
    }
  };

  // 전문가 점수 저장 API
  const saveExpertScore = async () => {
    if (!expertScore.critical || !expertScore.math) {
      alert("모든 점수를 입력해주세요.");
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/rater/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_uid: studentUid,
          rater_id: raterId,
          knw_score: Number(expertScore.math),
          crt_score: Number(expertScore.critical)
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsExpertSaved(true);
        alert("점수 저장 완료!");
      } else {
        alert(data.message);
      }
    } catch {
      alert("서버 오류");
    }
  };

  // 3) AI 채점 결과 조회 API
  const fetchAiScore = async () => {
    try {
      const res = await fetch(`${apiUrl}/ai/score/${studentUid}`);
      const data = await res.json();

      if (data.success) {
        setAiResult(data);
        setShowAiResult(true);
      } else {
        alert(data.message);
      }
    } catch {
      alert("AI 서버 오류");
    }
  };

  return (
    <div className="grading-container">
      
      {/* 상단 헤더 */}
      <header className="top-header">
        <div className="logo">Logo</div>
        <button className="logout-btn" onClick={() => window.location.reload()}>
          Logout
        </button>
      </header>

      {/* 메인 */}
      <main className="main-content">

        {/* 검색창 */}
        <div className="search-section">
          <div className="search-bar-wrapper">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder="학생 ID 입력"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchStudentAnswer()}
            />
            <button className="search-btn" onClick={fetchStudentAnswer}>
              Search
            </button>
          </div>
        </div>

        {/* 검색 전 */}
        {!isGradingStarted ? (
          <div className="empty-state-container">
            <p className="empty-text">검색하면 여기에 학생 답안과 채점 화면이 나타납니다.</p>
          </div>
        ) : (
          <div className="workspace fade-in">

            {/* 학생 답안 패널 */}
            <div className="left-panel">
              <h3 className="panel-title">Student #{searchText}</h3>
              <div className="student-card active">
                <div className="card-body">
                  <p>{studentAnswer}</p>
                </div>
              </div>
            </div>

            {/* 전문가 채점 패널 */}
            <div className="right-panel">
              <div className="grading-form-container">
                <div className="form-header">
                  <h3>전문가 채점</h3>
                  <span className={`status-badge ${isExpertSaved ? 'completed' : 'pending'}`}>
                    {isExpertSaved ? '저장 완료' : '채점 중'}
                  </span>
                </div>

                <div className="grading-criteria">
                  <div className="criteria-item">
                    <label>비판적 사고 (10점)</label>
                    <input
                      type="number"
                      value={expertScore.critical}
                      onChange={(e) =>
                        setExpertScore({ ...expertScore, critical: e.target.value })
                      }
                      disabled={isExpertSaved}
                    />
                  </div>

                  <div className="criteria-item">
                    <label>수과학적 지식 (10점)</label>
                    <input
                      type="number"
                      value={expertScore.math}
                      onChange={(e) =>
                        setExpertScore({ ...expertScore, math: e.target.value })
                      }
                      disabled={isExpertSaved}
                    />
                  </div>
                </div>

                <div className="action-buttons">
                  <button
                    className={`btn-save ${isExpertSaved ? 'disabled' : ''}`}
                    onClick={saveExpertScore}
                    disabled={isExpertSaved}
                  >
                    {isExpertSaved ? "저장됨" : "점수 저장"}
                  </button>

                  <button
                    className={`btn-ai ${!isExpertSaved ? 'disabled' : ''}`}
                    onClick={fetchAiScore}
                    disabled={!isExpertSaved}
                  >
                    AI 채점 결과 확인
                  </button>
                </div>

                {showAiResult && aiResult && (
                  <div className="ai-result-section fade-in">
                    <hr className="divider" />
                    <div className="ai-header">
                      <h3>🤖 AI 분석 결과</h3>
                      <span className="ai-score">
                        Total: {aiResult.total_score}
                      </span>
                    </div>
                    <div className="ai-feedback-box">
                      <h4>AI 피드백</h4>
                      <p>{aiResult.feedback}</p>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default GradingScreen;
