import { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import GradingScreen from './components/GradingScreen';
import UploadStudentPage from "./components/UploadStudentPage";

// Cloud Run API URL (배포 후 실제 URL로 변경)
const API_BASE_URL = "https://ai-assist-grading-1015930710584.us-central1.run.app";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [raterId, setRaterId] = useState("");
  const [raterUid, setRaterUid] = useState("");
  const [currentScreen, setCurrentScreen] = useState<"grading" | "upload">("grading");

  if (!isLoggedIn) {
    return (
      <LoginScreen
        apiUrl={API_BASE_URL}
        onLoginSuccess={(uid, id) => {
          setRaterUid(uid);
          setRaterId(id);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  // 로그인 후 화면
  return (
    <div style={containerStyle}>
      {/* 간단한 상단 메뉴 */}
      <header style={headerStyle}>
        <button style={menuButtonStyle} onClick={() => setCurrentScreen("grading")}>
          채점하기
        </button>
        <button style={menuButtonStyle} onClick={() => setCurrentScreen("upload")}>
          학생 업로드
        </button>
        <button style={logoutStyle} onClick={() => window.location.reload()}>
          로그아웃
        </button>
      </header>

      {/* 화면 컨텐츠 */}
      <main style={contentStyle}>
        {currentScreen === "grading" ? (
          <GradingScreen apiUrl={API_BASE_URL} raterId={raterId} />
        ) : (
          <UploadStudentPage apiUrl={API_BASE_URL} />
        )}
      </main>
    </div>
  );
}

export default App;

// ---------------------- 스타일 ----------------------
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "flex-start",
  gap: "10px",
  padding: "12px",
  borderBottom: "1px solid #ccc",
};

const menuButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "#4A90E2",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};

const logoutStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "#D9534F",
  color: "white",
  border: "none",
  borderRadius: "6px",
  marginLeft: "auto",
  cursor: "pointer",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};
