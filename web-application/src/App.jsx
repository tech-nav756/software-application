import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PublicLayout from './layouts/PublicLayout';
import './App.css';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          {/* You can add more routes here that will also use the layout */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;