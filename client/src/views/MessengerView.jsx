import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Phone, Video, MoreVertical, Search, MessageCircle, Mic, Play, Trash2, MapPin } from 'lucide-react';
import VirtualKeyboard from '../components/VirtualKeyboard';

export default function MessengerView({ socket, data }) {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'chat'
    const [localInputValue, setLocalInputValue] = useState("");
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false); // Virtual Keyboard
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const touchStartRef = useRef(0); // For swipe detection

    const { chats, activeChatId, actorAvatar } = data;
    const theme = data.messengerTheme || { primary: "#007AFF", background: "#000000", text: "#FFFFFF" };
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

    // Sync Meta Theme Color & Body Background for Notch/Overscroll support
    useEffect(() => {
        const bg = theme.background || '#000000';
        document.body.style.backgroundColor = bg;
        document.documentElement.style.backgroundColor = bg;

        const metaThemeColor = document.querySelector("meta[name='theme-color']");
        if (metaThemeColor) metaThemeColor.setAttribute("content", bg);
    }, [theme]);

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
        if (isRecording) {
            socket.emit('actor:send_message', { chatId: activeChatId, text: `[[VOICE::${recordingTime}]]` });
            setIsRecording(false);
            setRecordingTime(0);
            return;
        }
        if (!localInputValue.trim()) return;
        socket.emit('actor:send_message', { chatId: activeChatId, text: localInputValue });
        setLocalInputValue(""); // Clear local
    };

    const handleMicClick = (e) => {
        e.stopPropagation();
        if (isRecording) {
            handleVirtualSend(); // Stop and Send
        } else {
            setIsRecording(true);
            setRecordingTime(0);
            setIsKeyboardVisible(false); // Hide keyboard when recording voice
        }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Recording Timer
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            setRecordingTime(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // Auto scroll when messages change or typing status changes
    useEffect(() => {
        if (viewMode === 'chat') {
            let shouldScroll = true;
            if (scrollContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                const distance = scrollHeight - scrollTop - clientHeight;
                // Increased threshold to 300px to account for tall messages like Location cards
                shouldScroll = distance < 300; // User is near bottom
            }

            if (shouldScroll) {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
        }
    }, [activeChat?.messages?.length, isTyping]);

    // Sync scroll to bottom during keyboard transitions
    useEffect(() => {
        if (viewMode === 'chat') {
            // The flex container height transitions over 0.4s. 
            // We lock the scroll to the bottom on every frame so the content
            // stays perfectly glued to the bottom exactly matching the layout reflows.
            const startTime = Date.now();
            const animateScroll = () => {
                messagesEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
                if (Date.now() - startTime < 450) {
                    requestAnimationFrame(animateScroll);
                }
            };
            requestAnimationFrame(animateScroll);
        }
    }, [viewMode, activeChatId, isKeyboardVisible]);


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
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: 'var(--app-height, 100dvh)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: theme.background,
                color: theme.text
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

                <div style={{ // REMOVED glass
                    justifyContent: 'space-between',
                    height: '60px',
                    borderRadius: '24px', // Round all corners
                    margin: '10px 10px 0 10px', // Float
                    backgroundColor: theme.primary,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 15px',
                    color: 'white'
                }}>
                    <div className="avatar" style={{
                        width: 32, height: 32, fontSize: '0.8rem',
                        background: actorAvatar ? `url(${actorAvatar}) center/cover no-repeat` : 'rgba(255,255,255,0.2)',
                        color: 'white'
                    }}>
                        {!actorAvatar && "Me"}
                    </div>
                    <h2 style={{ fontSize: '1.2rem', color: 'white' }}>Chats</h2>
                    <MoreVertical color="white" size={20} />
                </div>

                <div style={{ padding: '15px' }}>
                    <div style={{
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '12px',
                        color: 'white',
                        backgroundColor: theme.primary
                    }}>
                        <Search size={18} style={{ marginRight: 10, color: 'white' }} />
                        <span>Search matches...</span>
                    </div>
                </div>

                {/* Scrollable List Container */}
                <div style={{
                    flex: 1,
                    overflowY: 'scroll', // FORCE SCROLL ALWAYS
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
                <div style={{
                    padding: '15px',
                    display: 'flex',
                    justifyContent: 'space-around',
                    paddingBottom: 'max(15px, env(safe-area-inset-bottom))',
                    marginTop: 'auto',
                    backgroundColor: theme.primary
                }}>
                    <div style={{ opacity: 0.5 }}><div style={{ width: 24, height: 24, border: '2px solid white', borderRadius: 6 }}></div></div>
                    <div style={{ color: 'white' }}><MessageCircle size={28} fill="white" /></div>
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
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: 'var(--app-height, 100dvh)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: theme.background,
            color: theme.text
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
            <div style={{
                zIndex: 9999, // High z-index to stay on top
                position: 'fixed', // Force fixed relative to viewport
                top: `${theme.headerTop || 10}px`, // User configurable offset (default 10)
                left: '10px',
                right: '10px',
                height: '60px', // Force height to match others
                borderRadius: '24px', // Round all corners as requested
                backgroundColor: theme.primary,
                display: 'flex',
                alignItems: 'center',
                padding: '10px 15px',
                gap: '15px',
                color: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)' // Add shadow for depth
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
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{activeChat.name}</h2>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>{activeChat.status || "Online recently"}</span>
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
                flexDirection: 'column',
                height: '100%',
                minHeight: 0 // Flexbox nesting fix
            }}>
                {/* Unified Flex Wrapper (No Transforms) */}
                <div
                    className="sliding-wrapper"
                    style={{
                        flex: 1, // FORCE FILL
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        // justifyContent: 'flex-end', // Let flex-flow handle it
                        position: 'relative',
                        // REMOVED transform - rely on Flexbox resizing
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
                    {/* Messages Area - REFACTORED FOR SCROLLING */}
                    <div
                        ref={scrollContainerRef}
                        className="chat-messages"
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflowY: 'scroll',        // MUST be scroll to allow scrolling
                            overflowX: 'hidden',
                            WebkitOverflowScrolling: 'touch',
                            height: '100%',             // Fill the flex parent
                            position: 'relative',
                            // PADDING RESTORED (removed padding: 0) and handled via padding-bottom/top spacing in inner
                        }}
                    >
                        {/* SCROLL WRAPPER - Inner content that grows */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            width: '100%',
                            minHeight: 'calc(100% + 1px)', // Force overscroll
                            paddingTop: `${(theme.headerTop || 10) + 70}px`, // Header space
                            paddingBottom: '20px', // Restored default padding!
                            gap: '15px'
                        }}>
                            {/* No top spacer needed here, content just flows */}

                            {activeChat.messages.map((msg, index) => {
                                if (msg.system) {
                                    return (
                                        <div key={msg.id} style={{
                                            textAlign: 'center',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.8rem',
                                            margin: '10px 0',
                                            flexShrink: 0
                                        }}>
                                            {msg.text}
                                        </div>
                                    );
                                }

                                const isVoice = msg.text && msg.text.startsWith('[[VOICE::');
                                const isLocation = msg.text === '[[LOCATION]]';

                                let voiceDuration = 0;
                                if (isVoice) {
                                    const match = msg.text.match(/\[\[VOICE::(\d+)\]\]/);
                                    if (match) voiceDuration = parseInt(match[1]) || 0;
                                }

                                return (
                                    <div
                                        key={msg.id}
                                        className={`message ${msg.sender} fade-in-up`}
                                        style={{
                                            flexShrink: 0,
                                            padding: isLocation ? '4px' : (isVoice ? '10px 14px' : undefined)
                                        }}
                                    >
                                        {isLocation ? (
                                            <div style={{
                                                width: '240px',
                                                height: '140px',
                                                borderRadius: '16px',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)'
                                            }}>
                                                {/* Fake City Map Background using CSS patterns */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: -20, left: -20, right: -20, bottom: -20, // Oversize to hide edge clipping
                                                    backgroundColor: '#e5e3df', // Classic Google Maps ground color
                                                    backgroundImage: `
                                                        linear-gradient(90deg, transparent 48%, #f8f9fa 48%, #f8f9fa 52%, transparent 52%), /* Main vertical road */
                                                        linear-gradient(0deg, transparent 38%, #f8f9fa 38%, #f8f9fa 44%, transparent 44%), /* Main horizontal road */
                                                        linear-gradient(45deg, transparent 20%, #ffffff 20%, #ffffff 24%, transparent 24%), /* Diagonal street */
                                                        linear-gradient(-35deg, transparent 60%, #ffffff 60%, #ffffff 63%, transparent 63%), /* Diagonal street 2 */
                                                        radial-gradient(ellipse at 80% 20%, #aad3df 0%, #aad3df 25%, transparent 25%), /* Lake abstract */
                                                        radial-gradient(circle at 10% 80%, #cdeac0 0%, #cdeac0 20%, transparent 20%) /* Park abstract */
                                                    `,
                                                    backgroundSize: '100px 100px, 120px 120px, 80px 80px, 110px 110px, 100% 100%, 100% 100%',
                                                    filter: 'blur(0.8px) contrast(1.1) brightness(0.95)'
                                                }} />

                                                {/* Pin Shadow */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 'calc(50% + 12px)',
                                                    width: 16,
                                                    height: 6,
                                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                                    borderRadius: '50%',
                                                    filter: 'blur(2px)',
                                                    zIndex: 5
                                                }} />

                                                {/* Pin Container with pulse glow */}
                                                <div style={{
                                                    position: 'relative',
                                                    zIndex: 10,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: 50,
                                                    height: 50,
                                                    backgroundColor: 'rgba(234, 67, 53, 0.15)', // Maps red glow
                                                    borderRadius: '50%',
                                                    animation: 'pulseRecord 2s infinite',
                                                    marginTop: -10
                                                }}>
                                                    <MapPin size={28} color="#ea4335" fill="#ea4335" strokeWidth={1} style={{ filter: 'drop-shadow(0px 3px 5px rgba(0,0,0,0.4))', marginTop: -6 }} />
                                                </div>
                                            </div>
                                        ) : isVoice ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
                                                {/* Play Button */}
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: '50%',
                                                    backgroundColor: msg.sender === 'me' ? 'white' : theme.primary,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: msg.sender === 'me' ? (theme.outgoing || theme.primary) : 'white',
                                                    flexShrink: 0,
                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                                }}>
                                                    <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />
                                                </div>
                                                {/* Fake Waveform */}
                                                <div style={{ flex: 1, height: '24px', display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    {[...Array(20)].map((_, i) => (
                                                        <div key={i} style={{
                                                            width: 3,
                                                            height: `${40 + Math.sin(i * 0.8 + voiceDuration) * 40 + Math.cos(i * 1.5) * 20}%`,
                                                            backgroundColor: 'currentColor',
                                                            opacity: 0.5,
                                                            borderRadius: 2
                                                        }} />
                                                    ))}
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', minWidth: '35px', textAlign: 'right', opacity: 0.8 }}>
                                                    {formatTime(voiceDuration)}
                                                </span>
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                );
                            })}

                            {isTyping && (
                                <div className="typing-indicator fade-in-up" style={{ flexShrink: 0 }}>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                </div>
                            )}

                            <div ref={messagesEndRef} style={{ height: 1, width: '100%', minHeight: '1px', flexShrink: 0 }} />
                        </div>
                    </div>

                    {/* Sliding Input Area (In flex flow!) */}
                    <div
                        className="chat-input-area"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsKeyboardVisible(true);
                        }}
                        style={{
                            position: 'relative',
                            zIndex: 10,
                            flexShrink: 0, // Don't shrink input
                            width: 'calc(100% - 20px)',
                            margin: '0 10px', // Removed bottom margin, spacer handles it
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: '15px',
                            paddingRight: '15px',
                            backgroundColor: theme.primary,
                            paddingTop: '10px',
                            paddingBottom: '10px'
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
                            {isRecording ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', fontWeight: 'bold' }}>
                                    <div className="recording-dot" style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                    {formatTime(recordingTime)}
                                </div>
                            ) : (
                                localInputValue ? (
                                    <span style={{ whiteSpace: 'pre-wrap' }}>{localInputValue}</span>
                                ) : (
                                    <span style={{ opacity: 0.5 }}>Type a message...</span>
                                )
                            )}
                            {(isKeyboardVisible && !isRecording) && <div className="cursor-blink"></div>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
                            {(!localInputValue && !isRecording) && (
                                <button
                                    onClick={handleMicClick}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.7)',
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Mic size={22} />
                                </button>
                            )}
                            {isRecording && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsRecording(false);
                                        setRecordingTime(0);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Trash2 size={22} />
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleVirtualSend(); }}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: isRecording ? '#ef4444' : 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    flexShrink: 0
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isRecording ? 'white' : theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Spacer that forces messages up dynamically */}
                    <div style={{
                        height: isKeyboardVisible ? '300px' : '10px', // 10px static gap when closed
                        transition: 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
                        flexShrink: 0,
                        width: '100%'
                    }} />

                    {/* Base Space Offset Slider Tracker */}
                    <div style={{ height: `${35 + (theme.keyboardOffset || 0)}px`, flexShrink: 0, width: '100%' }} />

                    {/* Absolute Keyboard Anchor */}
                    <div style={{
                        position: 'absolute',
                        bottom: `${35 + (theme.keyboardOffset || 0)}px`,
                        left: 0,
                        right: 0,
                        height: '300px',
                        overflow: 'hidden',
                        pointerEvents: 'none',
                        zIndex: 100
                    }}>
                        {/* Sliding Keyboard */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '300px',
                            transform: `translateY(${isKeyboardVisible ? '0px' : '300px'})`,
                            transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
                            pointerEvents: isKeyboardVisible ? 'auto' : 'none',
                            backgroundColor: 'transparent'
                        }}>
                            <VirtualKeyboard
                                isActive={true}
                                value={localInputValue}
                                onChange={handleKeyboardChange}
                                onSend={handleVirtualSend}
                            />
                        </div>
                    </div>
                </div>
            </div >

            {/* MATCH DISSOLUTION OVERLAY */}
            {
                activeChat.dissolved && (
                    <div className="fade-in-up" style={{
                        position: 'fixed', // Fixed to viewport
                        inset: 0,          // Top/Left/Right/Bottom 0
                        width: '100%',
                        height: '100%',
                        zIndex: 9999,
                        backgroundColor: data.messengerDissolveSettings?.overlayColor || 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: 'white',
                        padding: 40,
                        overscrollBehavior: 'none', // Prevent bounce
                        touchAction: 'none'         // Prevent scrolling through
                    }}>
                        {data.messengerDissolveSettings?.overlayImage ? (
                            <img
                                src={data.messengerDissolveSettings.overlayImage}
                                alt="Match Dissolved"
                                style={{
                                    width: `${data.messengerDissolveSettings.overlayImageSize ?? 80}%`,
                                    maxWidth: '300px',
                                    marginBottom: '30px',
                                    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))',
                                    objectFit: 'contain'
                                }}
                            />
                        ) : (
                            <img
                                src="/wilted_rose.png"
                                alt="Match Dissolved"
                                style={{
                                    width: '150px',
                                    marginBottom: '30px',
                                    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
                                }}
                            />
                        )}

                        <h2 style={{
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            margin: 0,
                            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                            display: data.messengerDissolveSettings?.text === "" ? 'none' : 'block'
                        }}>
                            {data.messengerDissolveSettings?.text || activeChat.dissolutionMessage || "Match dissolved"}
                        </h2>
                    </div>
                )
            }

            <style>{`
          .message {
              background-color: ${theme.incoming || '#222222'};
              color: ${theme.messageText || 'white'};
          }
          .message.match {
              background-color: ${theme.incoming || '#222222'} !important;
              color: ${theme.messageText || 'white'} !important;
          }
          .message.me {
              background-color: ${theme.outgoing || theme.primary} !important;
              color: ${theme.messageText || 'white'} !important;
              align-self: flex-end;
              border-bottom-right-radius: 4px;
              box-shadow: none !important;
          }
          @keyframes blink { 
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
          }
          .cursor-blink {
              display: inline-block;
              width: 2px;
              height: 1.2rem;
              background: white;
              margin-left: 2px;
              animation: blink 1s infinite;
          }
          
          @keyframes pulseRecord { 
              0% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.3; transform: scale(1.3); }
              100% { opacity: 1; transform: scale(1); }
          }
          .recording-dot {
              animation: pulseRecord 1.5s infinite;
          }
          
          .typing-indicator {
              background-color: ${theme.incoming || '#222222'} !important;
          }
          .typing-indicator .dot {
              background-color: ${theme.messageText || 'var(--text-secondary)'} !important;
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
        </div >
    );
}
