import { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import GradingScreen from "./components/GradingScreen";
import UploadStudentPage from "./components/UploadStudentPage";

const API_BASE_URL =
  "https://ai-assist-grading-1015930710584.us-central1.run.app";

type PageType = "grading" | "upload";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [raterId, setRaterId] = useState("");
  const [raterUid, setRaterUid] = useState("");
  const [page, setPage] = useState<PageType>("grading");

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
<<<<<<< HEAD
    <GradingScreen
      apiUrl={API_BASE_URL}
      raterId={raterId}
      raterUid={raterUid}
      onLogout={() => window.location.reload()}
    />
=======
    <div>
      {/* 상단 네비게이션 */}
      <div style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>
        <button onClick={() => setPage("grading")}>
          채점 화면
        </button>
        <button onClick={() => setPage("upload")} style={{ marginLeft: "10px" }}>
          학생 업로드
        </button>
      </div>

      {/* 페이지 본문 */}
      {page === "grading" && (
        <GradingScreen
          apiUrl={API_BASE_URL}
          raterId={raterId}
          raterUid={raterUid}
        />
      )}

      {page === "upload" && (
        <UploadStudentPage apiUrl={API_BASE_URL} />
      )}
    </div>
>>>>>>> 47df2c2 (add app)
  );
}

export default App;
