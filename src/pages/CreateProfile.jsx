import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import "./PhoneAuth.css";

export default function CreateProfile() {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function saveProfile(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const contactNumber = sessionStorage.getItem("signup_phone");
      if (!contactNumber) {
        navigate("/", { replace: true });
        return;
      }
      const cleanName = name.trim();
      if (cleanName.length < 2 || cleanName.length > 100) throw new Error("Enter a name between 2 and 100 characters.");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data: userId, error } = await supabase.rpc("complete_contact_signup", {
        display_name: cleanName, birth_date: birthDate, contact_number: contactNumber,
      });
      if (error) throw error;
      if (!userId) throw new Error("Profile was not saved. Please try again.");
      sessionStorage.setItem("profile_user_id", userId);
      sessionStorage.setItem("profile_name", cleanName);
      sessionStorage.removeItem("signup_phone");
      navigate("/chat", { replace: true });
    } catch (error) {
      setMessage(error.message || "Unable to save your profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="phone-page"><div className="phone-card">
      <h1>Introduce yourself</h1>
      <p>Add your name and date of birth to finish signup. You must be 18 or older.</p>
      <form onSubmit={saveProfile}>
        <div className="phone-field"><input aria-label="Display name" autoComplete="nickname" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required disabled={loading} /></div>
        <label htmlFor="birth-date">Date of birth</label>
        <div className="phone-field"><input id="birth-date" type="date" autoComplete="bday" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required disabled={loading} /></div>
        <p>Your date of birth is private. Age eligibility is checked when you save.</p>
        <button disabled={loading}>{loading ? "Saving..." : "Complete signup"}</button>
      </form>
      {message && <p className="signup-error" role="alert">{message}</p>}
    </div></div>
  );
}
