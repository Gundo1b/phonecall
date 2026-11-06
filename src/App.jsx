
import PhoneAuth from "./pages/PhoneAuth";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import CreateProfile from "./pages/CreateProfile";
import Chat from "./pages/Chat";
import Call from "./pages/Call";
import Login from "./pages/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PhoneAuth />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<CreateProfile />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/call/:contactId" element={<Call />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
