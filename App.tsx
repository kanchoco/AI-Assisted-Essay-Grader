import { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import GradingScreen from './components/GradingScreen';

// Cloud Run API URL (배포 후 실제 URL로 변경)
const API_BASE_URL = "https://ai-score-api-xxxxx.a.run.app";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [raterId, setRaterId] = useState(""); // 로그인한 사용자 정보 저장 (optional)

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!isLoggedIn ? (
        <LoginScreen 
          apiUrl={API_BASE_URL}
          onLoginSuccess={(id) => {
            setRaterId(id);
            setIsLoggedIn(true);
          }}
        />
      ) : (
        <GradingScreen 
          apiUrl={API_BASE_URL}
          raterId={raterId}
        />
      )}
    </div>
  );
}

export default App;
