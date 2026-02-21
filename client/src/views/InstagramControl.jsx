import React, { useState, useRef } from 'react';
import { Plus, Trash2, Edit2, Upload, X, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

export default function InstagramControl({ socket, data }) {
    const { instagramProfiles = [], activeInstagramProfileId } = data;
    const activeProfile = instagramProfiles.find(p => p.id === activeInstagramProfileId) || instagramProfiles[0];

    // File Input Refs
    const avatarInputRef = useRef(null);
    const gridInputRef = useRef(null);

    // State for which grid photo we are currently replacing
    const [uploadingGridPhotoId, setUploadingGridPhotoId] = useState(null);

    const updateProfile = (updates) => {
        if (!activeProfile) return;
        const updatedProfiles = instagramProfiles.map(p =>
            p.id === activeProfile.id ? { ...p, ...updates } : p
        );
        socket.emit('control:update_instagram', { instagramProfiles: updatedProfiles });
    };

    const handleAddProfile = () => {
        const newId = `profile-${Date.now()}`;
        const newProfile = {
            id: newId,
            name: 'new_user',
            displayName: 'New Profile',
            bio: 'Bio goes here...',
            followers: '0',
            following: '0',
            posts: '6',
            avatar: null,
            gridPhotos: [
                { id: '1', url: null, color: '#ffaaaa' },
                { id: '2', url: null, color: '#aaffaa' },
                { id: '3', url: null, color: '#aaaaff' },
                { id: '4', url: null, color: '#ffffaa' },
                { id: '5', url: null, color: '#ffaaff' },
                { id: '6', url: null, color: '#aaffff' }
            ]
        };
        const updated = [...instagramProfiles, newProfile];
        socket.emit('control:update_instagram', {
            instagramProfiles: updated,
            activeInstagramProfileId: newId
        });
    };

    const handleDeleteProfile = () => {
        if (!activeProfile || instagramProfiles.length <= 1) {
            alert("Cannot delete the last remaining profile.");
            return;
        }
        if (confirm(`Delete profile @${activeProfile.name}?`)) {
            const updated = instagramProfiles.filter(p => p.id !== activeProfile.id);
            socket.emit('control:update_instagram', {
                instagramProfiles: updated,
                activeInstagramProfileId: updated[0].id
            });
        }
    };

    // --- UPLOAD LOGIC ---
    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeProfile) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'instagram-avatar');
        formData.append('profileId', activeProfile.id);

        try {
            await axios.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch (error) {
            console.error('Avatar upload failed', error);
            alert('Upload failed');
        }
    };

    const clearAvatar = () => {
        if (activeProfile && confirm("Remove profile photo?")) {
            socket.emit('control:clear_avatar', { purpose: 'instagram-avatar', profileId: activeProfile.id });
        }
    };

    const handleGridPhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeProfile || !uploadingGridPhotoId) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'instagram-grid');
        formData.append('profileId', activeProfile.id);
        formData.append('photoId', uploadingGridPhotoId);

        try {
            await axios.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setUploadingGridPhotoId(null);
            if (gridInputRef.current) gridInputRef.current.value = '';
        } catch (error) {
            console.error('Grid photo upload failed', error);
            alert('Upload failed');
        }
    };

    const clearGridPhoto = (photoId) => {
        if (activeProfile && confirm("Remove this grid photo? (Will reset to color block)")) {
            socket.emit('control:clear_avatar', { purpose: 'instagram-grid', profileId: activeProfile.id, photoId });
        }
    };

    const addGridPhotoSlot = () => {
        if (!activeProfile) return;
        const colors = ['#ffaaaa', '#aaffaa', '#aaaaff', '#ffffaa', '#ffaaff', '#aaffff', '#facade', '#decaf0'];
        const numPhotos = activeProfile.gridPhotos.length;
        const newPhoto = {
            id: Date.now().toString(),
            url: null,
            color: colors[numPhotos % colors.length]
        };
        updateProfile({ gridPhotos: [...activeProfile.gridPhotos, newPhoto] });
    };

    const deleteGridPhotoSlot = (photoId) => {
        if (!activeProfile) return;
        if (confirm("Delete this entire photo block from the grid?")) {
            const updatedGrid = activeProfile.gridPhotos.filter(p => p.id !== photoId);
            updateProfile({ gridPhotos: updatedGrid });
        }
    };

    if (!activeProfile) return <div style={{ padding: 20 }}>No Profiles Found.</div>;

    return (
        <div className="control-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Hidden Inputs */}
            <input type="file" accept="image/*" ref={avatarInputRef} style={{ display: 'none' }} onChange={handleAvatarUpload} />
            <input type="file" accept="image/*" ref={gridInputRef} style={{ display: 'none' }} onChange={handleGridPhotoUpload} />

            {/* Profile Switcher */}
            <div className="card glass" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Active Profile:</h3>
                    <button
                        className={`control-btn ${data.activeApp === 'instagram' ? 'success' : ''}`}
                        onClick={() => socket.emit('control:switch_app', 'instagram')}
                        style={{ margin: 0, padding: '8px 15px', fontWeight: 'bold' }}
                    >
                        {data.activeApp === 'instagram' ? 'Active on Screen' : 'Show on Screen'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                        <select
                            className="input-field"
                            value={activeInstagramProfileId}
                            onChange={(e) => socket.emit('control:update_instagram', { activeInstagramProfileId: e.target.value })}
                            style={{ margin: 0, paddingRight: '40px', fontWeight: 'bold' }}
                        >
                            {instagramProfiles.map(p => (
                                <option key={p.id} value={p.id}>
                                    @{p.name} {p.id === activeInstagramProfileId ? ' ✓' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="control-btn success" onClick={handleAddProfile} style={{ margin: 0, padding: '8px 15px', display: 'flex', gap: 5, alignItems: 'center' }}>
                            <Plus size={16} /> New Profile
                        </button>
                        <button className="control-btn danger" onClick={handleDeleteProfile} disabled={instagramProfiles.length <= 1} style={{ margin: 0, padding: '8px 15px', display: 'flex', gap: 5, alignItems: 'center' }}>
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>

                {/* LEFT COLUMN: IDENTIFICATION & STATS */}
                <div>
                    <div className="card glass" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                            {/* Avatar Picker */}
                            <div style={{ position: 'relative' }}>
                                <div
                                    onClick={() => avatarInputRef.current?.click()}
                                    style={{
                                        width: '80px', height: '80px', borderRadius: '50%',
                                        background: activeProfile.avatar ? `url(${activeProfile.avatar}) center/cover` : 'linear-gradient(135deg, #e1306c, #f56040)',
                                        border: '3px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    {!activeProfile.avatar && <ImageIcon color="white" size={32} opacity={0.6} />}
                                    <div style={{ position: 'absolute', bottom: -5, right: -5, background: '#e1306c', padding: 4, borderRadius: '50%' }}>
                                        <Plus size={14} color="white" />
                                    </div>
                                </div>
                                {activeProfile.avatar && (
                                    <button onClick={clearAvatar} className="control-btn danger" style={{ position: 'absolute', top: -5, right: -5, padding: 4, borderRadius: '50%', minWidth: 'auto', margin: 0 }}>
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Names */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Username (@)</label>
                                    <input
                                        type="text" className="input-field" placeholder="username"
                                        value={activeProfile.name} onChange={(e) => updateProfile({ name: e.target.value })}
                                        style={{ margin: 0, fontWeight: 'bold' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Display Name</label>
                                    <input
                                        type="text" className="input-field" placeholder="Display Name"
                                        value={activeProfile.displayName} onChange={(e) => updateProfile({ displayName: e.target.value })}
                                        style={{ margin: 0 }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Stats inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7, textAlign: 'center', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Posts</label>
                                <input
                                    type="text" className="input-field" value={activeProfile.posts}
                                    onChange={(e) => updateProfile({ posts: e.target.value })}
                                    style={{ margin: 0, textAlign: 'center', fontWeight: 'bold', padding: '8px 4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7, textAlign: 'center', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Follower</label>
                                <input
                                    type="text" className="input-field" value={activeProfile.followers}
                                    onChange={(e) => updateProfile({ followers: e.target.value })}
                                    style={{ margin: 0, textAlign: 'center', fontWeight: 'bold', padding: '8px 4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7, textAlign: 'center', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Following</label>
                                <input
                                    type="text" className="input-field" value={activeProfile.following}
                                    onChange={(e) => updateProfile({ following: e.target.value })}
                                    style={{ margin: 0, textAlign: 'center', fontWeight: 'bold', padding: '8px 4px' }}
                                />
                            </div>
                        </div>

                        {/* Bio & Theme */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>Biography</label>
                                <textarea
                                    className="input-field"
                                    value={activeProfile.bio}
                                    onChange={(e) => updateProfile({ bio: e.target.value })}
                                    style={{ margin: 0, minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>App Background Color</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                    <input
                                        type="color"
                                        value={activeProfile.backgroundColor || '#000000'}
                                        onChange={(e) => updateProfile({ backgroundColor: e.target.value })}
                                        style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
                                    />
                                    <span style={{ fontSize: '0.9rem', opacity: 0.8, fontFamily: 'monospace' }}>{activeProfile.backgroundColor || '#000000'}</span>
                                </div>
                            </div>

                            {/* Follow Button State */}
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '6px', display: 'block' }}>Button State (Abonniert)</label>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={activeProfile.isFollowing || false}
                                        onChange={(e) => updateProfile({ isFollowing: e.target.checked })}
                                        style={{ width: '18px', height: '18px', margin: 0 }}
                                    />
                                    <span style={{ fontSize: '0.9rem' }}>Show as "Abonniert" (Following)</span>
                                </label>
                                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 4, marginBottom: 0 }}>If unchecked, the button will be blue and say "Abonnieren".</p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* RIGHT COLUMN: GRID MANAGEMENT */}
                <div className="card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0 }}>Photo Grid</h3>
                        <button className="control-btn" onClick={addGridPhotoSlot} style={{ margin: 0, padding: '5px 10px', fontSize: '0.85rem' }}>+ Add Slot</button>
                    </div>

                    {/* The Grid Editor */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px',
                        background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px'
                    }}>
                        {activeProfile.gridPhotos.map(photo => (
                            <div key={photo.id} style={{ position: 'relative', aspectRatio: '1/1' }}>
                                <div
                                    onClick={() => {
                                        setUploadingGridPhotoId(photo.id);
                                        gridInputRef.current?.click();
                                    }}
                                    style={{
                                        width: '100%', height: '100%',
                                        background: photo.url ? `url(${photo.url}) center/cover` : photo.color,
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    {!photo.url && <ImageIcon color="white" size={20} opacity={0.5} />}
                                </div>
                                {/* Actions Overlay on hover */}
                                <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2 }}>
                                    {photo.url && (
                                        <button onClick={() => clearGridPhoto(photo.id)} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white', padding: 4, cursor: 'pointer' }} title="Remove Image">
                                            <X size={12} />
                                        </button>
                                    )}
                                    <button onClick={() => deleteGridPhotoSlot(photo.id)} style={{ background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '50%', color: 'white', padding: 4, cursor: 'pointer' }} title="Delete Block">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '10px', textAlign: 'center' }}>
                        Click a square to upload a photo. Uses color blocks if empty.
                    </p>
                </div>
            </div>
        </div>
    );
}
