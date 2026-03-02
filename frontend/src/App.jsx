import React from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import UploadPage from "./pages/UploadPage.jsx";
import CasePage from "./pages/CasePage.jsx";

export const API_BASE = "http://localhost:8000";

function App() {
  return (
    <>
      <header>
        <div className="header-inner">
          <div className="brand-block">
            <div className="brand-shield">
            <img src="/logo.png" alt="ALETHEIA" style={{ width: 30, height: 30, objectFit: "contain" }} />
          </div>
            <div className="brand-text">
              <h1>ALETHEIA</h1>
              <span className="tagline">Women's Digital Safety Platform</span>
            </div>
          </div>
          <nav>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              📊 Dashboard
            </NavLink>
            <NavLink
              to="/upload"
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              📤 Upload Evidence
            </NavLink>
          </nav>
        </div>
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
          Backend API at{" "}
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
            localhost:8000/docs
          </a>
          {" · "}
          Mongo Express at{" "}
          <a href="http://localhost:8081" target="_blank" rel="noreferrer">
            localhost:8081
          </a>
        </small>
      </footer>
    </>
  );
}

export default App;
