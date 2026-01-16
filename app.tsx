import { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import GradingScreen from "./components/GradingScreen";

// Cloud Run API URL
const API_BASE_URL =
  "https://ai-assist-grading-1015930710584.us-central1.run.app";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [raterId, setRaterId] = useState("");
  const [raterUid, setRaterUid] = useState("");

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
    <GradingScreen
      apiUrl={API_BASE_URL}
      raterId={raterId}
      raterUid={raterUid} onLogout={function (): void {
        throw new Error("Function not implemented.");
      } }    />
  );
}

export default App;

