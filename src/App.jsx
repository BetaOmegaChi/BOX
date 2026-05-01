import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import CalendarPage from './CalendarPage';
import NavBar from './NavBar';
import HomePage from './HomePage';
import ViewDatePage from './ViewDatePage';
import Footer from './Footer';
import './style.css';


function App() {
  return (
    <BrowserRouter basename="/BOX">
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/view-date/:dateKey" element={<ViewDatePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
