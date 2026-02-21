import React, { useRef, useEffect } from 'react';
import { ChevronLeft, MoreHorizontal, CheckCircle, ChevronDown } from 'lucide-react';

export default function InstagramView({ data }) {
    const { instagramProfiles = [], activeInstagramProfileId } = data;
    const profile = instagramProfiles.find(p => p.id === activeInstagramProfileId) || instagramProfiles[0];

    // Auto-scroll to top when profile changes
    const scrollRef = useRef(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [activeInstagramProfileId]);

    if (!profile) return <div style={{ background: 'black', width: '100%', height: '100%' }} />;

    return (
        <div style={{
            width: '100vw',
            height: '100dvh',
            backgroundColor: profile.backgroundColor || '#000000', // Instagram Dark Mode
            color: '#FFFFFF',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>

            {/* Top Navigation Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '0.5px solid rgba(255,255,255,0.15)',
                position: 'relative',
                zIndex: 10,
                backgroundColor: profile.backgroundColor || '#000000'
            }}>
                <ChevronLeft size={28} />
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{profile.name}</span>
                    <CheckCircle size={14} color="#3b82f6" fill="#3b82f6" />
                </div>
                <MoreHorizontal size={24} />
            </div>

            {/* Bouncy Scroll Container */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: 'scroll', // MUST BE SCROLL FOR BOUNCE
                    WebkitOverflowScrolling: 'touch', // Crucial for iOS momentum/bouncy scrolling
                    paddingBottom: '40px'
                }}
            >
                {/* Force elastic scroll on Webkit by making content > 100% */}
                <div style={{ minHeight: 'calc(100% + 1px)' }}>
                    {/* Profile Info Section */}
                    <div style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>

                            {/* Avatar */}
                            <div style={{
                                width: '86px', height: '86px',
                                borderRadius: '50%',
                                background: profile.avatar ? `url(${profile.avatar}) center/cover` : 'linear-gradient(135deg, #e1306c, #f56040)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }} />

                            {/* Stats */}
                            <div style={{ display: 'flex', gap: '24px', flex: 1, justifyContent: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{profile.posts}</span>
                                    <span style={{ fontSize: '0.85rem', color: '#a8a8a8' }}>Beiträge</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{profile.followers}</span>
                                    <span style={{ fontSize: '0.85rem', color: '#a8a8a8' }}>Follower</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{profile.following}</span>
                                    <span style={{ fontSize: '0.85rem', color: '#a8a8a8' }}>Gefolgt</span>
                                </div>
                            </div>
                        </div>

                        {/* Bio text */}
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 2 }}>
                                {profile.displayName}
                            </div>
                            <div style={{
                                fontSize: '0.95rem',
                                lineHeight: 1.3,
                                whiteSpace: 'pre-wrap',
                                color: '#e5e5e5'
                            }}>
                                {profile.bio}
                            </div>
                        </div>

                        {/* Action Buttons (Visual only) */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <div style={{
                                flex: 1, padding: '7px 0',
                                background: profile.isFollowing ? '#363636' : '#0095F6',
                                color: '#FFFFFF',
                                borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600
                            }}>
                                {profile.isFollowing ? (
                                    <>Abonniert <ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }} /></>
                                ) : (
                                    "Abonnieren"
                                )}
                            </div>
                            <div style={{ flex: 1, padding: '7px 0', background: '#363636', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>
                                Nachricht
                            </div>
                            <div style={{ flex: 1, padding: '7px 0', background: '#363636', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>
                                Kontakt
                            </div>
                        </div>
                    </div>

                    {/* Grid Tabs Header (Visual only) */}
                    <div style={{ display: 'flex', borderTop: '0.5px solid rgba(255,255,255,0.15)', marginTop: '4px' }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '12px 0', borderBottom: '1px solid #FFFFFF' }}>
                            {/* Grid Icon SVG */}
                            <svg aria-label="Posts" fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M12 21.5h-8a3.5 3.5 0 0 1-3.5-3.5v-12a3.5 3.5 0 0 1 3.5-3.5h16a3.5 3.5 0 0 1 3.5 3.5v8.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="M1 9.5h22" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="M1 15.5h22" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="M7.5 3.5v18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="M15.5 3.5v18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path></svg>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '12px 0', opacity: 0.5 }}>
                            {/* Reels Icon SVG */}
                            <svg aria-label="Reels" fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="m14.718 10.605-6.195-3.328a1.5 1.5 0 0 0-2.227 1.309v6.666a1.5 1.5 0 0 0 2.227 1.309l6.195-3.328a1.5 1.5 0 0 0 0-2.618Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><rect height="21" rx="3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" width="16" x="4" y="1.5"></rect></svg>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '12px 0', opacity: 0.5 }}>
                            {/* Tagged Icon SVG */}
                            <svg aria-label="Tagged" fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M10.201 3.797 12 1.997l1.799 1.8a1.59 1.59 0 0 0 1.124.465h5.259A1.818 1.818 0 0 1 22 6.08v14.104a1.818 1.818 0 0 1-1.818 1.818H3.818A1.818 1.818 0 0 1 2 20.184V6.08a1.818 1.818 0 0 1 1.818-1.818h5.26a1.59 1.59 0 0 0 1.123-.465Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><path d="M18.598 22.002V21.4a3.949 3.949 0 0 0-3.948-3.949H9.495A3.949 3.949 0 0 0 5.546 21.4v.603" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path><circle cx="12.072" cy="11.075" fill="none" r="3.556" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></circle></svg>
                        </div>
                    </div>

                    {/* Photo Grid Container */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                        {profile.gridPhotos.map(photo => (
                            <div key={photo.id} style={{
                                aspectRatio: '1/1',
                                background: photo.url ? `url(${photo.url}) center/cover` : photo.color
                            }} />
                        ))}
                    </div>

                </div>

            </div>
        </div>
    );
}
