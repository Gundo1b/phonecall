import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function useLiveLocation() {
  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    let active = true;
    let watchId;
    let pending;
    let saving = false;
    let userId;

    async function save() {
      if (!active || !pending || saving || !userId) return;
      saving = true;
      const next = pending;
      try {
        const { error } = await supabase.from("user_locations").upsert({
          user_id: userId,
          latitude: next.latitude,
          longitude: next.longitude,
          accuracy: next.accuracy,
          observed_at: next.observedAt,
        }, { onConflict: "user_id" });
        if (error) throw error;
        if (pending === next) pending = null;
        if (active) setLocationMessage("");
      } catch (error) {
        if (active) {
          if (error.code === "PGRST205" || error.code === "42P01") {
            setLocationMessage("Location storage is not set up. Run supabase/location.sql in Supabase SQL Editor, then refresh.");
          } else if (error.code === "42501") {
            setLocationMessage("Location save permission denied. Run supabase/location.sql to apply the private location permissions, then refresh.");
          } else {
            setLocationMessage(`Could not save location: ${error.message || "Network error"}. Retrying automatically.`);
          }
        }
      } finally {
        saving = false;
      }
    }

    async function start() {
      if (!navigator.geolocation) {
        setLocationMessage("Your browser does not support location.");
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        setLocationMessage("Complete signup to save your location.");
        return;
      }
      userId = data.user.id;
      watchId = navigator.geolocation.watchPosition((position) => {
        if (!active) return;
        pending = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          observedAt: new Date(position.timestamp).toISOString(),
        };
        setLocation(pending);
        void save();
      }, (error) => {
        if (active) setLocationMessage(error.code === 1
          ? "Allow location access in your browser to update your position."
          : "Location is temporarily unavailable. Waiting for a new position.");
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    }

    void start();
    const retry = window.setInterval(save, 15000);
    return () => {
      active = false;
      window.clearInterval(retry);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return { location, locationMessage };
}
