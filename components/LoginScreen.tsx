import React, { useState } from 'react';
import './Login.css';
//import { loginAPI } from '../services/auth.ts';

interface LoginProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 로그인 API 함수
  const loginAPI = async (id: string, pw: string) => {
    return new Promise<{ success: boolean; message?: string }>((resolve) => {
      setTimeout(() => {
        if (id.trim() !== "" && pw.trim() !== "") resolve({ success: true });
        else resolve({ success: false, message: "채점자 이름과 비밀번호를 모두 입력해주세요." });
      }, 1000);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await loginAPI(username, password);
      if (result.success) onLoginSuccess();
      else alert(result.message);
    } catch (error) {
      alert('에러 발생');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="left-section">
        <div className="content-wrapper">
          <h1>AI-Assisted<br />Essay Review</h1>
          <div className="image-box">
            <img src="/assets/blood-report.png" alt="Icon" className="login-icon-img" />
          </div>
        </div>
      </div>
      <div className="right-section">
        <div className="login-wrapper">
          <h2 className="hello">Welcome Back!</h2>
          <p className="description">채점자 본인의 이름과 비밀번호를 입력해 주세요.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="username">User name</label>
              <input type="text" id="username" className="input-field" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Enter your Username" />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input type={showPassword ? "text" : "password"} id="password" className="input-field" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter your Password" />
                <i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'} toggle-password`} onClick={()=>setShowPassword(!showPassword)}></i>
              </div>
            </div>
            <button type="submit" className="submit-btn" disabled={isLoading}>{isLoading ? "Processing..." : "Login"}</button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default LoginScreen;