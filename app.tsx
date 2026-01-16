import UploadStudentPage from "./components/UploadStudentPage";

const API_BASE_URL =
  "https://ai-assist-grading-1015930710584.us-central1.run.app";

function App() {
  return (
    <div style={{ padding: "20px" }}>
      <UploadStudentPage apiUrl={API_BASE_URL} />
    </div>
  );
}

export default App;
