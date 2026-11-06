import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import "./Chat.css";
import DiscoverMap from "./DiscoverMap";
import useLiveLocation from "../services/useLiveLocation";
import ProfilePhotos from "./ProfilePhotos";
import AccountSetup from "./AccountSetup";

const tabs = [
  { id: "discover", label: "Discover", icon: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></> },
  { id: "calls", label: "Calls", icon: <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L9 11a16 16 0 0 0 4 4l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /> },
  { id: "chat", label: "Chat", icon: <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" /> },
  { id: "settings", label: "Settings", icon: <><path d="m10 2-.5 2.5-2 .9L5 4.7 2.7 8.5l1.8 1.9v3.2l-1.8 1.9L5 19.3l2.5-.7 2 .9.5 2.5h4l.5-2.5 2-.9 2.5.7 2.3-3.8-1.8-1.9v-3.2l1.8-1.9L19 4.7l-2.5.7-2-.9L14 2Z" /><circle cx="12" cy="12" r="3" /></> },
];

export default function Chat() {
  const [activeTab, setActiveTab] = useState("discover");
  const [needsPhoto, setNeedsPhoto] = useState(false);
  const [photoCheckError, setPhotoCheckError] = useState("");
  const { location, locationMessage } = useLiveLocation();
  useEffect(() => {
    let active = true;
    async function checkPhotos() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) return;
        const { data, error } = await supabase.storage.from("profile-photos").list(auth.user.id);
        if (error) throw error;
        if (active) {
          setNeedsPhoto(!data.some((file) => /^[1-7]$/.test(file.name)));
          setPhotoCheckError("");
        }
      } catch {
        if (active) setPhotoCheckError("Could not check your photos. Open Settings to try again.");
      }
    }
    void checkPhotos();
    return () => { active = false; };
  }, [activeTab]);
  return (
    <AccountSetup>
    <main className="blank-chat-page" aria-label={tabs.find((tab) => tab.id === activeTab).label}>
      {activeTab === "discover" && <DiscoverMap location={location} />}
      {activeTab === "settings" && <ProfilePhotos />}
      {activeTab !== "settings" && needsPhoto && (
        <aside className="add-photo-prompt" aria-label="Profile photo reminder">
          <div><strong>Add your first photo</strong><p>Help people get to know you. We recommend 3 photos.</p></div>
          <button type="button" onClick={() => setActiveTab("settings")}>Add a photo</button>
        </aside>
      )}
      {activeTab !== "settings" && photoCheckError && <p className="photo-check-error" role="status">{photoCheckError}</p>}
      {locationMessage && <p className="location-status" role="status">{locationMessage}</p>}
      <nav className="bottom-tabs" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={`bottom-tab${activeTab === tab.id ? " is-active" : ""}`} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tab.icon}</svg>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </main>
    </AccountSetup>
  );
}
