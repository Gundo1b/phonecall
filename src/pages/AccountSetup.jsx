import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";

export default function AccountSetup({ children }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [gender, setGender] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef(null);

  async function check() {
    try {
      const { data, error } = await supabase.rpc("registration_status");
      if (error) throw error;
      if (!data?.length) throw new Error("Your profile is missing. Please complete signup first.");
      if (data[0].completed) { setReady(true); dialog.current?.close(); }
      else { dialog.current?.showModal(); }
    } catch (error) {
      setMessage(error.code === "PGRST202" ? "Run supabase/account-setup.sql in Supabase SQL Editor, then retry." : error.message);
    }
  }

  useEffect(() => {
    let active = true;
    supabase.rpc("registration_status").then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setMessage(error.code === "PGRST202" ? "Run supabase/account-setup.sql in Supabase SQL Editor, then retry." : error.message);
      } else if (!data?.length) {
        setMessage("Your profile is missing. Please complete signup first.");
      } else if (data[0].completed) {
        setReady(true);
      } else {

        dialog.current?.showModal();
      }
    }).catch(() => {
      if (active) setMessage("Could not check your account. Please retry.");
    });
    return () => { active = false; };
  }, []);

  async function save(event) {
    event.preventDefault();
    if (password.length < 8) { setMessage("Use at least 8 characters for your password."); return; }
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.updateUser({ email: email.trim(), password });
      if (error) throw error;
      if (data.user.email?.toLowerCase() !== email.trim().toLowerCase() || !data.user.email_confirmed_at) {
        setPassword(""); setConfirm("");
        throw new Error("Check your email to confirm your address, then return here. To use signup without confirmation, disable Confirm email in Supabase.");
      }
      const { error: setupError } = await supabase.rpc("finish_account_setup", { selected_gender: gender });
      if (setupError) throw setupError;
      setPassword(""); setConfirm("");
      dialog.current.close();
      setReady(true);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }


  return <>
    {children}
    {!ready && <button type="button" className="resume-setup" onClick={check}>Finish registration</button>}
    <dialog ref={dialog} className="photo-dialog setup-dialog" aria-labelledby="setup-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <h2 id="setup-title">Finish your registration</h2>
      <p>Add your email, create a password, and choose your gender before uploading photos.</p>
      <form onSubmit={save}>
        <label htmlFor="setup-email">Email</label><input id="setup-email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="setup-password">Password</label><input id="setup-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} />
        <label htmlFor="setup-confirm">Confirm password</label><input id="setup-confirm" type="password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} />
        <label htmlFor="setup-gender">Gender</label><select id="setup-gender" value={gender} onChange={(e) => setGender(e.target.value)} required disabled={busy}>
          <option value="">Select your gender</option><option value="woman">Woman</option><option value="man">Man</option><option value="nonbinary">Nonbinary</option><option value="self_described">Another identity</option><option value="prefer_not_to_say">Prefer not to say</option>
        </select>
        {message && <p role="alert" className="photo-error">{message}</p>}
        <button type="submit" className="photo-upload" disabled={busy}>{busy ? "Saving..." : "Save and continue"}</button>
      </form>
      <button type="button" className="setup-skip" disabled={busy} onClick={() => { dialog.current.close(); setPassword(""); setConfirm(""); }}>Skip for now</button>
    </dialog>
  </>;
}

