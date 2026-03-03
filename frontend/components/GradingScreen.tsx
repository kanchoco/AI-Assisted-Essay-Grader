import React, { useState } from 'react';
import './Grading.css';

// 특수문자 이스케이프 및 공백 유연성 패턴
const createFlexiblePattern = (text: string) => {
  let escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(/\s+/g, '\\s+');
};

const normalize = (text: string) => text.replace(/[\s,.?!]+/g, '').trim();

// 답안 하이라이터 컴포넌트
interface HighlighterProps {
  text: string;
  sciSentences?: string[];
  crtSentences?: string[];
}

const AnswerHighlighter: React.FC<HighlighterProps> = ({
  text,
  sciSentences = [],
  crtSentences = []
}) => {
  if (!text) return null;
  
  // 데이터가 없으면 원본 리턴
  if (sciSentences.length === 0 && crtSentences.length === 0) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  }

  const processSentences = (sentences: string[], type: string) => {
    return sentences.flatMap(sentence => 
      sentence
      // 슬래시(/) 또는 " 공백+숫자+점( 1., 2.)" 패턴 앞에서 자르기
        .split(/\/|(?=\s\d+\.)/) 
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => ({ text: s, type }))
    );
  };

  const targets = [
    ...processSentences(sciSentences, 'sci'),
    ...processSentences(crtSentences, 'crt')
  ];

  if (targets.length === 0) return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;

  // 긴 문장부터 찾도록 정렬 (정확도 향상)
  targets.sort((a, b) => b.text.length - a.text.length);

  // 정규식 패턴 생성 (공백이 달라도 찾을 수 있게 flexiblePattern 사용)
  const patternString = `(${targets.map(t => createFlexiblePattern(t.text)).join('|')})`;
  const pattern = new RegExp(patternString, 'g');
  const parts = text.split(pattern);

  return (
    <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
      {parts.map((part, index) => {
        const matchedTarget = targets.find(t => normalize(t.text) === normalize(part));
        if (matchedTarget?.type === 'sci') {
          return <span key={index} style={{ backgroundColor: '#B4C6E7'}}>{part}</span>;
        } else if (matchedTarget?.type === 'crt') {
          return <span key={index} style={{ backgroundColor: '#FFE699' }}>{part}</span>;
        } else {
          return <span key={index}>{part}</span>;
        }
      })}
    </span>
  );
};

interface GradingRowProps {
  student: any;       
  apiUrl: string;
  raterUid: string;
  isLast: boolean;
}

