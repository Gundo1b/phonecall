import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./PhoneAuth.css";

export default function PhoneAuth() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [adult, setAdult] = useState(false);
  const [message, setMessage] = useState("");

  function submit(event) {
    event.preventDefault();
    const local = phone.replace(/\D/g, "").replace(/^0/, "");
    if (!/^[6-8]\d{8}$/.test(local)) {
      setMessage("Enter a valid South African mobile number.");
      return;
    }
    if (!adult) {
      setMessage("You must be 18 or older to join.");
      return;
    }
    sessionStorage.setItem("signup_phone", `+27${local}`);
    navigate("/profile");
  }

  return (
    <div className="phone-page"><div className="phone-card">
      <div className="phone-icon" aria-hidden="true">♡</div>
      <h1>A connection starts with hello</h1>
      <p>Join a dating community built around voice. For adults 18 and older.</p>
      <form onSubmit={submit}>
        <div className="phone-field"><span>+27</span><input aria-label="Contact number" type="tel" autoComplete="tel-national" placeholder="712345678" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={10} required /></div>
        <label className="signup-consent"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} required /> I am 18 years or older.</label>
        <button>Continue</button>
      </form>
      {message && <p className="signup-error" role="alert">{message}</p>}
      <small>Use your contact number to create a profile. No SMS code needed.</small>
      <p><Link to="/login">Already registered? Sign in</Link></p>
    </div></div>
  );
}
