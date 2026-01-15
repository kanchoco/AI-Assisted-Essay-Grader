import React, { useState } from 'react';
import './Grading.css';

interface GradingProps {
  apiUrl: string;
  raterId: string;
  raterUid: string;
  onLogout: () => void;
}

const GradingScreen: React.FC<GradingProps> = ({
  apiUrl,
  raterId,
  raterUid,
  onLogout,
}) => {
  // ui 상태
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);       // AI 패널 열림 여부
  const [isLoading, setIsLoading] = useState(false);               // 로딩 스피너
  const [isScoreLocked, setIsScoreLocked] = useState(false);       // 점수 잠금 (수정 방지)
  const [isConfirmed, setIsConfirmed] = useState(false);           // 최종 확정 여부

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

  // 채점 근거(전문가 채점)
  const [expertRationale, setExpertRationale] = useState('');

  // AI 결과
  const [aiResult, setAiResult] = useState<any>(null);
  const [scoreUid, setScoreUid] = useState('');

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

      // 상태 초기화 (새 학생 검색 시)
      setExpertScore({ critical: '', math: '' });
      setExpertRationale(''); // 새 학생 검색 시 채점 근거 초기화
      setAiResult(null);
      setIsAiPanelOpen(false);
      setIsScoreLocked(false); //잠금 해제
      setIsConfirmed(false); //확정 해제
      // UI: 작업 공간 표시
      setIsGradingStarted(true);

    } catch (err) {
      alert('서버 오류가 발생했습니다.');
    }
  };

  // AI 채점 (전문가 + AI)
  const handleAiGrade = async () => {
    if (!expertScore.critical || !expertScore.math) {
      alert('전문가 점수를 입력하세요');
      return;
    }

    // [UI] 로딩 시작 및 패널 열기
    setIsLoading(true);
    setIsAiPanelOpen(true);
    setIsScoreLocked(true); // 입력창 잠금

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
          expert_rationale: expertRationale,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert('AI 채점 실패');
        setIsLoading(false);
        setIsScoreLocked(false); // 실패 시 잠금 해제
        return;
      }

      setAiResult(data.ai_result);
      setScoreUid(data.score_uid);

    } catch (err) {
      alert('AI 서버 오류');
      setIsScoreLocked(false);
    } finally {
      setIsLoading(false); // 로딩 종료
    }
  };

  const handleFinalSave = async () => {
    if (!window.confirm(`Student #${studentId} 점수를 최종 확정하시겠습니까? (확정 후 수정 불가)`)) {
        return;
    }

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
        setIsConfirmed(true); // [UI] 모든 버튼 비활성화 (확정 상태)
        alert('점수가 최종 확정되었습니다');
      } else {
        alert('확정 실패');
      }
    } catch (err) {
      alert('서버 오류');
    }
  };

  const handleEditScore = () => {
    if(isConfirmed) return; // 이미 확정됐으면 수정 불가
    setIsScoreLocked(false); // 잠금 해제 -> 다시 입력 가능
  };

  // 분석 완료 여부 (AI 데이터가 있고 로딩이 끝남)
  const isAnalysisComplete = isAiPanelOpen && !isLoading && aiResult;

  return (
    <div className="grading-container">
      <header className="top-header">
        <div className="logo">AI Essay Grader</div>
        <div className="rater-info">
             <p className="rater-name">{raterId}님 환영합니다</p>
             <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>      
      </header>

      <main className="main-content">
        {/* 검색창 */}
        <div className="search-section">
             <div className="search-bar-wrapper">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input 
                    type="text" 
                    placeholder="학생 ID를 입력하세요 ( ex. 10101, 10101-10105 )" 
                    value={searchText} 
                    onChange={(e) => setSearchText(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
                />
                <button className="search-btn" onClick={handleSearch}>Search</button>
             </div>
          </div>

        {!isGradingStarted ? (
          <div className="empty-state-container">
            <p className="empty-text">채점 대상 입력 시 이곳에 해당 학생의 답안과 채점 란이 나타납니다.</p>
          </div>
        ) : (
          <div className="grading-list">
                <div className="grading-row fade-in">
                    {/* 타이틀 영역 */}
                    <div className="row-header desktop-only">
                        <h2>Student #{studentId} 답안</h2>
                        <h2>전문가 채점</h2>
                        <div className="header-placeholder">
                            {isAiPanelOpen && <h2>AI 채점</h2>}
                        </div>
                    </div>

            <div className="row-body">
                        {/* [왼쪽] 학생 답안 */}
                        <div className="column student-column">
                            <h3 className="mobile-title">Student #{studentId} 답안</h3>
                            <div className="student-card">
                                {/* 실제 DB 데이터 바인딩 */}
                                <p className="answer-text">{studentAnswer}</p>
                            </div>
                        </div>

                        {/* [가운데] 전문가 채점 */}
                        <div className="column expert-column">
                            <h3 className="mobile-title">전문가 채점</h3>
                            <div className="grading-form-container">
                                <div className="score-row">
                                    <span className="score-label label-blue">수과학적 사고</span>
                                    <input 
                                        type="number" 
                                        className="score-input"
                                        value={expertScore.math}
                                        onChange={(e) => setExpertScore({...expertScore, math: e.target.value})}
                                        disabled={isScoreLocked || isConfirmed} // 잠금 로직 적용
                                    />
                                </div>
                                <div className="score-row">
                                    <span className="score-label label-yellow">비판적 사고</span>
                                    <input 
                                        type="number" 
                                        className="score-input"
                                        value={expertScore.critical}
                                        onChange={(e) => setExpertScore({...expertScore, critical: e.target.value})}
                                        disabled={isScoreLocked || isConfirmed} // 잠금 로직 적용
                                    />
                                </div>

                                <textarea 
                                    className="reason-box"
                                    placeholder="채점 근거(선택):"
                                    value={expertRationale} // 값 연결
                                    onChange={(e) => setExpertRationale(e.target.value)} // 입력 시 상태 업데이트
                                    disabled={isScoreLocked || isConfirmed}
                                />

                                <div className="button-stack">
                                    {/* AI 버튼 */}
                                    <button 
                                        className="btn-ai-check" 
                                        onClick={handleAiGrade}
                                        disabled={isAiPanelOpen || isConfirmed}
                                    >
                                        AI 채점 결과 확인
                                    </button>
                                    
                                    {/* 수정/확정 버튼 */}
                                    <div className="btn-row">
                                        <button 
                                            className="btn-edit" 
                                            onClick={handleEditScore}
                                            disabled={!isAnalysisComplete || isConfirmed} 
                                        >
                                            점수 수정
                                        </button>
                                        <button 
                                            className="btn-save" 
                                            onClick={handleFinalSave}
                                            disabled={!isAnalysisComplete || isConfirmed}
                                        >
                                            점수 확정
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* [오른쪽] AI 채점 */}
                        <div className="column ai-column">
                            {isAiPanelOpen ? (
                                <>
                                <h3 className="mobile-title">AI 채점</h3>
                                {isLoading ? (
                                    <div className="spinner-container">
                                        <div className="loading-spinner"></div>
                                        <span className="loading-text">AI가 답안을 채점 중...</span>
                                    </div>
                                ) : (
                                    /* API 결과 데이터 바인딩 */
                                    <div className="ai-result-content fade-in">
                                        <div className="score-row">
                                            <span className="score-label label-blue">수과학적 사고</span>
                                            <div className="score-display">{aiResult?.scores?.scientific}</div>
                                        </div>
                                        <div className="score-row">
                                            <span className="score-label label-yellow">비판적 사고</span>
                                            <div className="score-display">{aiResult?.scores?.critical}</div>
                                        </div>
                                        
                                        <div className="ai-feedback-container">
                                            <p className="feedback-title">채점 근거:</p>
                                            <ul className="feedback-list">
                                                {/* API에서 받은 근거 리스트 뿌리기 */}
                                                {aiResult?.rationales?.scientific?.map((r: string, i: number) => (
                                                    <li key={`sci-${i}`}>{r}</li>
                                                ))}
                                                {aiResult?.rationales?.critical?.map((r: string, i: number) => (
                                                    <li key={`crt-${i}`}>{r}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                </>
                            ) : (
                                <div className="empty-placeholder"></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          )}
       </main>
    </div>
  );
};

export default GradingScreen;
