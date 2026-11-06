import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";

const bucket = () => supabase.storage.from("profile-photos");
const slots = [1, 2, 3, 4, 5, 6, 7];

function PhotoPreview({ file }) {
  const image = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={file.name} />;
}

export default function ProfilePhotos() {
  const [photos, setPhotos] = useState([]);
  const [userId, setUserId] = useState(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const dialog = useRef(null);
  const [selected, setSelected] = useState([]);
  const [progress, setProgress] = useState("");

  function choose(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setMessage("");
    if (files.length > 7 - photos.length) {
      setMessage(`You can add ${7 - photos.length} more photos.`);
      return;
    }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage("Choose JPG, PNG or WebP photos, up to 5 MB each.");
      return;
    }
    setSelected(files);
  }

  async function load(id) {
    const { data, error } = await bucket().list(id);
    if (error) throw error;
    const files = data.filter((file) => /^[1-7]$/.test(file.name)).sort((a, b) => Number(a.name) - Number(b.name));
    if (!files.length) { setPhotos([]); return; }
    const { data: urls, error: urlError } = await bucket().createSignedUrls(files.map((file) => `${id}/${file.name}`), 3600);
    if (urlError) throw urlError;
    if (urls.some((item) => item.error)) throw new Error("Could not load photo previews.");
    setPhotos(urls.map((item, index) => ({ slot: Number(files[index].name), url: item.signedUrl })));
  }

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("Complete signup to add your photos.");
        if (!active) return;
        setUserId(data.user.id);
        await load(data.user.id);
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setBusy(false);
      }
    }
    void start();
    return () => { active = false; };
  }, []);

  async function upload() {
    const files = selected;
    if (!files.length || lock.current || !userId) return;
    const empty = slots.filter((slot) => !photos.some((photo) => photo.slot === slot));
    if (files.length > empty.length) { setMessage("You can add up to 7 photos in total."); return; }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage("Choose JPG, PNG or WebP photos, up to 5 MB each."); return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    let uploaded = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading ${i + 1} of ${files.length}...`);
        const { error } = await bucket().upload(`${userId}/${empty[i]}`, files[i], { contentType: files[i].type, upsert: false });
        if (error) throw error;
        uploaded++;
      }
      dialog.current.close();
    } catch (error) {
      setMessage(`Could not upload all photos: ${error.message}`);
    } finally {
      setSelected(files.slice(uploaded));
      setProgress("");
      try { await load(userId); } catch (error) { setMessage(error.message); }
      lock.current = false;
      setBusy(false);
    }
  }

  async function remove(slot) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await bucket().remove([`${userId}/${slot}`]);
      if (error) throw error;
      await load(userId);
    } catch (error) { setMessage(error.message); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <section className="profile-photos">
      <h1>Your photos</h1>
      <p>Add up to 7 photos. We recommend at least 3 so people can get to know you.</p>
      <p className="photo-count">{photos.length}/7 photos · {photos.length >= 3 ? "Recommended minimum reached" : `${3 - photos.length} more to reach 3`}</p>
      <div className="photo-grid">
        {slots.map((slot) => {
          const photo = photos.find((item) => item.slot === slot);
          return <div className="photo-slot" key={slot}>
            {photo ? <><img src={photo.url} alt={`Your profile photo ${slot}`} /><button type="button" disabled={busy} onClick={() => remove(slot)} aria-label={`Remove photo ${slot}`}>Remove</button></> : <span aria-label={`Empty photo slot ${slot}`}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-5 5 6" /></svg>{slot}</span>}
          </div>;
        })}
      </div>
      <button type="button" className="photo-upload" disabled={busy || !userId || photos.length >= 7} onClick={() => { setSelected([]); setMessage(""); dialog.current.showModal(); }}>Add photos</button>
      <dialog ref={dialog} className="photo-dialog" aria-labelledby="upload-title" onCancel={(event) => { if (lock.current) event.preventDefault(); }}>
        <h2 id="upload-title">Add your photos</h2>
        <p>Choose up to {7 - photos.length} more photos. We recommend 3 in total.</p>
        <label className="photo-upload">Choose pictures<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={choose} /></label>
        <div className="photo-preview-grid">{selected.map((file, index) => <PhotoPreview key={`${file.name}-${index}`} file={file} />)}</div>
        {message && <p role="alert" className="photo-error">{message}</p>}
        <p role="status">{progress || (selected.length ? `${selected.length} photos selected` : "JPG, PNG or WebP · Up to 5 MB each")}</p>
        <div className="photo-dialog-actions">
          <button type="button" disabled={busy} onClick={() => { dialog.current.close(); setSelected([]); setMessage(""); }}>Cancel</button>
          <button type="button" disabled={busy || !selected.length} onClick={upload}>{busy ? "Uploading..." : "Upload photos"}</button>
        </div>
      </dialog>
      <small>JPG, PNG or WebP · Up to 5 MB per photo</small>
      {message && <p role="alert" className="photo-error">{message}</p>}
    </section>
  );
}
