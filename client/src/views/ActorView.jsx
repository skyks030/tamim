import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Phone, Video, MoreVertical, Search, MessageCircle } from 'lucide-react';

export default function ActorView({ socket, data }) {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'chat'
    const [localInputValue, setLocalInputValue] = useState("");
    const messagesEndRef = useRef(null);

    const { chats, activeChatId } = data;
    const activeChat = chats.find(c => c.id === activeChatId);

    // Sync view mode with activeChatId changes (if control forces switch)
    useEffect(() => {
        // If data updates and activeChatId changes, we could auto-navigate
        // For now, let's say if activeChatId changes, we go to chat view
        if (activeChatId) {
            setViewMode('chat');
        }
    }, [activeChatId]);

    // Socket listeners for specific UI events (typing)
    const [isTyping, setIsTyping] = useState(false);
    useEffect(() => {
        const handleTyping = (chatId) => {
            if (chatId === activeChatId) {
                setIsTyping(true);
                setTimeout(() => setIsTyping(false), 3000);
            }
        };
        socket.on('actor:typing_start', handleTyping);
        return () => socket.off('actor:typing_start', handleTyping);
    }, [activeChatId, socket]);


    // Auto scroll
    useEffect(() => {
        if (viewMode === 'chat') {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [activeChat?.messages, isTyping, viewMode]);


    const handleSend = (e) => {
        e.preventDefault();
        if (!localInputValue.trim()) return;
        socket.emit('actor:send_message', { chatId: activeChatId, text: localInputValue });
        setLocalInputValue("");
    };

    const handleBack = () => {
        setViewMode('list');
        // Optionally tell server we went back? Not strictly needed unless we want to clear activeChatId
    };

    const handleSelectChat = (chatId) => {
        // Optimistic updat
        socket.emit('control:select_chat', chatId);
        setViewMode('chat');
    };

    // --- RENDER: CHAT LIST ---
    if (viewMode === 'list') {
        return (
            <div className="chat-screen">
                <div className="chat-header glass" style={{ justifyContent: 'space-between', height: '60px' }}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>Me</div>
                    <h2 style={{ fontSize: '1.2rem' }}>Chats</h2>
                    <MoreVertical color="white" size={20} />
                </div>

                <div style={{ padding: '15px' }}>
                    <div className="glass" style={{
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '12px',
                        color: 'var(--text-secondary)'
                    }}>
                        <Search size={18} style={{ marginRight: 10 }} />
                        <span>Search matches...</span>
                    </div>
                </div>

                <div className="chat-messages" style={{ padding: 0, gap: 0 }}>
                    {chats.map(chat => {
                        const lastMsg = chat.messages[chat.messages.length - 1];
                        const preview = lastMsg ? (lastMsg.system ? "New Match!" : lastMsg.text) : "No messages yet";

                        return (
                            <div
                                key={chat.id}
                                onClick={() => handleSelectChat(chat.id)}
                                className="fade-in-up"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '15px 20px',
                                    gap: '15px',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div className="avatar" style={{
                                    background: chat.avatarColor || 'var(--primary-gradient)',
                                    width: 55, height: 55
                                }}>
                                    {chat.name[0]}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem' }}>{chat.name}</h3>
                                        <span style={{ fontSize: '0.75rem', color: '#666' }}>Now</span>
                                    </div>
                                    <div style={{
                                        fontSize: '0.9rem',
                                        color: 'var(--text-secondary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '200px'
                                    }}>
                                        {preview}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Navigation Bar Mockup */}
                <div className="glass" style={{
                    padding: '15px',
                    display: 'flex',
                    justifyContent: 'space-around',
                    paddingBottom: 'max(15px, env(safe-area-inset-bottom))'
                }}>
                    <div style={{ opacity: 0.5 }}><div style={{ width: 24, height: 24, border: '2px solid white', borderRadius: 6 }}></div></div>
                    <div style={{ color: '#FF6B6B' }}><MessageCircle size={28} fill="#FF6B6B" /></div>
                    <div style={{ opacity: 0.5 }}><div style={{ width: 24, height: 24, border: '2px solid white', borderRadius: '50%' }}></div></div>
                </div>
            </div>
        );
    }

    // --- RENDER: ACTIVE CHAT ---
    if (!activeChat) return <div>Select a chat...</div>; // Should not happen often

    return (
        <div className="chat-screen">
            {/* Header */}
            <div className="chat-header glass">
                <div onClick={handleBack} style={{ cursor: 'pointer' }}>
                    <ChevronLeft color="white" size={28} />
                </div>
                <div className="avatar" style={{ background: activeChat.avatarColor }}>
                    {activeChat.name[0]}
                </div>
                <div className="header-info" style={{ flex: 1 }}>
                    <h2>{activeChat.name}</h2>
                    <span>Online recently</span>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <Phone size={20} color="white" />
                    <Video size={20} color="white" />
                </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {activeChat.messages.map((msg, index) => {
                    if (msg.system) {
                        return (
                            <div key={msg.id} style={{
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                margin: '10px 0'
                            }}>
                                {msg.text}
                            </div>
                        );
                    }
                    return (
                        <div
                            key={msg.id}
                            className={`message ${msg.sender} fade-in-up`}
                        >
                            {msg.text}
                        </div>
                    );
                })}

                {isTyping && (
                    <div className="typing-indicator fade-in-up">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
                onSubmit={handleSend}
                className="glass chat-input-area"
            >
                <input
                    type="text"
                    value={localInputValue}
                    onChange={(e) => setLocalInputValue(e.target.value)}
                    placeholder="Type a message..."
                    className="chat-input-field"
                />
                <button
                    type="submit"
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--message-me-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </form>
        </div>
    );
}
