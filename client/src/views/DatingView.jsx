import { useState, useEffect, useRef } from 'react';
import { Heart, X, Info } from 'lucide-react';
import { DEFAULT_APP_NAME } from '../constants';

export default function DatingView({ data, socket }) {
    const { datingProfiles, activeDatingProfileId, datingAppName } = data;
    const theme = data.datingTheme || { primary: "#FF4B6E", background: "#111111", text: "#FFFFFF" };

    // Find current index based on active ID
    const currentIndex = datingProfiles.findIndex(p => p.id === activeDatingProfileId);

    // Compute active and next profile
    const currentProfile = datingProfiles[currentIndex];
    const nextProfile = datingProfiles[(currentIndex + 1) % datingProfiles.length];

    // Local state for animation
    const [swipeState, setSwipeState] = useState(null); // 'left' | 'right' | null
    const [dragDelta, setDragDelta] = useState(0);      // Current drag distance X
    const [isDragging, setIsDragging] = useState(false);

    // Match Animation State
    const [showMatch, setShowMatch] = useState(false);

    const startX = useRef(0);

    // Reset swipe state when the active ID changes (Server confirmed switch)
    useEffect(() => {
        setSwipeState(null);
        setDragDelta(0);
        setIsDragging(false);
        setShowMatch(false); // Clear match screen if we were stuck there
    }, [activeDatingProfileId]);

    const handleSwipeTrigger = (direction) => {
        if (swipeState) return;
        setSwipeState(direction);

        // CHECK MATCH
        if (direction === 'right' && currentProfile.isMatch) {
            // Show Match Animation immediately as card flies off
            setShowMatch(true);

            // Wait longer in Match Screen before proceeding?
            // Actually, we should probably wait for user interaction or a timeout to close match screen.
            // But for simple flow, let's show it for 3 seconds then move on.
            setTimeout(() => {
                advanceProfile();
            }, 4000);
        } else {
            // Normal Swipe
            setTimeout(() => {
                advanceProfile();
            }, 600);
        }
    };

    const advanceProfile = () => {
        const nextId = nextProfile ? nextProfile.id : null;
        if (nextId) {
            socket.emit('actor:dating_swipe', nextId);
        } else {
            setSwipeState(null); // No next profile, reset (looping handles this usually)
        }
    };

    // --- GESTURE HANDLERS ---
    const onDragStart = (e) => {
        if (swipeState) return;
        setIsDragging(true);
        // Normalize touch/mouse
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        startX.current = clientX;
    };

    const onDragMove = (e) => {
        if (!isDragging || swipeState) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const delta = clientX - startX.current;
        setDragDelta(delta);
    };

    const onDragEnd = () => {
        if (!isDragging || swipeState) return;
        setIsDragging(false);

        const threshold = 100; // px to trigger swipe
        if (dragDelta > threshold) {
            handleSwipeTrigger('right');
        } else if (dragDelta < -threshold) {
            handleSwipeTrigger('left');
        } else {
            // Reset (Snap back)
            setDragDelta(0);
        }
    };

    // Computed Transform for Active Card
    const getCardStyle = () => {
        // 1. If programmatically swiping (Button click or completed drag)
        if (swipeState === 'right') return { transform: 'translateX(150%) rotate(20deg)', opacity: 0, transition: 'transform 0.6s ease-out, opacity 0.6s' };
        if (swipeState === 'left') return { transform: 'translateX(-150%) rotate(-20deg)', opacity: 0, transition: 'transform 0.6s ease-out, opacity 0.6s' };

        // 2. If Dragging live
        if (isDragging) {
            const rotate = dragDelta * 0.05; // 100px = 5deg
            return {
                transform: `translateX(${dragDelta}px) rotate(${rotate}deg)`,
                transition: 'none', // Instant follow
                cursor: 'grabbing'
            };
        }

        // 3. Resting / Resetting
        return {
            transform: 'translateX(0) rotate(0deg)',
            opacity: 1,
            transition: 'transform 0.3s ease-out', // Snappy reset
            cursor: 'grab'
        };
    };

    if (!currentProfile) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column' }}>
                <h2>No profiles nearby...</h2>
                <p>Waiting for more people.</p>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            background: theme.background,
            color: theme.text,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none'
        }}>
            <style>{`
                @keyframes fadeInData {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .profile-info-fade {
                    animation: fadeInData 0.8s ease-out forwards;
                    opacity: 0; /* Starte unsichtbar */
                    animation-delay: 0.2s; /* Warte kurz bis Karte stabil ist */
                }
                @keyframes pulseHeart {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            `}</style>

            {/* Header */}
            <div style={{ padding: 20, textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: theme.primary }}>
                    {datingAppName || DEFAULT_APP_NAME}
                </span>
            </div>

            {/* Card Stack */}
            <div style={{ flex: 1, position: 'relative', margin: '0 15px 20px 15px' }}>

                {/* 1. Underlying Card (Next) */}
                {nextProfile && (
                    <div
                        key={nextProfile.id}
                        style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            borderRadius: 20,
                            background: `url(${nextProfile.imageUrl || ''}) center/cover no-repeat`,
                            backgroundColor: '#333',
                            transform: (isDragging || swipeState) ? 'scale(1)' : 'scale(0.95)',
                            transition: 'transform 0.5s ease',
                            zIndex: 1
                        }}
                    ></div>
                )}

                {/* 2. Active Card - Draggable */}
                <div
                    key={currentProfile.id}
                    onMouseDown={onDragStart}
                    onMouseMove={onDragMove}
                    onMouseUp={onDragEnd}
                    onMouseLeave={onDragEnd}
                    onTouchStart={onDragStart}
                    onTouchMove={onDragMove}
                    onTouchEnd={onDragEnd}

                    style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        borderRadius: 20,
                        background: `url(${currentProfile.imageUrl || ''}) center/cover no-repeat`,
                        backgroundColor: '#444',
                        zIndex: 2,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        transformOrigin: 'bottom center',
                        ...getCardStyle()
                    }}
                >
                    {/* Gradient Overlay for Text - FADES IN NOW */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: '50%',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                        borderRadius: '0 0 20px 20px',
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        pointerEvents: 'none',
                        // ANIMATION HERE:
                        animation: 'fadeInData 0.8s ease-out forwards',
                        opacity: 0,
                        animationDelay: '0.2s'
                    }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '2rem', color: 'white' }}>
                                {currentProfile.name} <span style={{ fontSize: '1.4rem', fontWeight: 'normal' }}>{currentProfile.age}</span>
                            </h2>
                            {currentProfile.bio && (
                                <p style={{ color: 'rgba(255,255,255,0.9)', margin: '10px 0 0 0', fontSize: '1rem' }}>
                                    {currentProfile.bio}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Controls */}
            <div style={{ height: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, paddingBottom: 20, zIndex: 10 }}>
                <button
                    onClick={() => handleSwipeTrigger('left')}
                    style={{
                        width: 60, height: 60, borderRadius: '50%',
                        background: 'transparent', border: `2px solid ${theme.primary}`,
                        color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        transform: 'scale(1)',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <X size={30} />
                </button>

                <button
                    style={{
                        width: 45, height: 45, borderRadius: '50%',
                        background: 'transparent', border: '2px solid #3399ff',
                        color: '#3399ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                        cursor: 'pointer'
                    }}
                >
                    <Info size={20} />
                </button>

                <button
                    onClick={() => handleSwipeTrigger('right')}
                    style={{
                        width: 60, height: 60,
                        borderRadius: '50%',
                        background: theme.primary,
                        border: 'none',
                        color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: `0 5px 20px ${theme.primary}66` // 40% Alpha transparency
                    }}
                >
                    <Heart size={30} fill="white" />
                </button>
            </div>

            {/* MATCH OVERLAY */}
            {showMatch && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 100,
                    animation: 'fadeIn 0.3s'
                }}>
                    <h1 style={{
                        fontSize: '3rem', fontStyle: 'italic',
                        background: `linear-gradient(45deg, ${theme.primary}, #FF8E53)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: 20,
                        animation: 'pulseHeart 2s infinite ease-in-out'
                    }}>
                        It's a Match!
                    </h1>
                    <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
                        <div style={{
                            width: 100, height: 100, borderRadius: '50%',
                            background: currentProfile.imageUrl ? `url(${currentProfile.imageUrl}) center/cover` : currentProfile.avatarColor || '#444',
                            border: '4px solid white',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                        }}></div>
                        <Heart size={50} fill="white" color="white" style={{ animation: 'pulseHeart 1.5s infinite' }} />
                        {/* ACTOR AVATAR (You) */}
                        <div style={{
                            width: 100, height: 100, borderRadius: '50%',
                            background: data.actorAvatar ? `url(${data.actorAvatar}) center/cover no-repeat` : data.actorAvatarColor || '#444',
                            border: '4px solid white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '0.9rem',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                        }}>
                            {!data.actorAvatar && "You"}
                        </div>
                    </div>
                    <p style={{ color: 'white', marginTop: 40, fontSize: '1.2rem', fontWeight: '500', opacity: 0.9 }}>
                        You and {currentProfile.name} liked each other.
                    </p>

                    {/* Optional "Keep Playing" button to dismiss faster? 
                        User said "Wait until animation is over", but maybe a button is better UX eventually.
                        For now, just styling.
                    */}
                </div>
            )}

        </div>
    );
}
