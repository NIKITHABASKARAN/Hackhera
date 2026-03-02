import React from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import UploadPage from "./pages/UploadPage.jsx";
import CasePage from "./pages/CasePage.jsx";

const navLinkClass = ({ isActive }) =>
  isActive ? { textDecoration: "underline" } : undefined;

export const API_BASE = "http://localhost:8000";

function App() {
  return (
    <>
      <header>
        <h1>ALETHEIA – Women’s Digital Safety Dashboard</h1>
        <nav>
          <NavLink to="/" style={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/upload" style={navLinkClass}>
            Upload Evidence
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/case/:id" element={<CasePage />} />
        </Routes>
      </main>
      <footer>
        <small>
          Backend runs at{" "}
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
            http://localhost:8000/docs
          </a>
          . Mongo Express at{" "}
          <a href="http://localhost:8081" target="_blank" rel="noreferrer">
            http://localhost:8081
          </a>
          .
        </small>
      </footer>
    </>
  );
}

export default App;

