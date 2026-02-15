import React, { useState, useEffect } from 'react';
import { Camera, Flashlight } from 'lucide-react';

export default function LockScreenView({ data }) {
    const { lockScreenSettings } = data;
    const {
        mode,
        showTime,
        showDate,
        customTime,
        customDate,
        showFlashlight,
        showCamera,
        backgroundImage,
        backgroundDim
    } = lockScreenSettings || {};

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    if (mode === 'black') {
        return <div style={{ width: '100%', height: '100%', backgroundColor: 'black' }} />;
    }

    // Format Logic
    const timeString = customTime || currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Date formatting: "Sunday, 9. June" or similar appropriate format
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateString = customDate || currentTime.toLocaleDateString('de-DE', dateOptions);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            backgroundColor: 'black',
            color: 'white',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            {/* Background Image */}
            {backgroundImage && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 1 - (backgroundDim || 0)
                }} />
            )}

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
                paddingTop: '60px',
                paddingBottom: '40px',
                boxSizing: 'border-box'
            }}>

                {/* Top Section (Date/Time) */}
                <div style={{ textAlign: 'center', marginTop: '60px' }}>
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

            </div>
        </div>
    );
}
