import { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import GradingScreen from "./components/GradingScreen";
import UploadStudentPage from "./components/UploadStudentPage";

// Cloud Run API URL
const API_BASE_URL =
  "https://ai-assist-grading-1015930710584.us-central1.run.app";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [raterId, setRaterId] = useState("");
  const [raterUid, setRaterUid] = useState("");
  const [currentScreen, setCurrentScreen] =
    useState<"grading" | "upload">("grading");

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

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 상단 메뉴 */}
      <header
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px",
          borderBottom: "1px solid #ccc",
        }}
      >
        <button
          style={menuButtonStyle}
          onClick={() => setCurrentScreen("grading")}
        >
          채점하기
        </button>

        <button
          style={menuButtonStyle}
          onClick={() => setCurrentScreen("upload")}
        >
          학생 업로드
        </button>

        <div style={{ marginLeft: "auto", marginRight: "12px" }}>
          {raterId}
        </div>

        <button
          style={logoutStyle}
          onClick={() => window.location.reload()}
        >
          로그아웃
        </button>
      </header>

      {/* 메인 콘텐츠 */}
      <main
        style={{
          flex: 1,
          width: "100%",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        {currentScreen === "grading" ? (
          <GradingScreen
            apiUrl={API_BASE_URL}
            raterId={raterId}
            raterUid={raterUid}
          />
        ) : (
          <UploadStudentPage apiUrl={API_BASE_URL} />
        )}
      </main>
    </div>
  );
}

export default App;

// ---------------- 스타일 ----------------

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
  cursor: "pointer",
};
