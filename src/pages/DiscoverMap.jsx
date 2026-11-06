import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../services/supabase";
import PersonProfile from "./PersonProfile";
import { genderLabel } from "../services/profileLabels";

export default function DiscoverMap({ location }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const liveMarker = useRef(null);
  const centered = useRef(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [peopleMessage, setPeopleMessage] = useState("Finding people...");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [view, setView] = useState("map");
  const [people, setPeople] = useState([]);
  const filterDialog = useRef(null);
  const [filters, setFilters] = useState({ distance: "", minAge: 18, maxAge: 120, gender: "all" });
  const [draft, setDraft] = useState(filters);
  const [filterError, setFilterError] = useState("");
  const hasFilters = filters.distance !== "" || filters.minAge !== 18 || filters.maxAge !== 120 || filters.gender !== "all";

  useEffect(() => {
    const map = L.map(container.current).setView([-26.2041, 28.0473], 11);
    mapRef.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    let marker;
    map.on("locationfound", (event) => {
      if (marker) marker.remove();
      marker = L.circleMarker(event.latlng, {
        radius: 9, color: "#fff", weight: 3, fillColor: "#e11d48", fillOpacity: 1,
      }).addTo(map).bindPopup("Your location");
      setLocating(false);
      setMessage("");
    });
    map.on("locationerror", () => {
      setLocating(false);
      setMessage("Couldn't access your location. You can still move and zoom the map.");
    });
    return () => {
      map.stopLocate();
      map.off();
      map.remove();
      mapRef.current = null;
      liveMarker.current = null;
      centered.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = L.layerGroup().addTo(map);
    let active = true;
    let loading = false;
    async function loadPeople() {
      if (loading) return;
      loading = true;
      try {
        const { data, error } = await supabase.rpc("discover_people", {
          max_distance: filters.distance === "" ? null : Number(filters.distance),
          min_age: filters.minAge,
          max_age: filters.maxAge,
          preferred_gender: filters.gender,
        });
        if (error) throw error;
        const photoPaths = [...new Set((data || []).map((person) => person.photo_path).filter(Boolean))];
        const photoUrls = new Map();
        if (photoPaths.length) {
          const { data: signed, error: photoError } = await supabase.storage.from("profile-photos").createSignedUrls(photoPaths, 300);
          if (!photoError) {
            for (const photo of signed || []) {
              if (!photo.error && photo.signedUrl) photoUrls.set(photo.path, photo.signedUrl);
            }
          }
        }
        if (!active) return;
        setPeople((data || []).map((person) => ({ ...person, photoUrl: photoUrls.get(person.photo_path) })));
        markers.clearLayers();
        for (const person of data || []) {
          const popup = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = person.age == null ? person.display_name : `${person.display_name}, ${person.age}`;
          const distance = document.createElement("p");
          distance.textContent = person.distance_km === null
            ? "Approximate location"
            : person.distance_km < 1 ? "Less than 1 km away · approximate" : `About ${person.distance_km} km away`;
          const updated = document.createElement("small");
          updated.textContent = `Last location update: ${new Date(person.location_updated_at).toLocaleString()}`;
          const gender = document.createElement("p");
          gender.textContent = genderLabel(person.gender);
          const view = document.createElement("button");
          view.type = "button";
          view.className = "map-view-profile";
          view.textContent = "View profile";
          view.addEventListener("click", () => setSelectedPerson(person));
          popup.append(title, gender, distance, updated, view);
          const markerContent = document.createElement("div");
          markerContent.className = "person-marker-content";
          markerContent.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></svg>';
          const photoUrl = photoUrls.get(person.photo_path);
          if (photoUrl) {
            const image = document.createElement("img");
            image.src = photoUrl;
            image.alt = "";
            image.addEventListener("error", () => image.remove(), { once: true });
            markerContent.append(image);
          }
          L.marker([person.latitude, person.longitude], {
            icon: L.divIcon({ className: "person-map-marker photo-map-marker", html: markerContent, iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -26] }),
            title: person.display_name,
          }).bindPopup(popup).addTo(markers);
        }
        setPeopleMessage(data?.length ? "" : "No people match these filters. Try widening your preferences.");
      } catch (error) {
        if (active) setPeopleMessage(error.code === "PGRST202"
          ? "Run supabase/discover.sql to show people on the map."
          : "Could not load people. Retrying shortly.");
      } finally { loading = false; }
    }
    void loadPeople();
    const timer = window.setInterval(loadPeople, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      markers.remove();
    };
  }, [filters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    const point = [location.latitude, location.longitude];
    if (!liveMarker.current) {
      liveMarker.current = L.circleMarker(point, {
        radius: 9, color: "#fff", weight: 3, fillColor: "#e11d48", fillOpacity: 1,
      }).addTo(map).bindPopup("Your current location");
    } else {
      liveMarker.current.setLatLng(point);
    }
    if (!centered.current) {
      map.setView(point, 14);
      centered.current = true;
    }
  }, [location]);

  function locate() {
    setLocating(true);
    setMessage("");
    mapRef.current?.locate({ setView: true, maxZoom: 14, timeout: 10000 });
  }

  return (
    <section className="discover-map" aria-label="Discover map">
      <div ref={container} className="discover-map-canvas" aria-label="Interactive OpenStreetMap" style={{ visibility: view === "map" ? "visible" : "hidden" }} aria-hidden={view !== "map"} inert={view !== "map"} />
      <div className="discover-view-switch" role="group" aria-label="Discovery view">
        <button type="button" aria-pressed={view === "map"} onClick={() => { setView("map"); window.requestAnimationFrame(() => mapRef.current?.invalidateSize()); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z M9 3v15m6-12v15" /></svg>Map
        </button>
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" /></svg>List
        </button>
      </div>
      {view === "list" && <section className="discover-list" aria-label="Discover people">
        <h1>Discover people</h1>
        <div className="discover-profile-grid">{people.map((person) => <article className="discover-person-card" key={person.profile_id}>
          <div className="discover-person-photo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" /></svg>
            {person.photoUrl && <img src={person.photoUrl} alt={person.display_name} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
          </div>
          <div className="discover-person-details">
            <h2>{person.display_name}{person.age != null ? `, ${person.age}` : ""}</h2>
            <p>{genderLabel(person.gender)}</p>
            <p>{person.distance_km == null ? "Approximate location" : person.distance_km < 1 ? "Less than 1 km away" : `About ${person.distance_km} km away`}</p>
            <button type="button" className="map-view-profile" onClick={() => setSelectedPerson(person)}>View profile<span className="sr-only"> for {person.display_name}</span></button>
          </div>
        </article>)}</div>
        {!people.length && <p role="status">{peopleMessage || "No people match your preferences. Try adjusting the filters."}</p>}
      </section>}
      <button type="button" className="map-locate" onClick={locate} disabled={locating}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
        {locating ? "Locating..." : "My location"}
      </button>
      {message && <p className="map-message" role="status">{message}</p>}
      <button type="button" className="map-filter-button" onClick={() => { setDraft(filters); setFilterError(""); filterDialog.current.showModal(); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="white" /><circle cx="15" cy="17" r="3" fill="white" /></svg>
        Filters{hasFilters ? " · On" : ""}
      </button>
      <dialog ref={filterDialog} className="photo-dialog discovery-filters" aria-labelledby="filter-title">
        <h2 id="filter-title">Discovery preferences</h2>
        <form onSubmit={(event) => {
          event.preventDefault();
          const min = Number(draft.minAge), max = Number(draft.maxAge);
          if (!Number.isInteger(min) || !Number.isInteger(max) || min < 18 || max > 120 || min > max) {
            setFilterError("Choose an age range between 18 and 120, with minimum no greater than maximum."); return;
          }
          setFilters({ ...draft, minAge: min, maxAge: max });
          filterDialog.current.close();
        }}>
          <label htmlFor="filter-distance">Maximum distance</label>
          <select id="filter-distance" value={draft.distance} onChange={(e) => setDraft({ ...draft, distance: e.target.value })}>
            <option value="">Any distance</option>{[5, 10, 25, 50, 100, 250, 500].map((km) => <option key={km} value={km}>{km} km</option>)}
          </select>
          <p className="filter-help">Distance uses your last saved location and approximate map positions.</p>
          <div className="filter-age-range">
            <label>Minimum age<input type="number" min="18" max="120" required value={draft.minAge} onChange={(e) => setDraft({ ...draft, minAge: e.target.value })} /></label>
            <label>Maximum age<input type="number" min="18" max="120" required value={draft.maxAge} onChange={(e) => setDraft({ ...draft, maxAge: e.target.value })} /></label>
          </div>
          <label htmlFor="filter-gender">Show me</label>
          <select id="filter-gender" value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
            <option value="all">Everyone</option><option value="woman">Women</option><option value="man">Men</option><option value="nonbinary">Nonbinary people</option><option value="self_described">Another identity</option><option value="prefer_not_to_say">Gender not shared</option>
          </select>
          {filterError && <p role="alert" className="photo-error">{filterError}</p>}
          <div className="photo-dialog-actions">
            <button type="button" onClick={() => { setDraft({ distance: "", minAge: 18, maxAge: 120, gender: "all" }); setFilterError(""); }}>Reset</button>
            <button type="button" onClick={() => filterDialog.current.close()}>Cancel</button>
            <button type="submit">Apply</button>
          </div>
        </form>
      </dialog>
      {view === "map" && peopleMessage && <p className="map-people-status" role="status">{peopleMessage}</p>}
      {selectedPerson && <PersonProfile key={selectedPerson.profile_id} person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </section>
  );
}
