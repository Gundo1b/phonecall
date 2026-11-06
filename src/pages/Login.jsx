import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import "./PhoneAuth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  async function login(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      sessionStorage.removeItem("profile_user_id");
      sessionStorage.removeItem("profile_name");
      const { data: profile, error: profileError } = await supabase.from("users").select("id, name").eq("auth_user_id", data.user.id).single();
      if (profileError) throw profileError;
      sessionStorage.setItem("profile_user_id", profile.id);
      sessionStorage.setItem("profile_name", profile.name || "");
      setPassword("");
      navigate("/chat", { replace: true });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <div className="phone-page"><div className="phone-card">
    <h1>Welcome back</h1><p>Sign in with your email and password.</p>
    <form onSubmit={login}>
      <div className="phone-field"><input aria-label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /></div>
      <div className="phone-field"><input aria-label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /></div>
      <button disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
    </form>
    {message && <p role="alert" className="signup-error">{message}</p>}
    <p><Link to="/">Create an account</Link></p>
  </div></div>;
}

