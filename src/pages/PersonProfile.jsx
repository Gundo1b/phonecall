import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";
import { genderLabel } from "../services/profileLabels";

export default function PersonProfile({ person, onClose }) {
  const dialog = useRef(null);
  const [profile, setProfile] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState(null);
  const [matched, setMatched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const decisionLock = useRef(false);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => dialog.current?.close(), 1800);
    return () => window.clearTimeout(timer);
  }, [celebrating]);
  useEffect(() => {
    dialog.current.showModal();
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.rpc("view_dating_profile", { target_profile: person.profile_id });
        if (error) throw error;
        if (!data?.length) throw new Error("This profile is no longer available.");
        const result = data[0];
        let urls = [];
        if (result.photo_paths?.length) {
          const { data: signed, error: photoError } = await supabase.storage.from("profile-photos").createSignedUrls(result.photo_paths, 3600);
          if (photoError) throw photoError;
          if (signed.some((photo) => photo.error)) throw new Error("Could not load profile photos.");
          urls = signed.map((photo) => photo.signedUrl);
        }
        if (active) { setProfile(result); setPhotos(urls); }
        const { data: status, error: statusError } = await supabase.rpc("profile_match_status", { target_profile: person.profile_id });
        if (active) {
          if (statusError) setActionError(statusError.code === "PGRST202" ? "Run supabase/matching.sql to enable likes and matches." : statusError.message);
          else if (status?.[0]) { setDecision(status[0].decision); setMatched(status[0].matched); }
        }
      } catch (error) {
        if (active) setError(error.code === "PGRST202" ? "Run supabase/profile-view.sql to enable full profiles." : error.message);
      }
    }
    void load();
    return () => { active = false; };
  }, [person.profile_id]);

  async function decide(choice) {
    if (decisionLock.current) return;
    decisionLock.current = true;
    setSaving(true);
    setActionError("");
    try {
      const { data, error } = await supabase.rpc("decide_profile", { target_profile: person.profile_id, chosen_decision: choice });
      if (error) throw error;
      setDecision(choice);
      setMatched(data === true);
      if (choice === "like") setCelebrating(true);
    } catch (error) {
      setActionError(error.code === "PGRST202" ? "Run supabase/matching.sql to enable likes and matches." : error.message);
    } finally { decisionLock.current = false; setSaving(false); }
  }

  return <dialog ref={dialog} className="photo-dialog person-profile" aria-labelledby="person-title" onClose={onClose}>
    {celebrating && <div className="like-celebration" role="status" aria-live="polite">
      <div className="celebration-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ "--angle": `${index * 15}deg`, "--travel": `${100 + (index % 4) * 25}px`, "--color": ["#fb7185", "#fbbf24", "#a78bfa", "#34d399"][index % 4], "--delay": `${(index % 3) * 60}ms` }} />)}</div>
      <svg className="celebration-heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
      <strong>{matched ? "It's a match!" : "Like sent!"}</strong>
    </div>}
    <button type="button" className="profile-close" onClick={() => dialog.current.close()} aria-label="Close profile">Close</button>
    <h2 id="person-title">{profile?.display_name || person.display_name}{profile?.age != null ? `, ${profile.age}` : ""}</h2>
    {error ? <p role="alert">{error}</p> : !profile ? <p role="status">Loading profile...</p> : <>
      <p>{genderLabel(profile.gender)}</p>
      <p>{person.distance_km == null ? "Approximate location" : person.distance_km < 1 ? "Less than 1 km away" : `About ${person.distance_km} km away`}</p>
      {photos.length ? <div className="person-photo-gallery">{photos.map((url, index) => <img key={url} src={url} alt={`${profile.display_name}, photo ${index + 1}`} />)}</div> : <p>No photos added yet.</p>}
      <div className="profile-match-actions" aria-label="Profile actions">
        <button type="button" className="profile-pass" aria-label="Pass on this profile" title="Pass" disabled={saving || celebrating} aria-pressed={decision === "pass"} onClick={() => decide("pass")}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <button type="button" className="profile-like" aria-label="Like this profile" title="Like" disabled={saving || celebrating} aria-pressed={decision === "like"} onClick={() => decide("like")}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
        </button>
      </div>
      <p className={matched ? "profile-match-success" : ""} role="status">{saving ? "Saving..." : matched ? `It's a match! You and ${profile.display_name} like each other.` : decision === "like" ? "Like saved. A mutual like makes a match." : decision === "pass" ? "Passed on this profile." : ""}</p>
      {actionError && <p role="alert">{actionError}</p>}
    </>}
  </dialog>;
}