const GradingRow: React.FC<GradingRowProps> = ({ student, apiUrl, raterUid, isLast }) => {
  const [expertScore, setExpertScore] = useState({ critical: '', math: '' });
  const [expertRationale, setExpertRationale] = useState('');
  
  const [aiResult, setAiResult] = useState<any>(null);
  const [scoreUid, setScoreUid] = useState('');
  
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false); // AI 패널 열림 여부
  const [isLoading, setIsLoading] = useState(false); // 로딩 스피너
  const [isScoreLocked, setIsScoreLocked] = useState(false); //점수 잠금
  const [isConfirmed, setIsConfirmed] = useState(false); // 최종 확정 여부

  const CARD_HEIGHT = '380px';

  const handleAiGrade = async () => {
    const mathScore = Number(expertScore.math);
    const crtScore = Number(expertScore.critical);

    if (!expertScore.critical || !expertScore.math) {
      alert(`[Student #${student.student_id}] 전문가 점수를 입력하세요`);
      return;
    }

    if (mathScore < 1 || mathScore > 10 || crtScore < 1 || crtScore > 10) {
      alert('점수는 1점에서 10점 사이의 정수여야 합니다.');
      return;
    }

    setIsLoading(true);
    setIsAiPanelOpen(true);
    setIsScoreLocked(true);

    try {
      const res = await fetch(`${apiUrl}/ai_grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_uid: student.student_uid,
          student_id: student.student_id,
          rater_uid: raterUid,
          expert_crt_score: crtScore,
          expert_knw_score: mathScore,
          expert_rationale: expertRationale,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert('AI 채점 실패');
        setIsLoading(false);
        setIsScoreLocked(false);
        return;
      }

      setAiResult(data.ai_result);
      setScoreUid(data.score_uid);

    } catch (err) {
      alert('AI 서버 오류');
      setIsScoreLocked(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSave = async () => {
    if (!window.confirm(`Student #${student.student_id} 점수를 최종 확정하시겠습니까?`)) {
        return;
    }

    try {
      const res = await fetch(`${apiUrl}/add_final_score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score_uid: scoreUid,
          student_uid: student.student_uid,
          rater_uid: raterUid,
          knw_score: aiResult.scores.scientific,
          crt_score: aiResult.scores.critical,
        }),
      });

      const data = await res.json();

      if (data.status === 'ok') {
        setIsConfirmed(true);
        alert(`Student #${student.student_id}의 점수가 확정되었습니다.`);
      } else {
        alert('점수 확정에 실패했습니다.');
      }
    } catch (err) {
      alert('서버 오류');
    }
  };

  const handleEditScore = () => {
    if(isConfirmed) return;
    setIsScoreLocked(false);
  };

  const isAnalysisComplete = isAiPanelOpen && !isLoading && aiResult;

  return (
    <div className="grading-row fade-in" 
    style={{ 
      paddingTop: '10px',
      marginBottom: isLast ? '0px' : '30px',
      borderBottom: isLast ? 'none' : '1px solid #ccc',
      paddingBottom: isLast ? '10px' : '50px'
      }}
    >
      <div className="row-header desktop-only">
          <h2>Student #{student.student_id} 답안</h2>
          <h2>전문가 채점</h2>
          <div className="header-placeholder">
              {isAiPanelOpen && <h2>AI 채점</h2>}
          </div>
      </div>

      <div className="row-body">
          {/* [1] 학생 답안 */}
          <div className="column student-column">
              <h3 className="mobile-title">Student #{student.student_id} 답안</h3>
              <div className="student-card custom-scroll" 
                style={{ 
                  height: CARD_HEIGHT, 
                  overflowY: 'auto' 
                  }}
                >
                  <p className="answer-text">
                      <AnswerHighlighter
                          text={student.student_answer}
                          sciSentences={aiResult?.key_sentences?.scientific || []}
                          crtSentences={aiResult?.key_sentences?.critical || []}
                      />
                  </p>
              </div>
          </div>

          {/* [2] 전문가 채점 */}
          <div className="column expert-column">
              <h3 className="mobile-title">전문가 채점</h3>
              <div className="grading-form-container">
                  <div className="score-row">
                      <span className="score-label label-blue">수과학적 사고</span>
                      <input 
                          type="number" 
                          className="score-input"
                          value={expertScore.math}
                          onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || (Number(val) >= 1 && Number(val) <= 10)) {
                                  setExpertScore({...expertScore, math: val});
                              }
                          }}
                          min="1" max="10"
                          disabled={isScoreLocked || isConfirmed}
                      />
                  </div>
                  <div className="score-row">
                      <span className="score-label label-yellow">비판적 사고</span>
                      <input 
                          type="number" 
                          className="score-input"
                          value={expertScore.critical}
                          onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || (Number(val) >= 1 && Number(val) <= 10)) {
                                  setExpertScore({...expertScore, critical: val});
                              }
                          }}
                          min="1" max="10"
                          disabled={isScoreLocked || isConfirmed}
                      />
                  </div>

                  <textarea 
                      className="reason-box"
                      placeholder="채점 근거(선택):"
                      value={expertRationale}
                      onChange={(e) => setExpertRationale(e.target.value)}
                      disabled={isScoreLocked || isConfirmed}
                  />

                  <div className="button-stack">
                      <button 
                          className="btn-ai-check" 
                          onClick={handleAiGrade}
                          disabled={isAiPanelOpen || isConfirmed}
                      >
                          AI 채점 결과 확인
                      </button>
                      
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

          {/* [3] AI 결과 */}
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
                      <div className="ai-result-content fade-in" 
                        style={{ 
                          height: CARD_HEIGHT, 
                          flexDirection: 'column', 
                          display: 'flex', 
                          overflow: 'hidden' 
                        }}
                      >
                          {/* 점수 영역 */}
                          <div style={{ flex: '0 0 auto', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                            <div className="score-row">
                                <span className="score-label label-blue">수과학적 사고</span>
                                <div className="score-display">{aiResult?.scores?.scientific}</div>
                            </div>
                            <div className="score-row">
                                <span className="score-label label-yellow">비판적 사고</span>
                                <div className="score-display">{aiResult?.scores?.critical}</div>
                            </div>
                          </div>
                          
                          {/* 근거 영역 (스크롤 가능) */}
                          <div className="ai-feedback-container custom-scroll" 
                            style={{ 
                              flex: 1, 
                              overflowY: 'auto', 
                              paddingTop: '10px' 
                              }}
                            >
                              <div className="feedback-section" style={{ marginBottom: '20px' }}>
                                  <h4 className="feedback-label" style={{ display: 'inline-block', marginBottom: '4px' }}>
                                      [수과학적 사고]
                                  </h4>
                                  <ul className="feedback-list">
                                      {aiResult?.rationales?.scientific?.length > 0 ? (
                                          aiResult.rationales.scientific.map((r: string, i: number) => (
                                              <li key={`sci-${i}`} style={{ marginBottom: '4px' }}>{r}</li>
                                          ))
                                      ) : ( <li>근거 없음</li> )}
                                  </ul>
                              </div>

                              {/* 비판적 사고 근거 영역 */}
                              <div className="feedback-section">
                                  <h4 className="feedback-label" style={{ display: 'inline-block', marginBottom: '4px' }}>
                                      [비판적 사고]
                                  </h4>
                                  <ul className="feedback-list">
                                      {aiResult?.rationales?.critical?.length > 0 ? (
                                          aiResult.rationales.critical.map((r: string, i: number) => (
                                              <li key={`crt-${i}`} style={{ marginBottom: '4px' }}>{r}</li>
                                          ))
                                      ) : ( <li>근거 없음</li> )}
                                  </ul>
                              </div>
                          </div>
                      </div>
                  )}
                  </>
              ) : (
                  <div className="empty-placeholder" style={{ height: CARD_HEIGHT}}></div>
              )}
          </div>
      </div>
    </div>
  );
};

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
  const [searchText, setSearchText] = useState('');
  const [studentList, setStudentList] = useState<any[]>([]);
  const [isGradingStarted, setIsGradingStarted] = useState(false);

  // 학생 조회
  const handleSearch = async () => {
    const input = searchText.trim();
    if (!input) {
      alert('학생 ID를 입력해주세요');
      return;
    }

    const isMulti = input.includes('-') || input.includes(',');
    const url = isMulti ? `${apiUrl}/students/${input}` : `${apiUrl}/student/${input}`;  
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        alert('학생을 찾을 수 없습니다');
        return;
      }
      const data = await res.json();

      if (isMulti) {
        if (!Array.isArray(data) || data.length === 0) {
          alert('조회된 학생이 없습니다');
          return;
        }
        setStudentList(data);
      } else {     
        setStudentList([data]);
      }
      setIsGradingStarted(true);
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
    }
  };

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
        <div className="search-section">
             <div className="search-bar-wrapper">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input 
                    type="text" 
                    placeholder="학생 ID를 입력해 주세요 (ex. 10101, 10101-10105)" 
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
             <div className="range-info" style={{marginBottom: '20px', fontWeight: 'bold', color: '#555'}}>
             </div>

             {/* 여기서 여러 명의 학생을 반복해서 출력 */}
             {studentList.map((student, index) => (
               <GradingRow 
                  key={student.student_uid} 
                  student={student}
                  apiUrl={apiUrl}
                  raterUid={raterUid}
                  isLast={index === studentList.length - 1}
               />
             ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default GradingScreen;