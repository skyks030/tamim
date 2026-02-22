import React, { useRef, useEffect, useState } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

export default function VirtualKeyboard({ isActive, value, onChange, onKeyPress, onSend }) {
    const keyboard = useRef();
    const [layoutName, setLayoutName] = useState("default");

    // FORCE SYNC: When parent clears 'value' (to ""), we must tell the library to clear its internal buffer
    useEffect(() => {
        if (keyboard.current) {
            keyboard.current.setInput(value);
        }
    }, [value]);

    const handleKeyPress = (button) => {
        // Handle Layout Switches
        if (button === "{shift}") {
            setLayoutName(layoutName === "default" ? "shift" : "default");
            return;
        }
        if (button === "{numbers}") {
            setLayoutName("numbers");
            return;
        }
        if (button === "{abc}") {
            setLayoutName("default");
            return;
        }
        if (button === "{symbols}") {
            setLayoutName("symbols");
            return;
        }

        // Handle Normal Typing
        if (button === "{enter}") {
            onSend();
        } else {
            onKeyPress?.(button);
        }

        // Auto-revert shift after typing a character (skip backspace and layout mod keys)
        if (layoutName === "shift" && !button.startsWith("{") && button !== "{backspace}") {
            setLayoutName("default");
        } else if (layoutName === "shift" && (button === "{space}" || button === "{enter}")) {
            setLayoutName("default");
        }
    };

    return (
        <div
            className="virtual-keyboard-container"
            style={{
                height: '300px',
                display: 'flex',
                margin: '0 10px 0 10px',
                width: 'auto',
                borderRadius: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <Keyboard
                keyboardRef={(r) => (keyboard.current = r)}
                input={value}
                layoutName={layoutName}
                onChange={onChange}
                onKeyPress={handleKeyPress}
                layout={{
                    default: [
                        "q w e r t z u i o p ü",
                        "a s d f g h j k l ö ä",
                        "{shift} y x c v b n m {backspace}",
                        "{numbers} {space} {enter}"
                    ],
                    shift: [
                        "Q W E R T Z U I O P Ü",
                        "A S D F G H J K L Ö Ä",
                        "{shift} Y X C V B N M {backspace}",
                        "{numbers} {space} {enter}"
                    ],
                    numbers: [
                        "1 2 3 4 5 6 7 8 9 0",
                        "- / : ; ( ) € & @ \"",
                        "{symbols} . , ? ! ' {backspace}",
                        "{abc} {space} {enter}"
                    ],
                    symbols: [
                        "[ ] { } # % ^ * + =",
                        "_ \\ | ~ < > $ £ ¥ ·",
                        "{numbers} . , ? ! ' {backspace}",
                        "{abc} {space} {enter}"
                    ]
                }}
                display={{
                    "{numbers}": "123",
                    "{abc}": "ABC",
                    "{symbols}": "#+=",
                    "{enter}": "Senden",
                    "{escape}": "esc ⎋",
                    "{tab}": "tab ⇥",
                    "{backspace}": "⌫",
                    "{shift}": "⇧",
                    "{capslock}": "caps lock ⇪",
                    "{space}": "Leerzeichen"
                }}
                buttonTheme={[
                    {
                        class: layoutName === "shift" ? "hg-active-shift" : "",
                        buttons: "{shift}"
                    }
                ]}
                theme={"hg-theme-default hg-theme-ios"}
            />

            <style>{`
        .virtual-keyboard-container {
            width: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
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
            font-size: 1rem !important;
        }
        
        /* Active Shift Key */
        .hg-theme-ios .hg-active-shift {
            background: #ffffff !important;
            color: #000000 !important;
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
        
        /* Shift Key Settings */
        .hg-theme-ios .hg-button-shift {
            min-width: unset !important;
            width: 50px !important;
            flex-grow: 0 !important;
        }
        .hg-theme-ios .hg-button-shift span {
            transform: scale(2.0) !important;
            display: inline-block !important;
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
            font-size: 1rem !important;
        }

      `}</style>
        </div>
    );
}
