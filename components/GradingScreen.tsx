import React, { useState } from 'react';
import './Grading.css'; 

const GradingScreen: React.FC = () => {
  // --- 1. 상태 관리 (State) ---
  const [searchText, setSearchText] = useState('');
  const [isGradingStarted, setIsGradingStarted] = useState(false); // 검색 전/후 상태 구분
  
  // 점수 및 진행 상태
  const [expertScore, setExpertScore] = useState({ critical: '', math: '' });
  const [isExpertSaved, setIsExpertSaved] = useState(false); // 전문가 채점 저장 완료 여부
  const [showAiResult, setShowAiResult] = useState(false); // AI 결과 표시 여부

  // --- 2. 이벤트 핸들러 ---
  
  // 검색 버튼 클릭 (채점 화면으로 전환)
  const handleSearch = () => {
    if(!searchText.trim()) {
        alert("학생 번호를 입력해주세요");
        return;
    }
    // 추후 여기서 학생 데이터 조회 API 호출
    console.log(`Searching for: ${searchText}`);
    setIsGradingStarted(true); // 화면 전환!
  };

  // 전문가 점수 저장
  const handleSaveExpertScore = () => {
    if (!expertScore.critical || !expertScore.math) {
      alert('모든 점수를 입력해주세요.');
      return;
    }
    setIsExpertSaved(true);
    alert('전문가 점수가 저장되었습니다. AI 분석 결과를 확인해보세요!');
  };

  // AI 채점 결과 확인
  const handleCheckAiResult = () => {
    setShowAiResult(true);
  };

  return (
    <div className="grading-container">
       
       {/* 상단 헤더 (항상 보임) */}
       <header className="top-header">
          <div className="logo">Logo</div>
          <button className="logout-btn" onClick={() => window.location.reload()}>Logout</button>
       </header>

       {/* 메인 컨텐츠 */}
       <main className="main-content">
          
          {/* 검색창 (항상 보임) */}
          <div className="search-section">
             <div className="search-bar-wrapper">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input 
                   type="text" 
                   id="student-search"
                   placeholder="채점 대상 입력 ( 최대 30개, ex.1-10 / 1,3,10 )" 
                   value={searchText}
                   onChange={(e) => setSearchText(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button className="search-btn" onClick={handleSearch}>
                   Search
                </button>
             </div>
          </div>

          {/* ▼ 조건부 렌더링: 검색 전 vs 검색 후 ▼ */}
          {!isGradingStarted ? (
            // [상태 1] 검색 전: 안내 문구만 있는 화면
            <div className="empty-state-container">
                <p className="empty-text">채점 대상 입력 시 이곳에 해당 학생의 답안과 채점 란이 나타납니다.</p>
            </div>
          ) : (
            // [상태 2] 검색 후: 채점 워크스페이스 (좌우 패널)
            <div className="workspace fade-in">
                
                {/* 왼쪽: 학생 답안 패널 */}
                <div className="left-panel">
                    <h3 className="panel-title">Student 답안 <span className="badge">1명</span></h3>
                    <div className="student-card active">
                        <div className="card-header"><span className="student-id">Student #{searchText}</span></div>
                        <div className="card-body">
                            <p className="question-title">[Student #{searchText} 답안]</p>
                            <p className="answer-text">
                                (여기에 학생의 실제 답안 내용이 표시될 예정)
                                <br/><br/>
                            </p>
                        </div>
                    </div>
                </div>

                {/* 오른쪽: 채점 도구 패널 */}
                <div className="right-panel">
                    <div className="grading-form-container">
                        
                        {/* 전문가 채점 영역 */}
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
                                    type="number" placeholder="0" 
                                    value={expertScore.critical}
                                    onChange={(e) => setExpertScore({...expertScore, critical: e.target.value})}
                                    disabled={isExpertSaved}
                                />
                            </div>
                            <div className="criteria-item">
                                <label>수과학적 지식 (10점)</label>
                                <input 
                                    type="number" placeholder="0" 
                                    value={expertScore.math}
                                    onChange={(e) => setExpertScore({...expertScore, math: e.target.value})}
                                    disabled={isExpertSaved}
                                />
                            </div>
                        </div>

                        <div className="action-buttons">
                            <button 
                                className={`btn-save ${isExpertSaved ? 'disabled' : ''}`} 
                                onClick={handleSaveExpertScore}
                                disabled={isExpertSaved}
                            >
                                {isExpertSaved ? '저장됨' : '점수 저장'}
                            </button>
                            
                            <button 
                                className={`btn-ai ${!isExpertSaved ? 'disabled' : ''}`} 
                                onClick={handleCheckAiResult}
                                disabled={!isExpertSaved}
                            >
                                AI 채점 결과 확인
                            </button>
                        </div>

                        {/* AI 결과 영역 */}
                        {showAiResult && (
                            <div className="ai-result-section fade-in">
                                <hr className="divider" />
                                <div className="ai-header">
                                    <h3>🤖 AI Analysis</h3>
                                    <span className="ai-score">Total: </span>
                                </div>
                                <div className="ai-feedback-box">
                                    <h4>채점 근거</h4>
                                    <p></p>
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