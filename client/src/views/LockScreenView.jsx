import React, { useState, useEffect } from 'react';
import { Camera, Flashlight, Phone, PhoneOff } from 'lucide-react';

export default function LockScreenView({ socket, data }) {
    const { lockScreenSettings } = data;
    const mode = lockScreenSettings?.mode || 'lock';
    const showTime = lockScreenSettings?.showTime !== false;
    const showDate = lockScreenSettings?.showDate !== false;
    const customTime = lockScreenSettings?.customTime;
    const customDate = lockScreenSettings?.customDate;
    const showFlashlight = lockScreenSettings?.showFlashlight !== false;
    const showCamera = lockScreenSettings?.showCamera !== false;
    const showHomeBar = lockScreenSettings?.showHomeBar !== false;
    const backgroundImage = lockScreenSettings?.backgroundImage;
    const backgroundDim = lockScreenSettings?.backgroundDim || 0;
    const timeOffset = lockScreenSettings?.timeOffset ?? 60;
    const showCall = lockScreenSettings?.showCall || false;
    const callName = lockScreenSettings?.callName || "Sarah";
    const callImage = lockScreenSettings?.callImage;
    const callOffset = lockScreenSettings?.callOffset ?? 40;
    const callDim = lockScreenSettings?.callDim ?? 0.3;
    const callBlur = lockScreenSettings?.callBlur ?? 0;

    const notifications = lockScreenSettings?.notifications || [];

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Format Logic
    const timeString = customTime || currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Date formatting: "Sunday, 9. June" or similar appropriate format
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateString = customDate || currentTime.toLocaleDateString('de-DE', dateOptions);

    const isBlack = mode === 'black';

    // Sync Meta Theme Color & Body Background for Notch/Overscroll support
    useEffect(() => {
        let metaThemeColor = document.querySelector("meta[name='theme-color']");
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = "theme-color";
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.setAttribute("content", "#000000");

        document.body.style.backgroundColor = "#000000";
        document.documentElement.style.backgroundColor = "#000000";

        return () => {
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#0f172a");
            document.body.style.backgroundColor = "#0f172a";
            document.documentElement.style.backgroundColor = "#0f172a";
        };
    }, []);

    const handleEndCall = () => {
        if (socket) {
            socket.emit('control:update_lockscreen_settings', { showCall: false, mode: 'lock' });
        }
    };

    return (
        <div style={{
            width: '100vw',
            height: '100dvh',
            position: 'relative',
            backgroundColor: 'black',
            color: 'white',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            {/* Animate opacity for transition between black and lock screen */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                opacity: isBlack ? 0 : 1,
                transition: 'opacity 300ms ease-in-out',
                pointerEvents: isBlack ? 'none' : 'auto'
            }}>
                {/* Background (Color Gradient or Image) */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: 1 - backgroundDim
                }} />

                {/* Content Container */}
                <div style={{
                    position: 'relative',
                    zIndex: 10,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0px',
                    paddingBottom: '40px',
                    boxSizing: 'border-box'
                }}>

                    {/* Top Section (Date/Time) */}
                    <div style={{ textAlign: 'center', marginTop: `${timeOffset}px`, marginBottom: '40px', width: '100%' }}>
                        {showDate && (
                            <div style={{
                                fontSize: '1.3rem',
                                fontWeight: 500,
                                opacity: 0.8,
                                marginBottom: '0px',
                                letterSpacing: '0.5px'
                            }}>
                                {dateString}
                            </div>
                        )}
                        {showTime && (
                            <div style={{
                                fontSize: '6.5rem',
                                fontWeight: 500,
                                lineHeight: 1,
                                letterSpacing: '-3px',
                                fontVariantNumeric: 'tabular-nums'
                            }}>
                                {timeString}
                            </div>
                        )}
                    </div>

                    {/* Notifications Section */}
                    <div style={{ flex: 1, width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'hidden' }}>
                        {notifications.map((notif) => (
                            <div key={notif.id} style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.45)',
                                backdropFilter: 'blur(30px)',
                                WebkitBackdropFilter: 'blur(30px)',
                                borderRadius: '24px',
                                padding: '12px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8, fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg, #4ade80, #16a34a)', borderRadius: 4 }} />
                                        <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>Nachrichten</span>
                                    </div>
                                    <span>{notif.time || 'Jetzt'}</span>
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 600 }}>{notif.sender}</div>
                                <div style={{ fontSize: '0.95rem', opacity: 0.9, lineHeight: 1.3 }}>{notif.message}</div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Section (Actions) */}
                    <div style={{
                        width: '100%',
                        padding: '0 50px',
                        marginBottom: '40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                    }}>
                        {showFlashlight ? (
                            <div style={{
                                width: 50,
                                height: 50,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(30, 30, 30, 0.6)', // Darker, like iOS
                                backdropFilter: 'blur(20px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <Flashlight size={24} color="white" fill="white" strokeWidth={1.5} />
                            </div>
                        ) : <div style={{ width: 50 }} />}

                        {showCamera ? (
                            <div style={{
                                width: 50,
                                height: 50,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(30, 30, 30, 0.6)',
                                backdropFilter: 'blur(20px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <Camera size={24} color="white" fill="white" strokeWidth={1.5} />
                            </div>
                        ) : <div style={{ width: 50 }} />}
                    </div>

                    {/* Home Bar Indicator */}
                    {showHomeBar && (
                        <div style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '130px',
                            height: '5px',
                            backgroundColor: 'white',
                            borderRadius: '5px',
                            opacity: 0.8
                        }} />
                    )}

                </div>
            </div>

            {/* CALL OVERLAY BACKGROUND AND CONTAINERS */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                opacity: showCall ? 1 : 0,
                pointerEvents: showCall ? 'auto' : 'none',
                // Instant show, 300ms fade out to avoid lockscreen flash when waking up straight to call
                transition: showCall ? 'none' : 'opacity 300ms ease-in-out',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '60px 40px 80px 40px',
                boxSizing: 'border-box'
            }}>
                {/* Caller Background Layer */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: -1,
                    ...(callImage ? {
                        backgroundImage: `url(${callImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: `brightness(${1 - callDim}) blur(${callBlur}px)`
                    } : {
                        backgroundColor: `rgba(0, 0, 0, ${callDim})`,
                        backdropFilter: `blur(${30 + callBlur}px) saturate(1.5)`
                    })
                }}></div>

                {/* Caller Info */}
                <div style={{ textAlign: 'center', marginTop: `${callOffset}px` }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 400, marginBottom: '10px', letterSpacing: '1px' }}>
                        {callName}
                    </div>
                    <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>
                        Eingehender Anruf
                    </div>
                </div>

                {/* Call Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
                    {/* Decline */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <button
                            onClick={handleEndCall}
                            style={{
                                width: '75px', height: '75px', borderRadius: '50%',
                                backgroundColor: '#ff3b30', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 59, 48, 0.4)'
                            }}
                        >
                            <PhoneOff size={32} color="white" fill="white" />
                        </button>
                        <span style={{ fontSize: '1rem' }}>Ablehnen</span>
                    </div>

                    {/* Accept */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <button
                            onClick={handleEndCall}
                            style={{
                                width: '75px', height: '75px', borderRadius: '50%',
                                backgroundColor: '#34c759', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 4px 15px rgba(52, 199, 89, 0.4)'
                            }}
                        >
                            <Phone size={32} color="white" fill="white" />
                        </button>
                        <span style={{ fontSize: '1rem' }}>Annehmen</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
