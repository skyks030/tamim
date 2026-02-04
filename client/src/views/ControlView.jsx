import { useState, useEffect } from 'react';
import { Plus, Edit2, Save, Send, Trash2, RefreshCw, MessageSquare } from 'lucide-react';

export default function ControlView({ socket, data }) {
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [newChatName, setNewChatName] = useState("");
    const [renameValue, setRenameValue] = useState("");
    const [customPresetValue, setCustomPresetValue] = useState("");

    const { chats, activeChatId } = data;
    const selectedChat = chats.find(c => c.id === selectedChatId);

    // Default to active chat if none selected locally
    useEffect(() => {
        if (!selectedChatId && activeChatId) {
            setSelectedChatId(activeChatId);
        }
    }, [activeChatId]);

    // Update rename value when chat changes
    useEffect(() => {
        if (selectedChat) {
            setRenameValue(selectedChat.name);
        }
    }, [selectedChat]);


    const handleCreateChat = () => {
        socket.emit('control:create_chat', newChatName);
        setNewChatName("");
    };

    const handleSelectActive = (chatId) => {
        socket.emit('control:select_chat', chatId);
    };

    const handleUpdateName = () => {
        if (selectedChat && renameValue.trim()) {
            socket.emit('control:update_chat', { chatId: selectedChat.id, name: renameValue });
        }
    };

    const handleAddPreset = () => {
        if (selectedChat && customPresetValue.trim()) {
            socket.emit('control:save_preset', { chatId: selectedChat.id, text: customPresetValue });
            setCustomPresetValue("");
        }
    };

    // Actions
    const sendTyping = () => socket.emit('control:typing_start', selectedChatId);
    const sendMessage = (text, sender = 'match') => socket.emit('control:send_message', { chatId: selectedChatId, text, sender });
    const resetScene = () => socket.emit('control:reset', selectedChatId);
    const clearChat = () => socket.emit('control:clear', selectedChatId);


    return (
        <div className="control-panel" style={{ maxWidth: '900px' }}>

            {/* Header / Connection Status */}
            <div className="glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ marginTop: 0, marginBottom: 0 }}>Control App (Spiegelhandy)</h2>
                <div style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: socket.connected ? '#10b981' : '#ef4444',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                }}>
                    {socket.connected ? 'CONNECTED' : 'DISCONNECTED'}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>

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
                                    <div className="avatar" style={{ width: 24, height: 24, fontSize: '0.7rem', background: chat.avatarColor }}>
                                        {chat.name[0]}
                                    </div>
                                    <span>{chat.name}</span>
                                </div>
                                {activeChatId === chat.id && <span style={{ fontSize: '0.7rem', color: '#10b981' }}>ACTIVE</span>}
                            </div>
                        ))}
                    </div>
                </div>


                {/* MAIN: SELECTED CHAT CONTROLS */}
                <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
                    {selectedChat ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 15 }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <input
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        style={{ background: 'transparent', border: '1px solid #444', color: 'white', padding: 5, borderRadius: 4, fontSize: '1.2rem' }}
                                    />
                                    <button className="control-btn" style={{ width: 'auto', marginBottom: 0, padding: 8 }} onClick={handleUpdateName}>
                                        <Save size={16} />
                                    </button>
                                </div>

                                <button
                                    className={`control-btn ${activeChatId === selectedChat.id ? 'primary' : ''}`}
                                    style={{ width: 'auto', marginBottom: 0 }}
                                    onClick={() => handleSelectActive(selectedChat.id)}
                                    disabled={activeChatId === selectedChat.id}
                                >
                                    {activeChatId === selectedChat.id ? 'Currently Active on Screen' : 'Set Active on Screen'}
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                {/* LEFT: ACTIONS */}
                                <div>
                                    <h4>Scene Actions</h4>
                                    <button className="control-btn" onClick={sendTyping}>
                                        <MessageSquare size={16} style={{ marginRight: 8 }} />
                                        Trigger Typing (3s)
                                    </button>
                                    <button className="control-btn danger" onClick={clearChat}>
                                        <Trash2 size={16} style={{ marginRight: 8 }} />
                                        Clear Messages
                                    </button>
                                    <button className="control-btn danger" onClick={resetScene}>
                                        <RefreshCw size={16} style={{ marginRight: 8 }} />
                                        Full Reset
                                    </button>
                                </div>

                                {/* RIGHT: PRESETS */}
                                <div>
                                    <h4>Message Presets</h4>
                                    <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                                        <input
                                            className="chat-input-field"
                                            style={{ height: 36, fontSize: '0.9rem', borderRadius: 8 }}
                                            placeholder="Add custom preset..."
                                            value={customPresetValue}
                                            onChange={e => setCustomPresetValue(e.target.value)}
                                        />
                                        <button className="control-btn" style={{ width: 'auto', marginBottom: 0, padding: '0 10px' }} onClick={handleAddPreset}>
                                            <Plus size={16} />
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '300px', overflowY: 'auto' }}>
                                        {selectedChat.presets?.map((text, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: 5 }}>
                                                <button
                                                    className="control-btn primary"
                                                    style={{ marginBottom: 0, padding: '8px 12px', textAlign: 'left', fontSize: '0.9rem' }}
                                                    onClick={() => sendMessage(text)}
                                                >
                                                    <Send size={14} style={{ marginRight: 8 }} />
                                                    {text}
                                                </button>
                                            </div>
                                        ))}
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
        </div>
    );
}
