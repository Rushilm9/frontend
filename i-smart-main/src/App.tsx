import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// 🌟 Page Imports
import Layout from "./components/Layout";

import UploadDocumentsPage from "./pages/UploadDocumentsPage";
import ProjectsPage from "./pages/ProjectPage";
import ShowPapersPage from "./pages/ShowPapersPage";
import PaperDetailPage from "./pages/PaperDetailPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Logout from "./pages/Logout";

// ✅ Literature pages (new)
import LiteratureListPage from "./pages/LiteratureListPage";
import LiteratureUploadPage from "./pages/LiteratureUploadPage";
import LiteratureDetailPage from "./pages/LiteratureDetailPage";

// 🔒 Private Route Wrapper
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let user = null;
  try {
    const storedUser = localStorage.getItem("user");
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// 🌐 Main App
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Redirect root to projects */}
        <Route path="/" element={<Navigate to="/app/projects" replace />} />

        {/* 🌍 Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 🔐 Protected Application Routes */}
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* 🏠 Default (projects) */}
          <Route path="projects" element={<ProjectsPage />} />

          {/* 📂 Other pages */}
          <Route path="upload" element={<UploadDocumentsPage />} />
          <Route path="papers" element={<ShowPapersPage />} />
          <Route path="papers/:paperId" element={<PaperDetailPage />} />

          {/* 📚 Literature Section */}
          <Route path="literature" element={<LiteratureListPage />} />
          <Route path="literature/upload" element={<LiteratureUploadPage />} />
          <Route path="literature/:paperId" element={<LiteratureDetailPage />} />

          {/* 🚪 Logout */}
          <Route path="logout" element={<Logout />} />
        </Route>

        {/* 🚫 Catch-all */}
        <Route path="*" element={<Navigate to="/app/projects" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
