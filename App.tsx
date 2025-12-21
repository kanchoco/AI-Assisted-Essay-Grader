import { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import GradingScreen from './components/GradingScreen';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    // 화면 꽉 차게 중앙 정렬
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center'
    }}>
      
      {!isLoggedIn ? (
        <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />
      ) : (
        <GradingScreen />
      )}
      
    </div>
  );
}

export default App;