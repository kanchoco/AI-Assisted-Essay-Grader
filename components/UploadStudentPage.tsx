import React, { useState } from "react";

interface UploadProps {
  apiUrl: string;
}

const UploadStudentPage: React.FC<UploadProps> = ({ apiUrl }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("업로드할 엑셀 파일을 선택해주세요.");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/upload_excel`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.status === "success") {
        setMessage("업로드 성공! 학생 데이터가 저장되었습니다.");
      } else {
        setMessage(`오류 발생: ${data.message}`);
      }
    } catch {
      setMessage("서버 요청 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "600px",
        margin: "0 auto",
        paddingTop: "40px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <h2>학생 데이터 업로드</h2>

      <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} />

      <button
        onClick={handleUpload}
        disabled={uploading}
        style={{
          padding: "10px 20px",
          backgroundColor: uploading ? "#ccc" : "#4A90E2",
          border: "none",
          color: "white",
          cursor: uploading ? "not-allowed" : "pointer",
          borderRadius: "6px",
          fontSize: "14px",
        }}
      >
        {uploading ? "업로드 중..." : "엑셀 업로드"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
};

export default UploadStudentPage;
