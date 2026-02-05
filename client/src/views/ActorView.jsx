import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Phone, Video, MoreVertical, Search, MessageCircle } from 'lucide-react';
import VirtualKeyboard from '../components/VirtualKeyboard';

export default function ActorView({ socket, data }) {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'chat'
    const [localInputValue, setLocalInputValue] = useState("");
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false); // Virtual Keyboard
    const messagesEndRef = useRef(null);
    const touchStartRef = useRef(0); // For swipe detection

    const { chats, activeChatId, actorAvatar } = data;
    const activeChat = chats.find(c => c.id === activeChatId);

    // Sync view mode with activeChatId changes (if control forces switch)
    useEffect(() => {
        // If data updates and activeChatId changes, we could auto-navigate
        // For now, let's say if activeChatId changes, we go to chat view
        if (activeChatId) {
            setViewMode('chat');
            // Force reset state with a slight delay to override any race conditions
            setTimeout(() => setIsKeyboardVisible(false), 10);
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


    // Custom Keyboard Handlers

    // Library onChange returns the FULL input string
    const handleKeyboardChange = (input) => {
        setLocalInputValue(input);
    };

    const handleVirtualSend = () => {
        if (!localInputValue.trim()) return;
        socket.emit('actor:send_message', { chatId: activeChatId, text: localInputValue });
        setLocalInputValue(""); // Clear local

        // IMPORTANT: We need to somehow clear the library's internal input buffer if we keep it open
        // Since we unmount/remount or hide, for now we just close it. 
        // If we kept it open, we'd need a ref to keyboard to call .clearInput()

        // KEEP OPEN: User requested to keep keyboard open after send
        // setIsKeyboardVisible(false); 
    };

    // Auto scroll
    useEffect(() => {
        if (viewMode === 'chat') {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
    }, [activeChat?.messages, isTyping, viewMode]);


    const handleBack = () => {
        setViewMode('list');
        setIsKeyboardVisible(false);
    };

    const handleSelectChat = (chatId) => {
        // Optimistic updat
        socket.emit('control:select_chat', chatId);
        setViewMode('chat');
        // Force reset state with a slight delay to override any race conditions
        setTimeout(() => setIsKeyboardVisible(false), 10);
    };

    // Notification State
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        const handleMsg = ({ chatId, msg }) => {
            // Only notify if we are NOT in the chat that received the message
            // OR if we are in 'list' view
            const isCurrentChat = viewMode === 'chat' && activeChatId === chatId;

            if (!isCurrentChat) {
                const chatName = chats.find(c => c.id === chatId)?.name || "New Message";
                setNotification({
                    id: Date.now(),
                    title: chatName,
                    text: msg.text,
                    color: chats.find(c => c.id === chatId)?.avatarColor
                });

                // Auto hide after 4s
                setTimeout(() => setNotification(null), 4000);
            }
        };

        socket.on('actor:receive_message', handleMsg);
        return () => socket.off('actor:receive_message', handleMsg);
    }, [viewMode, activeChatId, chats, socket]);

    // --- RENDER: CHAT LIST ---
    if (viewMode === 'list') {
        return (
            <div className="chat-screen page-transition" style={{
                height: '100dvh',
                width: '100vw',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',       // New: Flex column
                flexDirection: 'column'
            }}>
                {notification && (
                    <div
                        className="notification-banner"
                        onClick={() => {
                            const chat = chats.find(c => c.name === notification.title); // loose matching, ideally use chatId from notification
                            if (chat) handleSelectChat(chat.id);
                            setNotification(null);
                        }}
                    >
                        <div className="avatar" style={{
                            width: 40, height: 40, fontSize: '0.9rem',
                            background: (notification.chatId && chats.find(c => c.id === notification.chatId)?.avatarImage)
                                ? `url(${chats.find(c => c.id === notification.chatId).avatarImage}) center/cover no-repeat`
                                : (notification.color || 'var(--primary-gradient)')
                        }}>
                            {/* Only show initial if no image */}
                            {!(notification.chatId && chats.find(c => c.id === notification.chatId)?.avatarImage) && notification.title[0]}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{notification.title}</h4>
                            <div style={{ fontSize: '0.85rem', color: '#ccc', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                {notification.text}
                            </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Now
                        </div>
                    </div>
                )}

                <div className="chat-header glass" style={{
                    justifyContent: 'space-between',
                    height: '60px',
                    borderRadius: '24px', // Round all corners
                    margin: '10px 10px 0 10px' // Float
                }}>
                    <div className="avatar" style={{
                        width: 32, height: 32, fontSize: '0.8rem',
                        background: actorAvatar ? `url(${actorAvatar}) center/cover no-repeat` : 'var(--primary-gradient)'
                    }}>
                        {!actorAvatar && "Me"}
                    </div>
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

                {/* Scrollable List Container */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    position: 'relative'
                }}>
                    {/* Inner wrapper forcing min-height for elastic scroll */}
                    <div className="chat-messages" style={{
                        padding: 0,
                        gap: 0,
                        minHeight: 'calc(100% + 1px)' // FORCE SCROLL
                    }}>
                        {chats.map(chat => {
                            const lastMsg = chat.messages[chat.messages.length - 1];
                            const preview = lastMsg ? (lastMsg.system ? "New Match!" : lastMsg.text) : "No messages yet";

                            return (
                                <div
                                    key={chat.id}
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent bubbling
                                        handleSelectChat(chat.id);
                                    }}
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
                                        background: chat.avatarImage ? `url(${chat.avatarImage}) center/cover no-repeat` : (chat.avatarColor || 'var(--primary-gradient)'),
                                        width: 55, height: 55
                                    }}>
                                        {!chat.avatarImage && chat.name[0]}
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
                </div>

                {/* Navigation Bar Mockup */}
                <div className="glass" style={{
                    padding: '15px',
                    display: 'flex',
                    justifyContent: 'space-around',
                    paddingBottom: 'max(15px, env(safe-area-inset-bottom))',
                    marginTop: 'auto' // ensure it pushes down if slightly short
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

    // Calculate bottom offset for input
    const keyboardHeight = '280px';
    // Base bottom offset to avoid rounded corners when KB is closed
    const safeBottom = '25px';

    return (
        <div className="chat-screen page-transition" style={{
            height: '100dvh',
            width: '100vw',
            overflow: 'hidden',
            position: 'relative' // Ensure relative context
        }}>
            {/* Notifications (Absolute Top) */}
            {notification && (
                <div
                    className="notification-banner"
                    onClick={() => {
                        const chat = chats.find(c => c.name === notification.title);
                        if (chat) {
                            socket.emit('control:select_chat', chat.id);
                            setViewMode('chat');
                            setIsKeyboardVisible(false);
                        }
                        setNotification(null);
                    }}
                    style={{ zIndex: 3000 }} // Ensure above everything
                >
                    <div className="avatar" style={{
                        width: 40, height: 40, fontSize: '0.9rem',
                        background: (notification.chatId && chats.find(c => c.id === notification.chatId)?.avatarImage)
                            ? `url(${chats.find(c => c.id === notification.chatId).avatarImage}) center/cover no-repeat`
                            : (notification.color || 'var(--primary-gradient)')
                    }}>
                        {!(notification.chatId && chats.find(c => c.id === notification.chatId)?.avatarImage) && notification.title[0]}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{notification.title}</h4>
                        <div style={{ fontSize: '0.85rem', color: '#ccc', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            {notification.text}
                        </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Now
                    </div>
                </div>
            )}

            {/* Header (Fixed at Top) */}
            <div className="chat-header glass" style={{
                zIndex: 200,
                position: 'relative',
                borderRadius: '24px', // Round all corners as requested
                margin: '10px 10px 0 10px', // Float
                borderBottom: '1px solid var(--glass-border)'
            }}>
                <div onClick={handleBack} style={{ cursor: 'pointer' }}>
                    <ChevronLeft color="white" size={28} />
                </div>
                <div className="avatar" style={{
                    background: activeChat.avatarImage ? `url(${activeChat.avatarImage}) center/cover no-repeat` : activeChat.avatarColor
                }}>
                    {!activeChat.avatarImage && activeChat.name[0]}
                </div>
                <div className="header-info" style={{ flex: 1 }}>
                    <h2>{activeChat.name}</h2>
                    <span style={{ color: activeChat.statusColor || 'gray' }}>{activeChat.status || "Online recently"}</span>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <Phone size={20} color="white" />
                    <Video size={20} color="white" />
                </div>
            </div>

            {/* Content Mask (Crops the sliding content) */}
            <div style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Unified Sliding Wrapper */}
                <div
                    className="sliding-wrapper"
                    style={{
                        // HEIGHT FIX: Strictly match viewport
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative', // Ensure absolute child positions relative to this
                        // Slide the entire container up by Keyboard Height + Keyboard Bottom Margin (280 + 30 + safe area approx)
                        // Using -320px to be safe and lift it nicely
                        transform: isKeyboardVisible ? 'translateY(-320px)' : 'none',
                        transition: 'transform 0.8s cubic-bezier(0.32, 0.72, 0, 1)',
                        willChange: 'transform'
                    }}
                    // SWIPE LOGIC: Swipe DOWN to close keyboard
                    onTouchStart={(e) => {
                        touchStartRef.current = e.changedTouches[0].clientY;
                    }}
                    onTouchEnd={(e) => {
                        const touchEndY = e.changedTouches[0].clientY;
                        const deltaY = touchEndY - (touchStartRef.current || 0);
                        // If swiped down (> 30px) and keyboard is open, close it
                        if (deltaY > 30 && isKeyboardVisible) {
                            setIsKeyboardVisible(false);
                        }
                    }}
                    onClick={() => {
                        // Close on backdrop click (if keyboard doesn't catch it)
                        if (isKeyboardVisible) setIsKeyboardVisible(false);
                    }}
                >
                    {/* Messages Area */}
                    <div
                        className="chat-messages"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            // SCROLL FIX: Force scrollbar and touch behavior
                            overflowY: 'scroll',
                            WebkitOverflowScrolling: 'touch',
                            paddingBottom: '0px',
                        }}
                    >
                        {/* SCROLL WRAPPER: Ensures content is always > 100% height to allow "Rubber Banding" */}
                        <div style={{
                            minHeight: 'calc(100% + 1px)',
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            width: '100%',
                            gap: '15px', // Increase message spacing
                            paddingTop: '10px',
                            paddingBottom: '20px',
                        }}>
                            {/* Top Spacer: Pushes content DOWN when keyboard is OPEN */}
                            <div style={{
                                flexGrow: isKeyboardVisible ? 1 : 0,
                                minHeight: 0,
                                transition: 'flex-grow 0.8s cubic-bezier(0.32, 0.72, 0, 1)'
                            }} />

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

                            {/* Bottom Spacer: Pushes content UP when keyboard is CLOSED */}
                            <div style={{
                                flexGrow: isKeyboardVisible ? 0 : 1,
                                minHeight: 0,
                                transition: 'flex-grow 0.8s cubic-bezier(0.32, 0.72, 0, 1)'
                            }} />

                            <div ref={messagesEndRef} style={{ height: 1, width: '100%', minHeight: '1px' }} />
                        </div>
                    </div>

                    {/* Input Area (Flow, attached to keyboard) */}
                    <div
                        className="glass chat-input-area"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsKeyboardVisible(true);
                        }}
                        style={{
                            position: 'relative',
                            flexShrink: 0,
                            zIndex: 10,

                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            paddingBottom: '10px',
                            width: 'calc(100% - 20px)', // Reduce width for float
                            margin: '0 10px 30px 10px', // Lift input up (30px bottom)
                            borderRadius: '24px', // Rounded corners
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: '15px',
                            paddingRight: '15px'
                        }}
                    >
                        <div
                            className="chat-input-field"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                color: localInputValue ? 'white' : 'white',
                                cursor: 'text',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                width: '100%',
                                background: 'transparent',
                                minHeight: '40px'
                            }}
                        >
                            {localInputValue ? (
                                <span style={{ whiteSpace: 'pre-wrap' }}>{localInputValue}</span>
                            ) : (
                                <span style={{ opacity: 0.5 }}>Type a message...</span>
                            )}
                            {isKeyboardVisible && <div className="cursor-blink"></div>}
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); handleVirtualSend(); }}
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
                                padding: 0,
                                marginLeft: '10px',
                                flexShrink: 0
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>

                    {/* Keyboard (Absolute position below wrapper) */}
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        width: '100%',
                        // DISPLAY FIX: Remove from DOM tree entirely when closed to prevent layout ghosts
                        display: isKeyboardVisible ? 'block' : 'none',
                    }}>
                        <VirtualKeyboard
                            isActive={isKeyboardVisible}
                            value={localInputValue} // Pass controlled value
                            onChange={handleKeyboardChange}
                            onSend={handleVirtualSend}
                        />
                    </div>
                </div>
            </div>

            <style>{`
          @keyframes blink { 
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
          }
          .cursor-blink {
              display: inline-block;
              width: 2px;
              height: 1.2rem;
              background: #007AFF;
              margin-left: 2px;
              animation: blink 1s infinite;
          }
          
          .page-transition {
              flex: 1;
              display: flex;
              flex-direction: column;
              height: 100%;
              animation: fadeSlideIn 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards;
          }
          
          @keyframes fadeSlideIn {
              from { opacity: 0; }
              to { opacity: 1; }
          }
      `}</style>
        </div>
    );
}
