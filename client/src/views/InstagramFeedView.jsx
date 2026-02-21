import React, { useRef, useEffect } from 'react';
import { ChevronLeft, MoreHorizontal, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';

export default function InstagramFeedView({ profile, activePostIndex, onBack }) {
    const feedRef = useRef(null);
    const postRefs = useRef([]);

    // Scroll to the active post when the view opens
    useEffect(() => {
        if (feedRef.current && postRefs.current[activePostIndex]) {
            setTimeout(() => {
                postRefs.current[activePostIndex].scrollIntoView({ behavior: 'auto', block: 'start' });
            }, 50);
        }
    }, [activePostIndex]);

    return (
        <div style={{
            width: '100vw',
            height: '100dvh',
            backgroundColor: profile.backgroundColor || '#000000',
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
                <div onClick={onBack} style={{ cursor: 'pointer', zIndex: 11 }}>
                    <ChevronLeft size={28} />
                </div>
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '0.75rem', color: '#a8a8a8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Entdecken</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Beiträge</span>
                </div>
                <div style={{ width: 28 }} /> {/* Spacer */}
            </div>

            {/* Scrollable Feed Container */}
            <div
                ref={feedRef}
                style={{
                    flex: 1,
                    overflowY: 'scroll',
                    WebkitOverflowScrolling: 'touch',
                    paddingBottom: '40px'
                }}
            >
                <div style={{ minHeight: 'calc(100% + 1px)' }}>
                    {profile.gridPhotos.map((photo, index) => (
                        <div key={photo.id} ref={el => postRefs.current[index] = el} style={{ marginBottom: '24px' }}>
                            {/* Post Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: profile.avatar ? `url(${profile.avatar}) center/cover` : 'linear-gradient(135deg, #e1306c, #f56040)'
                                    }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{profile.name}</span>
                                </div>
                                <MoreHorizontal size={20} />
                            </div>

                            {/* Post Image */}
                            <div style={{
                                width: '100%',
                                aspectRatio: '1/1',
                                background: photo.url ? `url(${photo.url}) center/cover` : photo.color
                            }} />

                            {/* Action Icons */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px 8px 14px' }}>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <Heart size={24} />
                                    <MessageCircle size={24} />
                                    <Send size={24} />
                                </div>
                                <Bookmark size={24} />
                            </div>

                            {/* Dynamic Likes */}
                            <div style={{ padding: '0 14px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Gefällt {photo.likes || 0} Mal</span>
                            </div>

                            {/* Comments Section */}
                            <div style={{ padding: '0 14px' }}>
                                {(photo.comments || []).map((comment, cIndex) => {
                                    if (!comment.username && !comment.text) return null;
                                    return (
                                        <div key={cIndex} style={{ marginBottom: '4px', fontSize: '0.9rem' }}>
                                            <span style={{ fontWeight: 600, marginRight: '6px' }}>{comment.username || 'user'}</span>
                                            <span>{comment.text}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Timestamp */}
                            <div style={{ padding: '0 14px', marginTop: '6px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#a8a8a8' }}>{photo.dateText || 'VOR EINIGEN TAGEN'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
