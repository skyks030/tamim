import { useState, useEffect } from 'react';
import { Plus, Edit2, Save, Send, Trash2, RefreshCw, MessageSquare } from 'lucide-react';
import axios from 'axios';

export default function MessengerControl({ socket, data }) {
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [newChatName, setNewChatName] = useState("");
    const [customPresetValue, setCustomPresetValue] = useState("");
    const [scenarioName, setScenarioName] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPercent, setUploadPercent] = useState(0);

    // Temp state for new status
    const [newStatusText, setNewStatusText] = useState("");
    const [newStatusColor, setNewStatusColor] = useState("gray");

    const { chats, activeChatId, statusPresets, actorAvatar } = data; // Get global presets & actor avatar
    const selectedChat = chats.find(c => c.id === selectedChatId);

    // Default to active chat if none selected locally
    useEffect(() => {
        if (!selectedChatId && activeChatId) {
            setSelectedChatId(activeChatId);
        }
    }, [activeChatId]);

    const handleCreateChat = () => {
        socket.emit('control:create_chat', newChatName);
        setNewChatName("");
    };

    const handleSelectActive = (chatId) => {
        socket.emit('control:select_chat', chatId);
    };

    const handleUpdateName = (newName) => {
        if (selectedChat && newName.trim()) {
            socket.emit('control:update_chat', { chatId: selectedChat.id, name: newName });
        }
    };

    const handleUpdateMatchMessage = (newMessage) => {
        if (selectedChat && newMessage.trim()) {
            socket.emit('control:update_match_message', { chatId: selectedChat.id, message: newMessage });
        }
    };

    const handleDeleteChat = (chatId) => {
        const chat = chats.find(c => c.id === chatId);
        if (chat && confirm(`Delete chat "${chat.name}"?`)) {
            socket.emit('control:delete_chat', chatId);
            if (selectedChatId === chatId) setSelectedChatId(null);
        }
    };

    const handleSetStatus = (text, color) => {
        if (selectedChat) {
            socket.emit('control:set_status', { chatId: selectedChat.id, text, color });
        }
    };

    const handleAddStatusPreset = () => {
        if (newStatusText.trim()) {
            socket.emit('control:add_status_preset', { text: newStatusText, color: newStatusColor });
            setNewStatusText("");
        }
    };

    const handleDeleteStatusPreset = (id) => {
        if (confirm("Delete status preset?")) {
            socket.emit('control:delete_status_preset', id);
        }
    };

    const handleUpload = async (e, purpose) => {
        const file = e.target.files[0];
        if (file) {
            setIsUploading(true);
            setUploadPercent(0);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('purpose', purpose);
            if (purpose === 'chat' && selectedChatId) {
                formData.append('chatId', selectedChatId);
            }

            try {
                await axios.post('/api/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadPercent(percent);
                    }
                });
            } catch (err) {
                console.error("Upload failed", err);
                alert("Upload failed. Check console.");
            } finally {
                setIsUploading(false);
                setUploadPercent(0);
                e.target.value = null; // Reset input
            }
        }
    };

    const handleClearAvatar = (purpose) => {
        if (confirm("Reset profile picture to default?")) {
            socket.emit('control:clear_avatar', { purpose, chatId: selectedChatId });
        }
    };

    const handleAddPreset = (sender = 'match') => {
        if (selectedChat && customPresetValue.trim()) {
            socket.emit('control:save_preset', { chatId: selectedChat.id, text: customPresetValue, sender });
            setCustomPresetValue("");
        }
    };

    const handleDeletePreset = (presetId) => {
        if (confirm("Delete this preset?")) {
            socket.emit('control:delete_preset', { chatId: selectedChat.id, presetId });
        }
    };

    const handleSaveScenario = () => {
        if (selectedChat && scenarioName.trim()) {
            socket.emit('control:save_scenario', { chatId: selectedChat.id, name: scenarioName });
            setScenarioName("");
        }
    };

    const handleLoadScenario = (scenarioId) => {
        if (confirm("This will overwrite current messages. Continue?")) {
            socket.emit('control:load_scenario', { chatId: selectedChat.id, scenarioId });
        }
    };

    const handleDeleteScenario = (scenarioId) => {
        if (confirm("Delete this backup?")) {
            socket.emit('control:delete_scenario', { chatId: selectedChat.id, scenarioId });
        }
    };

    // Actions
    const sendTyping = () => socket.emit('control:typing_start', selectedChatId);
    const sendMessage = (text, sender = 'match') => socket.emit('control:send_message', { chatId: selectedChatId, text, sender });
    const clearChat = () => {
        if (confirm("DELETE ALL MESSAGES? This cannot be undone.")) {
            socket.emit('control:clear', selectedChatId);
        }
    };

    return (
        <>
            {/* UPLOAD PROGRESS OVERLAY */}
            {isUploading && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    <div className="glass" style={{ padding: 30, borderRadius: 20, width: 300, textAlign: 'center' }}>
                        <h3 style={{ marginTop: 0 }}>Uploading Image...</h3>
                        <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden', marginTop: 15 }}>
                            <div style={{
                                width: `${uploadPercent}%`,
                                height: '100%',
                                background: '#10b981',
                                transition: 'width 0.2s ease'
                            }} />
                        </div>
                        <div style={{ marginTop: 10, fontSize: '0.9rem', color: '#ccc' }}>{uploadPercent}%</div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>

                {/* --- THEME EDITOR --- */}
                <div className="control-panel">
                    <h3>Messenger Theme</h3>
                    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: '0.8rem', color: '#888' }}>Primary Color</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input
                                    type="color"
                                    value={data.messengerTheme?.primary || "#007AFF"}
                                    onChange={(e) => socket.emit('control:update_messenger_theme', { primary: e.target.value })}
                                    style={{ border: 'none', width: 40, height: 40, cursor: 'pointer', background: 'none' }}
                                />
                                <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{data.messengerTheme?.primary}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: '0.8rem', color: '#888' }}>Background</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input
                                    type="color"
                                    value={data.messengerTheme?.background || "#000000"}
                                    onChange={(e) => socket.emit('control:update_messenger_theme', { background: e.target.value })}
                                    style={{ border: 'none', width: 40, height: 40, cursor: 'pointer', background: 'none' }}
                                />
                                <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{data.messengerTheme?.background}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SIDEBAR: CHAT LIST */}
                <div className="glass" style={{ padding: '15px', borderRadius: '16px', height: 'fit-content' }}>
                    <h3 style={{ marginTop: 0 }}>Chats</h3>

                    <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
                        <input
                            className="chat-input-field"
                            style={{ height: 36, fontSize: '0.9rem', borderRadius: 8 }}
                            placeholder="New person name..."
                            value={newChatName}
                            onChange={e => setNewChatName(e.target.value)}
                        />
                        <button className="control-btn primary" style={{ width: 'auto', marginBottom: 0, padding: '0 10px' }} onClick={handleCreateChat}>
                            <Plus size={18} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => setSelectedChatId(chat.id)}
                                style={{
                                    padding: '10px',
                                    background: selectedChatId === chat.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    border: '1px solid transparent',
                                    borderColor: selectedChatId === chat.id ? 'var(--glass-border)' : 'transparent',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div className="avatar" style={{
                                        width: 24, height: 24, fontSize: '0.7rem',
                                        background: chat.avatarImage ? `url(${chat.avatarImage}) center/cover no-repeat` : chat.avatarColor
                                    }}>
                                        {!chat.avatarImage && chat.name[0]}
                                    </div>
                                    <span>{chat.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    {activeChatId === chat.id && <span style={{ fontSize: '0.7rem', color: '#10b981' }}>ACTIVE</span>}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#666',
                                            cursor: 'pointer',
                                            padding: 4,
                                            opacity: 0.6
                                        }}
                                        className="hover-danger"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* MAIN: SELECTED CHAT CONTROLS */}
                <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
                    {selectedChat ? (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 15 }}>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, paddingRight: 20 }}>
                                        {/* Name Editor */}
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#888', width: 80 }}>Chat Name:</span>
                                            <input
                                                value={selectedChat.name}
                                                onChange={e => handleUpdateName(e.target.value)}
                                                style={{ background: 'transparent', border: '1px solid #444', color: 'white', padding: 5, borderRadius: 4, fontSize: '1.1rem', flex: 1 }}
                                            />
                                        </div>
                                        {/* Match Message Editor */}
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#888', width: 80 }}>Welcome:</span>
                                            <input
                                                value={selectedChat.matchMessage || ""}
                                                onChange={e => handleUpdateMatchMessage(e.target.value)}
                                                style={{ background: 'transparent', border: '1px solid #444', color: 'var(--text-secondary)', padding: 5, borderRadius: 4, fontSize: '0.9rem', flex: 1 }}
                                            />
                                        </div>
                                        {/* Chat Avatar Upload */}
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 5 }}>
                                            <span style={{ fontSize: '0.8rem', color: '#888', width: 80 }}>Photo:</span>
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                <div className="avatar" style={{ width: 30, height: 30, fontSize: '0.7rem', background: selectedChat.avatarImage ? `url(${selectedChat.avatarImage}) center/cover no-repeat` : selectedChat.avatarColor }}>
                                                    {!selectedChat.avatarImage && selectedChat.name[0]}
                                                </div>
                                                <label className="control-btn secondary" style={{ marginBottom: 0, padding: '4px 8px', fontSize: '0.8rem', width: 'auto', cursor: 'pointer' }}>
                                                    Upload
                                                    <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUpload(e, 'chat')} />
                                                </label>
                                                {selectedChat.avatarImage && (
                                                    <button className="control-btn danger" style={{ width: 'auto', marginBottom: 0, padding: 4 }} onClick={() => handleClearAvatar('chat')}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        className={`control-btn ${activeChatId === selectedChat.id ? 'primary' : ''}`}
                                        style={{ width: 'auto', marginBottom: 0, height: 'fit-content' }}
                                        onClick={() => handleSelectActive(selectedChat.id)}
                                        disabled={activeChatId === selectedChat.id}
                                    >
                                        {activeChatId === selectedChat.id ? 'Active on Screen' : 'Set Active'}
                                    </button>

                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                                {/* LEFT COLUMN */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                    {/* ACTIONS */}
                                    <div className="glass-panel" style={{ padding: 15, background: 'rgba(0,0,0,0.2)' }}>
                                        <h4 style={{ marginTop: 0 }}>Live Controls</h4>
                                        <button className="control-btn" onClick={sendTyping}>
                                            <MessageSquare size={16} style={{ marginRight: 8 }} />
                                            Trigger Typing (3s)
                                        </button>
                                        <button className="control-btn danger" onClick={clearChat} style={{ marginTop: 10 }}>
                                            <Trash2 size={16} style={{ marginRight: 8 }} />
                                            DELETE ALL MESSAGES
                                        </button>
                                    </div>

                                    {/* STATUS MANAGEMENT */}
                                    <div className="glass-panel" style={{ padding: 15, background: 'rgba(0,0,0,0.2)' }}>
                                        <h4 style={{ marginTop: 0 }}>Online Status</h4>
                                        {/* Current Status Display */}
                                        <div style={{ marginBottom: 10, fontSize: '0.9rem' }}>
                                            Current: <span style={{ color: selectedChat.statusColor || 'gray', fontWeight: 'bold' }}>{selectedChat.status || "Default"}</span>
                                        </div>

                                        {/* Presets List */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 15 }}>
                                            {(statusPresets || []).map(preset => (
                                                <div key={preset.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingRight: 5 }}>
                                                    <button
                                                        className="control-btn"
                                                        style={{
                                                            marginBottom: 0, padding: '5px 10px', borderRadius: 20,
                                                            background: 'transparent',
                                                            color: preset.color,
                                                            border: 'none'
                                                        }}
                                                        onClick={() => handleSetStatus(preset.text, preset.color)}
                                                    >
                                                        {preset.text}
                                                    </button>
                                                    <div
                                                        style={{ cursor: 'pointer', opacity: 0.5, padding: 2 }}
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteStatusPreset(preset.id); }}
                                                    >
                                                        <Trash2 size={10} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add New Status */}
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <input
                                                placeholder="New Status..."
                                                value={newStatusText}
                                                onChange={e => setNewStatusText(e.target.value)}
                                                className="chat-input-field"
                                                style={{ height: 30, fontSize: '0.8rem', borderRadius: 6, flex: 1 }}
                                            />
                                            <select
                                                value={newStatusColor}
                                                onChange={e => setNewStatusColor(e.target.value)}
                                                style={{ background: '#333', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8rem' }}
                                            >
                                                <option value="gray">Gray</option>
                                                <option value="#4ade80">Green</option>
                                                <option value="#ef4444">Red</option>
                                                <option value="#60a5fa">Blue</option>
                                            </select>
                                            <button className="control-btn secondary" style={{ width: 'auto', marginBottom: 0, padding: '0 8px' }} onClick={handleAddStatusPreset}>
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ACTOR PROFILE (SELF) */}
                                    <div className="glass-panel" style={{ padding: 15, background: 'rgba(0,0,0,0.2)' }}>
                                        <h4 style={{ marginTop: 0 }}>My Profile (Actor)</h4>
                                        <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                                            {/* Avatar Preview */}
                                            <div className="avatar" style={{
                                                width: 50, height: 50,
                                                fontSize: '0.8rem',
                                                background: actorAvatar ? `url(${actorAvatar}) center/cover no-repeat` : 'var(--primary-gradient)'
                                            }}>
                                                {!actorAvatar && "Me"}
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                <label className="control-btn primary" style={{ marginBottom: 0, padding: '6px 12px', fontSize: '0.8rem', width: 'auto', cursor: 'pointer' }}>
                                                    Upload New
                                                    <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleUpload(e, 'actor')} />
                                                </label>
                                                {actorAvatar && (
                                                    <button
                                                        className="control-btn danger"
                                                        style={{ width: 'auto', marginBottom: 0, padding: '4px 10px', fontSize: '0.8rem' }}
                                                        onClick={() => handleClearAvatar('actor')}>
                                                        Remove Photo
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>



                                </div>

                                {/* RIGHT COLUMN: PRESETS */}
                                <div className="glass-panel" style={{ padding: 15, background: 'rgba(0,0,0,0.2)' }}>
                                    <h4 style={{ marginTop: 0 }}>Message Presets</h4>

                                    <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                        <input
                                            className="chat-input-field"
                                            style={{ height: 36, fontSize: '0.9rem', borderRadius: 8 }}
                                            placeholder="Add preset message..."
                                            value={customPresetValue}
                                            onChange={e => setCustomPresetValue(e.target.value)}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
                                        <button className="control-btn secondary" style={{ marginBottom: 0, fontSize: '0.8rem' }} onClick={() => handleAddPreset('match')}>
                                            + as Match
                                        </button>
                                        <button className="control-btn secondary" style={{ marginBottom: 0, fontSize: '0.8rem' }} onClick={() => handleAddPreset('me')}>
                                            + as Actor
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '400px', overflowY: 'auto' }}>
                                        {selectedChat.presets?.map((preset, idx) => {
                                            // Handle legacy string presets temporarily
                                            const isObj = typeof preset === 'object';
                                            const text = isObj ? preset.text : preset;
                                            const sender = isObj ? preset.sender : 'match';
                                            const id = isObj ? preset.id : `legacy-${idx}`;

                                            // Ensure we don't break if id is missing in legacy
                                            return (
                                                <div key={id} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                                    <div style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        gap: 5,
                                                        flexDirection: sender === 'me' ? 'row-reverse' : 'row'
                                                    }}>
                                                        <button
                                                            className={`control-btn ${sender === 'me' ? 'secondary' : 'primary'}`}
                                                            style={{
                                                                marginBottom: 0,
                                                                padding: '8px 12px',
                                                                textAlign: 'left',
                                                                fontSize: '0.9rem',
                                                                flex: 1,
                                                                opacity: 0.9
                                                            }}
                                                            onClick={() => sendMessage(text, sender)}
                                                        >
                                                            {sender === 'me' ? '👤 ' : '❤️ '}
                                                            {text}
                                                        </button>
                                                        {isObj && (
                                                            <button
                                                                className="control-btn secondary"
                                                                style={{ width: 'auto', marginBottom: 0, padding: 8 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newText = prompt("Edit preset text:", text);
                                                                    if (newText && newText.trim()) {
                                                                        socket.emit('control:update_preset', { chatId: selectedChat.id, presetId: id, text: newText.trim() });
                                                                    }
                                                                }}
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <button
                                                        className="control-btn danger"
                                                        style={{ width: 'auto', marginBottom: 0, padding: 8 }}
                                                        onClick={() => handleDeletePreset(id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#666' }}>
                            Select a chat to control
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}
