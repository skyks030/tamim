import React, { useRef, useEffect } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
// Removed toolbar imports since we want a single send button (likely in input area)

export default function VirtualKeyboard({ isActive, value, onChange, onKeyPress, onSend }) {
    const keyboard = useRef();

    // FORCE SYNC: When parent clears 'value' (to ""), we must tell the library to clear its internal buffer
    useEffect(() => {
        if (keyboard.current) {
            keyboard.current.setInput(value);
        }
    }, [value]);

    // Unified Sliding Layout: Always render fixed height block
    // Parent wrapper slides it in/out.

    return (
        <div
            className="virtual-keyboard-container glass"
            style={{
                height: 'calc(280px + env(safe-area-inset-bottom))',
                display: 'flex', // Ensure content displays
                margin: '0 10px 30px 10px', // Floating margins (Lifted up)
                width: 'auto', // Fix "shifted right" by letting margins dictate width
                borderRadius: '24px', // Rounded corners
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <Keyboard
                keyboardRef={(r) => (keyboard.current = r)}
                input={value} // Controlled input
                onChange={onChange}
                onKeyPress={(button) => {
                    if (button === "{enter}") onSend();
                    else onKeyPress?.(button);
                }}
                layout={{
                    default: [
                        "q w e r t z u i o p ü",
                        "a s d f g h j k l ö ä",
                        "{shift} y x c v b n m . {backspace}",
                        "{numbers} {space} {enter}"
                    ],
                    shift: [
                        "Q W E R T Z U I O P Ü",
                        "A S D F G H J K L Ö Ä",
                        "{shift} Y X C V B N M . {backspace}",
                        "{numbers} {space} {enter}"
                    ],
                    numbers: [
                        "1 2 3 4 5 6 7 8 9 0",
                        "- / : ; ( ) € & @ \"",
                        "{shift} . , ? ! ' {backspace}",
                        "{abc} {space} {enter}"
                    ]
                }}
                display={{
                    "{numbers}": "123",
                    "{enter}": "senden",
                    "{escape}": "esc ⎋",
                    "{tab}": "tab ⇥",
                    "{backspace}": "⌫",
                    "{shift}": "⇧",
                    "{capslock}": "caps lock ⇪",
                    "{space}": "Leerzeichen",
                    "{abc}": "ABC"
                }}
                theme={"hg-theme-default hg-theme-ios"}
            />

            <style>{`
        .virtual-keyboard-container {
            width: 100%;
            background: #1c1c1e; /* Match iOS KB color */
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            justify-content: flex-end; /* Align bottom */
            overflow: hidden;
            flex-shrink: 0;
            padding-bottom: env(safe-area-inset-bottom);
        }

        /* iOS Theme Overrides */
        .hg-theme-ios {
            background-color: transparent !important;
            padding: 5px !important;
            touch-action: manipulation; /* Improve touch response */
        }
        .hg-theme-ios .hg-button {
            background: #4a4a4c !important;
            color: white !important;
            border-bottom: 1px solid #111 !important;
            height: 50px !important; /* Taller keys */
            border-radius: 5px !important;
            font-size: 1.35rem !important; /* Larger font */
            font-weight: 400 !important;
            margin: 2px !important; /* Tighter margins for German layout */
            transition: background 0.1s;
        }
        .hg-theme-ios .hg-button:active {
            background: #3a3a3c !important;
        }
        
        .hg-theme-ios .hg-row {
            margin-bottom: 4px !important;
        }

        /* Special Keys slightly smaller font */
        .hg-theme-ios .hg-button.hg-functionBtn {
            background: #3a3a3c !important;
            font-size: 0.9rem !important;
        }
        
        /* --- HIER DIE GRÖSSE DES LÖSCH-SYMBOLS ÄNDERN --- */
        /* Backspace: Settings for Delete Key */
        .hg-theme-ios .hg-button-backspace {
            min-width: unset !important;
            width: 60px !important;     /* Breite der Taste */
            flex-grow: 0 !important;
            overflow: visible !important;
            z-index: 10;
        }

        /* Target the text span inside to scale it reliably */
        .hg-theme-ios .hg-button-backspace span {
            transform: scale(2.5) !important; /* Force Zoom */
            display: inline-block !important;
            line-height: 1 !important;
            margin-top: -2px !important; /* Fine tune vertical center */
        }
        
        /* Spacebar */
        .hg-theme-ios .hg-button-space {
            background: #4a4a4c !important;
            min-width: 150px !important; 
        }
        
        /* Return Key Blue */
        .hg-theme-ios .hg-button-enter {
            background: #007AFF !important;
            color: white !important;
            font-weight: 600 !important;
             font-size: 0.9rem !important;
        }

      `}</style>
        </div>
    );
}
