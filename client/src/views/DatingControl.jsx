import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, X, Save, Edit2, Play, ArrowUp, ArrowDown, Settings, Heart } from 'lucide-react';
import axios from 'axios';
import { DEFAULT_APP_NAME } from '../constants';

export default function DatingControl({ socket, data }) {
    const { datingProfiles = [], activeDatingProfileId, datingAppName } = data;
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // Config State
    const [appNameInput, setAppNameInput] = useState(datingAppName ?? DEFAULT_APP_NAME);

    // New Profile State
    const [isCreating, setIsCreating] = useState(false);
    const [newProfile, setNewProfile] = useState({ name: '', age: '', bio: '', isMatch: false });

    // Scenarios State
    const [newScenarioName, setNewScenarioName] = useState("");

    // Edit State
    const [editForm, setEditForm] = useState({});

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPercent, setUploadPercent] = useState(0);

    const selectedProfile = datingProfiles.find(p => p.id === selectedProfileId);

    // Refs for hidden file inputs
    const actorFileInputRef = useRef(null);
    const profileFileInputRef = useRef(null);
    const pendingUploadId = useRef(null); // Track which profile is being updated
    const lastUploadClickTime = useRef(0); // Throttle clicks to prevent OS freeze

    // Sync input with data if it changes externally
    useEffect(() => {
        setAppNameInput(datingAppName ?? DEFAULT_APP_NAME);
    }, [datingAppName]);

    const handleSaveAppName = () => {
        socket.emit('control:update_app_name', appNameInput);
    };

    const handleCreate = () => {
        if (newProfile.name && newProfile.age) {
            socket.emit('control:create_dating_profile', newProfile);
            setNewProfile({ name: '', age: '', bio: '', isMatch: false });
            setIsCreating(false);
        }
    };

    const handleUpdate = () => {
        if (editForm.id) {
            socket.emit('control:update_dating_profile', editForm);
            setIsEditing(false);
        }
    };

    const uploadImage = async (e, id_or_purpose) => {
        const file = e.target.files[0];
        if (!file) return;

        // 1. Determine Purpose
        let purpose = 'dating';
        let profileId = null;

        if (id_or_purpose === 'actor') {
            purpose = 'actor';
        } else if (id_or_purpose === 'dating-match-overlay') {
            purpose = 'dating-match-overlay';
        } else {
            // Assume it's a dating profile ID
            purpose = 'dating';
            profileId = id_or_purpose;
        }

        setIsUploading(true);

        // Helper: Compress Image
        const compressImage = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 1080;
                        const MAX_HEIGHT = 1080;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
                        }, 'image/jpeg', 0.85); // 85% Quality
                    };
                    img.onerror = (err) => reject(err);
                };
                reader.onerror = (err) => reject(err);
            });
        };

        try {
            // Compress only if NOT overlay (need transparency) and NOT match overlay
            // Actually, we should probably skip compression for 'dating' too if we want high quality, 
            // but the server code says "NO COMPRESSION for Dating App" in comments, yet the client was compressing?
            // Let's align with user request: "durchsichtige Alpha PNG Bilder unterstützen" -> NO COMPRESSION for overlay.

            let processedFile = file;
            if (purpose !== 'dating-match-overlay' && purpose !== 'dating') {
                processedFile = await compressImage(file);
            }

            const formData = new FormData();
            formData.append('file', processedFile);
            formData.append('purpose', purpose);
            if (profileId) formData.append('profileId', profileId);

            await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadPercent(percent);
                }
            });
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed");
        } finally {
            setIsUploading(false);
            e.target.value = null;
        }
    };

    const handleDelete = (id) => {
        if (confirm("Delete this dating profile?")) {
            socket.emit('control:delete_dating_profile', id);
            if (selectedProfileId === id) setSelectedProfileId(null);
        }
    };

    const handleSetActive = (id, e) => {
        e.stopPropagation();
        socket.emit('control:set_active_dating_profile', id);
        socket.emit('control:switch_app', 'dating');
    };

    const moveProfile = (index, direction, e) => {
        e.stopPropagation();
        const newProfiles = [...datingProfiles];
        if (direction === 'up' && index > 0) {
            [newProfiles[index - 1], newProfiles[index]] = [newProfiles[index], newProfiles[index - 1]];
        } else if (direction === 'down' && index < newProfiles.length - 1) {
            [newProfiles[index + 1], newProfiles[index]] = [newProfiles[index], newProfiles[index + 1]];
        }
        socket.emit('control:reorder_dating_profiles', newProfiles);
    };

    // Initialize edit form when opening edit
    const startEdit = (profile) => {
        setEditForm({ ...profile });
        setIsEditing(true);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
            {/* HIDDEN INPUTS MOVED TO ROOT FOR STABILITY (Fixes Freeze Issue) */}
            <input
                type="file"
                style={{ position: 'fixed', top: -10000, left: -10000, visibility: 'hidden', width: 1, height: 1 }}
                ref={profileFileInputRef}
                onClick={(e) => {
                    console.log('Upload: Input clicked, resetting value to force change event');
                    e.target.value = null; // Ensure onChange fires even for same file
                }}
                onChange={(e) => {
                    console.log('Upload: File selected', e.target.files[0]?.name);
                    uploadImage(e, pendingUploadId.current);
                }}
            />

            {/* LEFT: Profile List & Config */}
            <div className="glass" style={{ padding: '20px', borderRadius: '16px', height: 'fit-content' }}>

                {/* App Name Config */}
                <div style={{ marginBottom: 20, paddingBottom: 15, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                        <Settings size={14} style={{ opacity: 0.5 }} />
                        <span style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase' }}>App Settings</span>
                    </div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {/* Status Indicator */}
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: socket.connected ? '#22c55e' : '#ef4444',
                            marginRight: 5
                        }} title={socket.connected ? "Connected" : "Disconnected"} />
                        <input
                            className="chat-input-field"
                            style={{ padding: '8px', fontSize: '0.9rem' }}
                            value={appNameInput}
                            onChange={(e) => {
                                const val = e.target.value;
                                setAppNameInput(val);
                                // Use REST for reliability. Send space if empty to ensure update is processed.
                                axios.post('/api/control/app-name', { name: val === '' ? ' ' : val }).catch(err => console.error(err));
                            }}
                            placeholder={`App Name (e.g. ${DEFAULT_APP_NAME})`}
                        />
                    </div>
                </div>

                {/* THEME EDITOR */}
                <div style={{ marginBottom: 20, paddingBottom: 15, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: `linear-gradient(45deg, ${data.datingTheme?.primary || '#FF4B6E'}, ${data.datingTheme?.background || '#000'})` }}></div>
                        <span style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase' }}>Theme Colors</span>
                    </div>
                    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: '0.7rem', color: '#888' }}>Primary</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    type="color"
                                    value={data.datingTheme?.primary || "#FF4B6E"}
                                    onChange={(e) => socket.emit('control:update_dating_theme', { primary: e.target.value })}
                                    style={{ border: 'none', width: 30, height: 30, cursor: 'pointer', background: 'none', padding: 0 }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: '0.7rem', color: '#888' }}>Background</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    type="color"
                                    value={data.datingTheme?.background || "#111111"}
                                    onChange={(e) => socket.emit('control:update_dating_theme', { background: e.target.value })}
                                    style={{ border: 'none', width: 30, height: 30, cursor: 'pointer', background: 'none', padding: 0 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <h3 style={{ margin: 0 }}>Profiles</h3>
                    <button className="control-btn primary" style={{ width: 'auto', marginBottom: 0, padding: '5px 10px' }} onClick={() => setIsCreating(true)}>
                        <Plus size={16} /> New
                    </button>
                </div>

                {/* ACTOR PROFILE (SELF) - INTEGRATED HERE */}
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 12, marginBottom: 15 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', opacity: 0.8 }}>My Profile (Actor)</h4>
                    <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                        {/* Avatar Preview */}
                        <div className="avatar" style={{
                            width: 50, height: 50,
                            borderRadius: '50%',
                            fontSize: '0.8rem',
                            background: data.actorAvatar ? `url(${data.actorAvatar}) center/cover no-repeat` : 'var(--primary-gradient)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {!data.actorAvatar && "Me"}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <input
                                type="file"
                                style={{ display: 'none' }}
                                ref={actorFileInputRef}
                                onChange={(e) => uploadImage(e, 'actor')}
                            />
                            <button className="control-btn secondary"
                                style={{ marginBottom: 0, padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                                onClick={() => {
                                    const now = Date.now();
                                    if (now - lastUploadClickTime.current < 1000) return; // Prevent rapid clicks
                                    lastUploadClickTime.current = now;
                                    actorFileInputRef.current.click();
                                }}
                            >
                                Upload New
                            </button>

                            {data.actorAvatar && (
                                <button
                                    className="control-btn danger"
                                    style={{ width: 'auto', marginBottom: 0, padding: '4px 10px', fontSize: '0.8rem' }}
                                    onClick={() => {
                                        if (confirm("Reset profile picture?")) {
                                            socket.emit('control:clear_avatar', { purpose: 'actor' });
                                        }
                                    }}>
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {isCreating && (
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, marginBottom: 10 }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>New Profile</h4>
                        <input className="chat-input-field" placeholder="Name" value={newProfile.name} onChange={e => setNewProfile({ ...newProfile, name: e.target.value })} style={{ marginBottom: 5 }} />
                        <input className="chat-input-field" placeholder="Age" type="number" value={newProfile.age} onChange={e => setNewProfile({ ...newProfile, age: e.target.value })} style={{ marginBottom: 5 }} />
                        <input className="chat-input-field" placeholder="Bio" value={newProfile.bio} onChange={e => setNewProfile({ ...newProfile, bio: e.target.value })} style={{ marginBottom: 5 }} />

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10, fontSize: '0.9rem' }}>
                            <input
                                type="checkbox"
                                checked={newProfile.isMatch}
                                onChange={e => setNewProfile({ ...newProfile, isMatch: e.target.checked })}
                            />
                            Trigger MATCH on Like (Right Swipe)
                        </label>

                        <div style={{ display: 'flex', gap: 5 }}>
                            <button className="control-btn primary" onClick={handleCreate}>Create</button>
                            <button className="control-btn secondary" onClick={() => setIsCreating(false)}>Cancel</button>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Shared Input for Profile List */}


                    {datingProfiles.map((p, index) => (
                        <div
                            key={p.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 15,
                                padding: 12, borderRadius: 10,
                                background: selectedProfileId === p.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                                border: activeDatingProfileId === p.id ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                                position: 'relative'
                            }}
                        >
                            <div style={{
                                width: 50, height: 50, borderRadius: '50%',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : 'none',
                                backgroundColor: '#333',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {!p.imageUrl && <span style={{ fontSize: '0.8rem' }}>?</span>}
                            </div>

                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {p.name}, {p.age}
                                    {activeDatingProfileId === p.id && <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 'bold' }}>ACTIVE</span>}
                                    {p.isMatch && <span style={{ fontSize: '0.75rem', background: '#ec4899', color: 'white', padding: '0 6px', borderRadius: 4 }}>MATCH</span>}
                                </div>
                                <div style={{ opacity: 0.6, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {p.bio || "No bio"}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                {/* ACTIONS ON PROFILE CARD */}

                                <button className="control-btn secondary" style={{ width: 'auto', height: 32, padding: '0 8px' }}
                                    title="Change Photo"
                                    onClick={() => {
                                        const now = Date.now();
                                        if (now - lastUploadClickTime.current < 1000) return; // Prevent rapid clicks
                                        lastUploadClickTime.current = now;
                                        pendingUploadId.current = p.id;
                                        profileFileInputRef.current.click();
                                    }}>
                                    <Upload size={14} />
                                </button>

                                <button className="control-btn secondary" style={{ width: 'auto', height: 32, padding: '0 10px' }}
                                    onClick={() => { setSelectedProfileId(p.id); startEdit(p); }}>
                                    <Edit2 size={14} style={{ marginRight: 4 }} /> Edit
                                </button>
                                <button className="control-btn danger" style={{ width: 'auto', height: 32, padding: '0 8px' }}
                                    onClick={() => handleDelete(p.id)}>
                                    <Trash2 size={14} />
                                </button>

                                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 5px' }}></div>

                                <button
                                    className="control-btn"
                                    title={p.isMatch ? "Unset Match" : "Set as Match"}
                                    style={{
                                        padding: 6, width: 'auto', marginBottom: 0,
                                        background: p.isMatch ? 'rgba(236, 72, 153, 0.2)' : 'rgba(0,0,0,0.3)',
                                        border: p.isMatch ? '1px solid #ec4899' : '1px solid transparent',
                                    }}
                                    onClick={(e) => {
                                        socket.emit('control:update_dating_profile', { ...p, isMatch: !p.isMatch });
                                    }}
                                >
                                    <Heart size={14} fill={p.isMatch ? "#ec4899" : "none"} color={p.isMatch ? "#ec4899" : "white"} />
                                </button>

                                <button
                                    className="control-btn"
                                    style={{ padding: 6, width: 'auto', marginBottom: 0, background: 'rgba(0,0,0,0.3)' }}
                                    onClick={(e) => moveProfile(index, 'up', e)}
                                    disabled={index === 0}
                                >
                                    <ArrowUp size={14} />
                                </button>
                                <button
                                    className="control-btn"
                                    style={{ padding: 6, width: 'auto', marginBottom: 0, background: 'rgba(0,0,0,0.3)' }}
                                    onClick={(e) => moveProfile(index, 'down', e)}
                                    disabled={index === datingProfiles.length - 1}
                                >
                                    <ArrowDown size={14} />
                                </button>
                                <button
                                    className="control-btn success"
                                    title="Show on Phone"
                                    style={{ padding: 6, width: 'auto', marginBottom: 0, marginLeft: 4, opacity: activeDatingProfileId === p.id ? 0.5 : 1 }}
                                    onClick={(e) => handleSetActive(p.id, e)}
                                    disabled={activeDatingProfileId === p.id}
                                >
                                    <Play size={14} fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Edit Form (Visible only when editing) & Szenen */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* EDIT FORM */}
                {isEditing && selectedProfile && (
                    <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Edit {selectedProfile.name}</h2>
                            <button className="control-btn secondary" style={{ width: 'auto', padding: 5 }} onClick={() => setIsEditing(false)}><X size={16} /></button>
                        </div>

                        {/* Image Upload in Edit Form for convenience */}


                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 10 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 2, fontSize: '0.8rem', opacity: 0.7 }}>Name</label>
                                <input className="chat-input-field" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 2, fontSize: '0.8rem', opacity: 0.7 }}>Age</label>
                                <input className="chat-input-field" type="number" value={editForm.age} onChange={e => setEditForm({ ...editForm, age: e.target.value })} style={{ width: '100%' }} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', marginBottom: 2, fontSize: '0.8rem', opacity: 0.7 }}>Bio</label>
                            <input className="chat-input-field" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} style={{ width: '100%' }} />
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 15, fontSize: '0.9rem' }}>
                            <input
                                type="checkbox"
                                checked={editForm.isMatch}
                                onChange={e => setEditForm({ ...editForm, isMatch: e.target.checked })}
                            />
                            <strong>Match Trigger</strong> <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>(Swipe Right Animation)</span>
                        </label>

                        <button className="control-btn primary" onClick={handleUpdate} style={{ padding: '8px 16px' }}>
                            <Save size={16} style={{ marginRight: 8 }} /> Save Changes
                        </button>
                    </div>
                )}

                {/* MATCH SCREEN SETTINGS */}
                <div className="glass" style={{ padding: '20px', borderRadius: '16px', marginTop: 20 }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', opacity: 0.9 }}>Match Screen Settings</h3>

                    {/* Background Color & Opacity */}
                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: 5 }}>Background Overlay</label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input
                                type="color"
                                value={(() => {
                                    // Parse RGBA to HEX for picker
                                    const rgba = data.datingMatchSettings?.overlayColor || "rgba(0,0,0,0.85)";
                                    if (rgba.startsWith('#')) return rgba;
                                    const parts = rgba.match(/[\d.]+/g);
                                    if (parts && parts.length >= 3) {
                                        const r = parseInt(parts[0]).toString(16).padStart(2, '0');
                                        const g = parseInt(parts[1]).toString(16).padStart(2, '0');
                                        const b = parseInt(parts[2]).toString(16).padStart(2, '0');
                                        return `#${r}${g}${b}`;
                                    }
                                    return "#000000";
                                })()}
                                onChange={(e) => {
                                    const hex = e.target.value;
                                    // Get current alpha
                                    const currentRgba = data.datingMatchSettings?.overlayColor || "rgba(0,0,0,0.85)";
                                    let alpha = 0.85;
                                    const parts = currentRgba.match(/[\d.]+/g);
                                    if (parts && parts.length === 4) alpha = parts[3];

                                    // Convert Hex to RGB
                                    const r = parseInt(hex.slice(1, 3), 16);
                                    const g = parseInt(hex.slice(3, 5), 16);
                                    const b = parseInt(hex.slice(5, 7), 16);

                                    socket.emit('control:update_dating_match_settings', { overlayColor: `rgba(${r},${g},${b},${alpha})` });
                                }}
                                style={{ width: 40, height: 30, border: 'none', background: 'none', cursor: 'pointer' }}
                            />

                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: '0.8rem' }}>Opacity</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={(() => {
                                        const rgba = data.datingMatchSettings?.overlayColor || "rgba(0,0,0,0.85)";
                                        const parts = rgba.match(/[\d.]+/g);
                                        return parts && parts.length === 4 ? parseFloat(parts[3]) * 100 : 85;
                                    })()}
                                    onChange={(e) => {
                                        const alpha = parseInt(e.target.value) / 100;
                                        // Get current RGB
                                        const currentRgba = data.datingMatchSettings?.overlayColor || "rgba(0,0,0,0.85)";
                                        let r = 0, g = 0, b = 0;
                                        if (currentRgba.startsWith('#')) {
                                            r = parseInt(currentRgba.slice(1, 3), 16);
                                            g = parseInt(currentRgba.slice(3, 5), 16);
                                            b = parseInt(currentRgba.slice(5, 7), 16);
                                        } else {
                                            const parts = currentRgba.match(/[\d.]+/g);
                                            if (parts) { r = parts[0]; g = parts[1]; b = parts[2]; }
                                        }
                                        socket.emit('control:update_dating_match_settings', { overlayColor: `rgba(${r},${g},${b},${alpha})` });
                                    }}
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Overlay Image */}
                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: 5 }}>Overlay Image (Center)</label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {data.datingMatchSettings?.overlayImage ? (
                                <div style={{ width: 60, height: 60, background: `url(${data.datingMatchSettings.overlayImage}) center/contain no-repeat`, backgroundSize: 'contain', border: '1px solid #444', borderRadius: 4 }}></div>
                            ) : (
                                <div style={{ width: 60, height: 60, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#555' }}>No Img</div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <input
                                    type="file"
                                    style={{ display: 'none' }}
                                    id="overlay-upload"
                                    onChange={(e) => uploadImage(e, 'dating-match-overlay')}
                                />
                                <button className="control-btn secondary" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }}
                                    onClick={() => document.getElementById('overlay-upload').click()}
                                >
                                    Upload PNG
                                </button>
                                {data.datingMatchSettings?.overlayImage && (
                                    <button className="control-btn danger" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }}
                                        onClick={() => {
                                            if (confirm("Remove overlay image?")) {
                                                socket.emit('control:clear_avatar', { purpose: 'dating-match-overlay' });
                                            }
                                        }}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Image Size Slider */}
                        {data.datingMatchSettings?.overlayImage && (
                            <div style={{ marginTop: 10 }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.7, marginBottom: 5 }}>
                                    <span>Image Size</span>
                                    <span>{data.datingMatchSettings?.overlayImageSize ?? 80}%</span>
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="150"
                                    value={data.datingMatchSettings?.overlayImageSize ?? 80}
                                    onChange={(e) => socket.emit('control:update_dating_match_settings', { overlayImageSize: parseInt(e.target.value) })}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', marginBottom: 2, fontSize: '0.8rem', opacity: 0.7 }}>Title Text</label>
                        <input
                            className="chat-input-field"
                            value={data.datingMatchSettings?.title ?? "It's a Match!"}
                            onChange={(e) => socket.emit('control:update_dating_match_settings', { title: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', marginBottom: 2, fontSize: '0.8rem', opacity: 0.7 }}>Subtitle</label>
                        <input
                            className="chat-input-field"
                            value={data.datingMatchSettings?.subtitle ?? "You and {name} liked each other."}
                            onChange={(e) => socket.emit('control:update_dating_match_settings', { subtitle: e.target.value })}
                            style={{ width: '100%' }}
                            placeholder="Use {name} for profile name"
                        />
                    </div>

                </div>
            </div>
        </div >
    );
}
