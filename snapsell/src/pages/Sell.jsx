import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, PHOTOS_BUCKET } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';

const CATEGORIES = ['Cars', 'Real Estate', 'Electronics', 'Furniture', 'Services', 'Other'];

export default function Sell() {
  const { session, profile } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef(null);

  const [files, setFiles] = useState([]); // { file, dataUrl }
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subActive, setSubActive] = useState(null); // null | bool

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');

  useEffect(() => {
    if (!session) return;
    supabase.from('subscriptions').select('status').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setSubActive(data?.status === 'active' || data?.status === 'trialing'));
  }, [session]);

  const onPickFiles = async (e) => {
    const list = Array.from(e.target.files || []).slice(0, 8 - files.length);
    if (!list.length) return;
    const next = await Promise.all(list.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = () => res({ file: f, dataUrl: r.result });
      r.readAsDataURL(f);
    })));
    setFiles(prev => [...prev, ...next]);
    if (!aiDone && next[0]) runAI(next[0].dataUrl);
    e.target.value = '';
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const runAI = async (dataUrl) => {
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-photo', {
        body: { image: dataUrl }
      });
      if (error) throw error;
      if (data?.title) setTitle(t => t || data.title);
      if (data?.description) setDescription(d => d || data.description);
      if (data?.category && CATEGORIES.includes(data.category)) setCategory(data.category);
      if (data?.suggested_price) setPrice(p => p || String(data.suggested_price));
      setAiDone(true);
    } catch (err) {
      console.warn('AI analyze failed:', err);
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!session) return;
    if (!subActive) { nav('/subscribe'); return; }
    if (!files.length) { alert('Add at least 1 photo'); return; }
    setSubmitting(true);
    try {
      const photoUrls = [];
      for (const { file } of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const key = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(key, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(key);
        photoUrls.push(pub.publicUrl);
      }
      // Save phone/whatsapp to profile if changed
      if (phone !== profile?.phone || whatsapp !== profile?.whatsapp) {
        await supabase.from('profiles').update({ phone, whatsapp }).eq('id', session.user.id);
      }
      const { data, error } = await supabase.from('listings').insert({
        seller_id: session.user.id,
        title, description, category,
        price: Number(price),
        location,
        photos: photoUrls,
        status: 'active'
      }).select().single();
      if (error) throw error;
      nav(`/listing/${data.id}`);
    } catch (err) {
      alert('Could not publish: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title && price && category && files.length > 0;

  return (
    <div className="form" style={{ maxWidth: 560 }}>
      <h1 style={{ padding: '0 4px' }}>Snap & sell</h1>

      <div className="sell-camera" onClick={() => fileRef.current?.click()}>
        {files[0] ? <img src={files[0].dataUrl} alt="" /> : (
          <div className="placeholder">
            <div className="ico">📷</div>
            <div style={{ marginTop: 8, fontWeight: 700, color: 'var(--text)' }}>Take or upload a photo</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>AI fills the listing for you</div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={onPickFiles}
        />
      </div>

      {files.length > 0 && (
        <div className="thumb-row">
          {files.map((f, i) => (
            <div className="pic" key={i}>
              <img src={f.dataUrl} alt="" />
              <div className="x" onClick={() => removeFile(i)}>×</div>
            </div>
          ))}
          {files.length < 8 && <div className="add" onClick={() => fileRef.current?.click()}>+</div>}
        </div>
      )}

      {aiBusy && (
        <div className="ai-banner pulse">
          <span className="ai-dot"></span>
          AI is reading the photo and writing your listing…
        </div>
      )}
      {aiDone && !aiBusy && (
        <div className="ai-banner">
          <span className="ai-dot"></span>
          AI suggested the fields below — edit anything you want.
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field"><label>Title</label><input value={title} onChange={e => setTitle(e.target.value)} required maxLength={120} /></div>

        <div className="row2">
          <div className="field"><label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Price (USD)</label><input value={price} onChange={e => setPrice(e.target.value)} required inputMode="numeric" placeholder="0" /></div>
        </div>

        <div className="field"><label>Location</label><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Miami, FL" /></div>
        <div className="field"><label>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} required maxLength={2000} /></div>

        <div className="row2">
          <div className="field"><label>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="+1 305 555 0100" /></div>
          <div className="field"><label>WhatsApp</label><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} inputMode="tel" placeholder="+1 305 555 0100" /></div>
        </div>

        {subActive === false && (
          <div className="ai-banner" style={{ borderColor: 'rgba(255,181,71,0.4)' }}>
            ⚡ Activate your $5/mo plan to publish unlimited listings.
          </div>
        )}

        <button className="btn" disabled={!canSubmit || submitting}>
          {submitting ? 'Publishing…' : (subActive ? 'Publish listing' : 'Activate plan & publish')}
        </button>
      </form>
    </div>
  );
}
