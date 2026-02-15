const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // Need to install uuid
const multer = require('multer');
const sharp = require('sharp');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the client build
app.use(express.static(path.join(__dirname, 'client_build')));

// Serve Uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- PERSISTENCE ---
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial DB State
const INITIAL_DB = {
  chats: [
    {
      id: "default-chat",
      name: "Sarah",
      avatarColor: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)",
      matchMessage: "You matched with Sarah! 💖", // Customizable Welcome Message
      messages: [
        { id: 1, text: "You matched with Sarah! 💖", system: true },
        { id: 2, text: "20:30", system: true, time: true },
      ],
      // Status
      status: "Online recently",
      statusColor: "gray",
      // Presets: Array of { id, text, sender }
      presets: [
        { id: 'p1', text: "Hey! 👋", sender: 'match' },
        { id: 'p2', text: "How are you?", sender: 'match' },
        { id: 'p3', text: "Wanna meet up?", sender: 'match' },
        { id: 'p4', text: "Tell me more about yourself.", sender: 'match' }
      ],
      // Scenarios: Array of { id, name, messages }
      scenarios: []
    }
  ],
  activeChatId: "default-chat",
  // Global Status Presets
  statusPresets: [
    { id: 'sp1', text: "Online", color: "#4ade80" }, // Green
    { id: 'sp2', text: "Online recently", color: "gray" },
    { id: 'sp3', text: "Offline", color: "gray" }
  ],
  // Actor Profile (Self)
  actorAvatar: null, // URL to image or null
  // Phase 2: Dating App
  activeApp: 'messenger', // 'messenger' | 'dating'
  datingProfiles: [
    {
      id: 'd1',
      name: 'Elena',
      age: 24,
      bio: "Coffee addict ☕ | Travel ✈️ | Dog lover 🐶",
      imageUrl: null,
      isMatch: false
    }
  ],
  activeDatingProfileId: 'd1',
  datingScenarios: [],
  datingTheme: {
    primary: "#FF4B6E",
    background: "#111111",
    text: "#FFFFFF"
  },
  datingMatchSettings: {
    overlayColor: "rgba(0,0,0,0.85)",
    title: "It's a Match!",
    subtitle: "You and {name} liked each other.",
    overlayImage: null,
    overlayImageSize: 80 // Default width % (relative to container or max-width)
  },
  messengerTheme: {
    primary: "#007AFF", // Default Blue
    background: "#000000",
    text: "#FFFFFF"
  },
  messengerDissolveSettings: {
    overlayColor: "rgba(0,0,0,0.85)",
    text: "Match dissolved",
    overlayImage: null,
    overlayImageSize: 80
  },
  // Phase 3: VFX Screen
  vfxSettings: {
    mode: 'green', // 'green' | 'blue' | 'custom'
    greenColor: '#00FF00',
    blueColor: '#0000FF',
    customColor: '#FF00FF',
    markersEnabled: true,
    markerColor: '#FFFFFF', // High contrast
    markerCountX: 5,
    markerCountY: 9,
    markerSize: 20
  },
  // Phase 4: Lock Screen
  lockScreenSettings: {
    mode: 'lock', // 'black' | 'lock'
    showTime: true,
    showDate: true,
    customTime: null, // "HH:mm"
    customDate: null, // "DD.MM.YYYY"
    showFlashlight: true,
    showCamera: true,
    backgroundImage: null, // URL
    backgroundDim: 0.3 // Opacity of overlay
  }
};

let db = { ...INITIAL_DB };

// Load from file if exists
if (fs.existsSync(DB_FILE)) {
  try {
    const fileData = fs.readFileSync(DB_FILE, 'utf8');
    const saved = JSON.parse(fileData);
    db = { ...INITIAL_DB, ...saved };

    // Ensure nested objects exist if loading old DB
    if (!db.datingMatchSettings) db.datingMatchSettings = { ...INITIAL_DB.datingMatchSettings };
    if (!db.datingTheme) db.datingTheme = { ...INITIAL_DB.datingTheme };


    // Normalize Presets, Scenarios, and Match Message
    if (db.chats) {
      db.chats.forEach(chat => {
        if (!chat.scenarios) chat.scenarios = [];
        if (!chat.matchMessage) chat.matchMessage = `You matched with ${chat.name}! 💖`; // Default
        if (!chat.status) chat.status = "Online recently";
        if (!chat.statusColor) chat.statusColor = "gray";
        if (chat.avatarImage === undefined) chat.avatarImage = null;

        if (chat.presets) {
          chat.presets = chat.presets.map((p, idx) => {
            if (typeof p === 'string') return { id: `legacy-${idx}`, text: p, sender: 'match' };
            return p;
          });
        } else {
          chat.presets = [];
        }
      });
    } // Close if (db.chats)

  } catch (e) {
    console.error("Failed to load DB, using initial state:", e);
  }
} else {
  // Write initial state
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Save DB Helper
const saveDb = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Failed to save DB:", e);
  }
};

// --- API / SOCKET LOGIC ---

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send initial state to client
  socket.emit('data:update', db);

  // --- CONTROL EVENTS ---

  // Create new chat
  socket.on('control:create_chat', (name) => {
    const newChat = {
      id: uuidv4(),
      name: name || "New Match",
      avatarColor: `linear-gradient(135deg, #${Math.floor(Math.random() * 16777215).toString(16)} 0%, #${Math.floor(Math.random() * 16777215).toString(16)} 100%)`, // Random gradient
      matchMessage: `You matched with ${name || "New Match"}! 💖`,
      status: "Online recently",
      statusColor: "gray",
      messages: [
        { id: Date.now(), text: `You matched with ${name || "New Match"}! 💖`, system: true }
      ],
      presets: [{ id: uuidv4(), text: "Hey! 👋", sender: 'match' }],
      scenarios: []
    };
    db.chats.push(newChat);
    saveDb();
    io.emit('data:update', db); // Broadcast full update to all
  });

  // Select Chat (Active Chat)
  socket.on('control:select_chat', (chatId) => {
    db.activeChatId = chatId;
    saveDb();
    io.emit('actor:switch_chat', chatId);
    io.emit('data:update', db);
  });

  // Rename Chat
  socket.on('control:update_chat', ({ chatId, name }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.name = name;
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Delete Chat
  socket.on('control:delete_chat', (chatId) => {
    db.chats = db.chats.filter(c => c.id !== chatId);
    if (db.activeChatId === chatId) {
      db.activeChatId = db.chats[0]?.id || null;
    }
    saveDb();
    io.emit('data:update', db);
  });

  // --- STATUS MANAGEMENT ---

  // Set Status
  socket.on('control:set_status', ({ chatId, text, color }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.status = text;
      chat.statusColor = color;
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Add Status Preset
  socket.on('control:add_status_preset', ({ text, color }) => {
    if (!db.statusPresets) db.statusPresets = [];
    db.statusPresets.push({ id: uuidv4(), text, color });
    saveDb();
    io.emit('data:update', db);
  });

  // Delete Status Preset
  socket.on('control:delete_status_preset', (presetId) => {
    if (db.statusPresets) {
      db.statusPresets = db.statusPresets.filter(p => p.id !== presetId);
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Update Match Message (Welcome Message)
  socket.on('control:update_match_message', ({ chatId, message }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.matchMessage = message;

      // Update the actual system message if it exists
      const systemMsg = chat.messages.find(m => m.system);
      if (systemMsg) {
        systemMsg.text = message;
      }

      saveDb();
      io.emit('data:update', db);
    }
  });

  // Toggle Dissolved State
  socket.on('control:toggle_dissolve', (chatId) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.dissolved = !chat.dissolved;
      if (!chat.dissolutionMessage) chat.dissolutionMessage = "This match has been dissolved.";
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Update Dissolution Message
  socket.on('control:update_dissolution_message', ({ chatId, message }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.dissolutionMessage = message;
      saveDb();
      io.emit('data:update', db);
    }
  });

  // --- HTTP UPLOAD ENDPOINT (Progress & Resizing) ---
  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const purpose = req.body.purpose; // 'chat', 'actor', 'dating', 'dating-match-overlay'
      const chatId = req.body.chatId;
      const mimeType = req.file.mimetype;
      const ext = mimeType.split('/')[1] || 'png';
      const filename = `${uuidv4()}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);

      // Helper to delete old file
      const deleteOldFile = (url) => {
        if (!url) return;
        const oldFilename = path.basename(url);
        const oldPath = path.join(UPLOADS_DIR, oldFilename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.error("Failed to delete old image:", e);
          }
        }
      };

      // Find entity to clean up OLD image first
      if (purpose === 'chat' && chatId) {
        const chat = db.chats.find(c => c.id === chatId);
        if (chat && chat.avatarImage) deleteOldFile(chat.avatarImage);
      } else if (purpose === 'actor') {
        if (db.actorAvatar) deleteOldFile(db.actorAvatar);
      } else if (purpose === 'dating') {
        const profileId = req.body.profileId;
        const profile = db.datingProfiles.find(p => p.id === profileId);
        if (profile && profile.imageUrl) deleteOldFile(profile.imageUrl);
      } else if (purpose === 'dating-match-overlay') {
        if (db.datingMatchSettings && db.datingMatchSettings.overlayImage) {
          deleteOldFile(db.datingMatchSettings.overlayImage);
        }
      } else if (purpose === 'messenger-dissolve-overlay') {
        if (db.messengerDissolveSettings && db.messengerDissolveSettings.overlayImage) {
          deleteOldFile(db.messengerDissolveSettings.overlayImage);
        }
      } else if (purpose === 'lockscreen-bg') {
        if (db.lockScreenSettings && db.lockScreenSettings.backgroundImage) {
          deleteOldFile(db.lockScreenSettings.backgroundImage);
        }
      }

      // Save File
      if (purpose === 'dating' || purpose === 'dating-match-overlay' || purpose === 'messenger-dissolve-overlay' || purpose === 'lockscreen-bg') {
        // NO COMPRESSION for Dating App (or allow PNG transparency for overlay)
        await fs.promises.writeFile(filePath, req.file.buffer);
      } else {
        // Resize and Save using Sharp for others
        // Maintain aspect ratio, width 128px
        await sharp(req.file.buffer)
          .resize(128, null, { withoutEnlargement: true })
          .toFile(filePath);
      }

      const publicUrl = `/uploads/${filename}`;

      // Update DB with NEW image
      if (purpose === 'chat' && chatId) {
        const chat = db.chats.find(c => c.id === chatId);
        if (chat) {
          chat.avatarImage = publicUrl;
          saveDb();
          io.emit('data:update', db);
        }
      } else if (purpose === 'actor') {
        db.actorAvatar = publicUrl;
        saveDb();
        io.emit('data:update', db);
      } else if (purpose === 'dating') {
        const profileId = req.body.profileId;
        const profile = db.datingProfiles.find(p => p.id === profileId);
        if (profile) {
          profile.imageUrl = publicUrl;
          saveDb();
          io.emit('data:update', db);
        }
      } else if (purpose === 'dating-match-overlay') {
        if (!db.datingMatchSettings) db.datingMatchSettings = {};
        db.datingMatchSettings.overlayImage = publicUrl;
        saveDb();
        io.emit('data:update', db);
      } else if (purpose === 'messenger-dissolve-overlay') {
        if (!db.messengerDissolveSettings) db.messengerDissolveSettings = { ...INITIAL_DB.messengerDissolveSettings };
        db.messengerDissolveSettings.overlayImage = publicUrl;
        saveDb();
        io.emit('data:update', db);
      }

      res.json({ success: true, url: publicUrl });

    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Upload failed: " + err.message });
    }
  });


  /* 
  // REMOVED SOCKET UPLOADS IN FAVOR OF HTTP POST FOR PROGRESS BAR
  socket.on('control:upload_image', ...) 
  */

  // Clear Avatar (Reset to Gradient)
  socket.on('control:clear_avatar', ({ purpose, chatId }) => {
    if (purpose === 'chat' && chatId) {
      const chat = db.chats.find(c => c.id === chatId);
      if (chat) {
        chat.avatarImage = null;
        saveDb();
        io.emit('data:update', db);
      }
    } else if (purpose === 'actor') {
      db.actorAvatar = null;
      saveDb();
      io.emit('data:update', db);
    } else if (purpose === 'dating-match-overlay') {
      if (db.datingMatchSettings) {
        db.datingMatchSettings.overlayImage = null;
        saveDb();
        io.emit('data:update', db);
      }
    }
  });

  // Add Preset (Enhanced)
  socket.on('control:save_preset', ({ chatId, text, sender }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      if (!chat.presets) chat.presets = [];
      chat.presets.push({ id: uuidv4(), text, sender: sender || 'match' });
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Delete Preset
  socket.on('control:delete_preset', ({ chatId, presetId }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat && chat.presets) {
      chat.presets = chat.presets.filter(p => p.id !== presetId);
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Edit Preset Text
  socket.on('control:update_preset', ({ chatId, presetId, text }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat && chat.presets) {
      const preset = chat.presets.find(p => p.id === presetId);
      if (preset) {
        preset.text = text;
        saveDb();
        io.emit('data:update', db);
      }
    }
  });

  // --- SCENARIO MANAGEMENT ---

  // Save Scenario (Backup) - Excludes Welcome Message
  socket.on('control:save_scenario', ({ chatId, name }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      // Filter out the first message if it's the system match message
      // We assume the first message is ALWAYS the match message in this architecture
      const messagesToSave = chat.messages.filter((m, idx) => idx > 0 || !m.system);

      const scenario = {
        id: uuidv4(),
        name: name || `Backup ${new Date().toLocaleTimeString()}`,
        messages: JSON.parse(JSON.stringify(messagesToSave))
      };
      chat.scenarios.push(scenario);
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Load Scenario - Prepends Current Welcome Message
  socket.on('control:load_scenario', ({ chatId, scenarioId }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat && chat.scenarios) {
      const scenario = chat.scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        // Construct new message list: Welcome Message + Scenario Messages
        const welcomeMsg = { id: Date.now(), text: chat.matchMessage || `You matched with ${chat.name}! 💖`, system: true };
        chat.messages = [welcomeMsg, ...JSON.parse(JSON.stringify(scenario.messages))];

        saveDb();
        io.emit('data:update', db);
        io.emit('actor:reset', chatId); // Signal reload
      }
    }
  });

  // Delete Scenario
  socket.on('control:delete_scenario', ({ chatId, scenarioId }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat && chat.scenarios) {
      chat.scenarios = chat.scenarios.filter(s => s.id !== scenarioId);
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Rename Scenario
  socket.on('control:rename_scenario', ({ chatId, scenarioId, name }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat && chat.scenarios) {
      const scenario = chat.scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        scenario.name = name;
        saveDb();
        io.emit('data:update', db);
      }
    }
  });

  // Control sending a message (Match OR Actor from Control)
  socket.on('control:send_message', ({ chatId, text, sender }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      const msg = { id: Date.now(), text, sender: sender || 'match' }; // Allow 'me' or 'match'
      chat.messages.push(msg);
      saveDb();

      io.emit('data:update', db);
      // Also direct event for immediate animation if needed, though data:update covers it
      io.emit('actor:receive_message', { chatId, msg });
    }
  });

  // Control Clear Chat (Preserve Welcome Message)
  socket.on('control:clear', (chatId) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      // Reset to just the welcome message
      chat.messages = [
        { id: Date.now(), text: chat.matchMessage || `You matched with ${chat.name}! 💖`, system: true }
      ];
      saveDb();
      io.emit('data:update', db);
      io.emit('actor:clear', chatId);
    }
  });

  // Control Reset Scene (Specific Chat) -- DEPRECATED / MERGED
  // User asked to remove specific buttons, but we'll keep logic if needed or repurpose.
  // Actually, user wants ONE button to clear all. 'control:clear' above does exactly that now (empty array).
  // We can remove this Listener or keep it as legacy no-op. Let's keep it minimal or remove.
  socket.on('control:reset', (chatId) => {
    // Legacy reset, maybe restore default match message?
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.messages = [{ id: Date.now(), text: `You matched with ${chat.name}! 💖`, system: true }];
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Control Typing
  socket.on('control:typing_start', (chatId) => {
    io.emit('actor:typing_start', chatId);
  });


  // --- ACTOR EVENTS ---

  // Actor sending a message (USER typing)
  socket.on('actor:send_message', ({ chatId, text }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      const msg = { id: Date.now(), text, sender: 'me' };
      chat.messages.push(msg);
      saveDb();
      io.emit('data:update', db); // Updates control view instantly
    }
  });

  // --- APP SWITCHING ---
  socket.on('control:switch_app', (appName) => {
    db.activeApp = appName;
    saveDb();
    io.emit('data:update', db);
  });

  // --- DATING APP EVENTS ---

  // Create Profile
  socket.on('control:create_dating_profile', (profileData) => {
    const newProfile = {
      id: uuidv4(),
      name: profileData.name || "New Person",
      age: profileData.age || 25,
      bio: profileData.bio || "",
      imageUrl: null, // Image handled via upload
      avatarColor: `linear-gradient(135deg, #${Math.floor(Math.random() * 16777215).toString(16)} 0%, #${Math.floor(Math.random() * 16777215).toString(16)} 100%)`
    };
    db.datingProfiles.push(newProfile);
    saveDb();
    io.emit('data:update', db);
  });

  // Update Profile
  socket.on('control:update_dating_profile', ({ id, ...updates }) => {
    const profile = db.datingProfiles.find(p => p.id === id);
    if (profile) {
      Object.assign(profile, updates);
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Delete Profile
  socket.on('control:delete_dating_profile', (id) => {
    db.datingProfiles = db.datingProfiles.filter(p => p.id !== id);
    if (db.activeDatingProfileId === id) {
      db.activeDatingProfileId = db.datingProfiles[0]?.id || null;
    }
    saveDb();
    io.emit('data:update', db);
  });

  // Reorder Profiles
  socket.on('control:reorder_dating_profiles', (newProfiles) => {
    if (Array.isArray(newProfiles)) {
      db.datingProfiles = newProfiles;
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Set Active Profile (Jump to)
  socket.on('control:set_active_dating_profile', (profileId) => {
    db.activeDatingProfileId = profileId;
    saveDb();
    io.emit('data:update', db);
  });

  // Actor Swipe (Move to next)
  socket.on('actor:dating_swipe', (nextProfileId) => {
    db.activeDatingProfileId = nextProfileId;
    saveDb();
    io.emit('data:update', db);
  });

  // Handle Dating Profile Image Upload (Server-side handled via POST /api/upload mostly, but we need DB update logic there too)
  // See /api/upload modification below or reuse existing if general enough.
  // Actually, let's update /api/upload to handle 'dating' purpose.

  // --- DATING SCENARIOS ---
  socket.on('control:save_dating_scenario', (name) => {
    const scenario = {
      id: uuidv4(),
      name: name || `Backup ${new Date().toLocaleTimeString()}`,
      profiles: JSON.parse(JSON.stringify(db.datingProfiles)), // Deep copy
      actorAvatar: db.actorAvatar, // Save Actor Avatar
      actorAvatarColor: db.actorAvatarColor
    };
    if (!db.datingScenarios) db.datingScenarios = [];
    db.datingScenarios.push(scenario);
    saveDb();
    io.emit('data:update', db);
  });

  socket.on('control:load_dating_scenario', (scenarioId) => {
    if (db.datingScenarios) {
      const scenario = db.datingScenarios.find(s => s.id === scenarioId);
      if (scenario) {
        db.datingProfiles = JSON.parse(JSON.stringify(scenario.profiles)); // Restore
        db.actorAvatar = scenario.actorAvatar; // Restore Avatar
        db.actorAvatarColor = scenario.actorAvatarColor;

        // Reset active ID if invalid
        if (!db.datingProfiles.some(p => p.id === db.activeDatingProfileId)) {
          db.activeDatingProfileId = db.datingProfiles[0]?.id || null;
        }
        saveDb();
        io.emit('data:update', db);
      }
    }
  });

  socket.on('control:delete_dating_scenario', (scenarioId) => {
    if (db.datingScenarios) {
      db.datingScenarios = db.datingScenarios.filter(s => s.id !== scenarioId);
      saveDb();
      io.emit('data:update', db);
    }
  });

  socket.on('control:rename_dating_scenario', ({ scenarioId, name }) => {
    if (db.datingScenarios) {
      const scenario = db.datingScenarios.find(s => s.id === scenarioId);
      if (scenario) {
        scenario.name = name;
        saveDb();
        io.emit('data:update', db);
      }
    }
  });

  // Update Dating Theme
  socket.on('control:update_dating_theme', (theme) => {
    db.datingTheme = { ...db.datingTheme, ...theme };
    saveDb();
    io.emit('data:update', db);
  });

  // Update Dating Match Settings (NEW)
  socket.on('control:update_dating_match_settings', (settings) => {
    if (!db.datingMatchSettings) db.datingMatchSettings = {};
    db.datingMatchSettings = { ...db.datingMatchSettings, ...settings };
    saveDb();
    io.emit('data:update', db);
  });

  // Update Messenger Dissolve Settings (NEW)
  socket.on('control:update_messenger_dissolve_settings', (settings) => {
    if (!db.messengerDissolveSettings) db.messengerDissolveSettings = { ...INITIAL_DB.messengerDissolveSettings };
    db.messengerDissolveSettings = { ...db.messengerDissolveSettings, ...settings };
    saveDb();
    io.emit('data:update', db);
  });

  // Update Messenger Theme
  socket.on('control:update_messenger_theme', (theme) => {
    db.messengerTheme = { ...db.messengerTheme, ...theme };
    saveDb();
    io.emit('data:update', db);
  });

  // Update VFX Settings
  socket.on('control:update_vfx_settings', (settings) => {
    db.vfxSettings = { ...db.vfxSettings, ...settings };
    saveDb();
    io.emit('data:update', db);
  });


  // --- GLOBAL SCENE MANAGEMENT (New) ---
  socket.on('control:save_global_scene', (name) => {
    // Deep copy current DB
    const fullState = JSON.parse(JSON.stringify(db));

    // Remove the scenes list itself to prevent recursion/bloat
    // We only want to save the ACTUAL state, not the list of other saves.
    delete fullState.globalScenes;
    delete fullState.activeGlobalSceneId;

    const scene = {
      id: uuidv4(),
      name: name || `Full Backup ${new Date().toLocaleTimeString()}`,
      data: fullState,
      timestamp: Date.now()
    };

    if (!db.globalScenes) db.globalScenes = [];
    db.globalScenes.push(scene);
    db.activeGlobalSceneId = scene.id;

    saveDb();
    io.emit('data:update', db);
  });

  socket.on('control:load_global_scene', (sceneId) => {
    const scene = db.globalScenes.find(s => s.id === sceneId);
    if (scene) {
      const savedScenes = db.globalScenes; // Preserve the list of scenes!

      // Restore state
      db = JSON.parse(JSON.stringify(scene.data));

      // Restore the scenes list and set active ID
      db.globalScenes = savedScenes;
      db.activeGlobalSceneId = sceneId;

      saveDb();
      io.emit('data:update', db);

      // Force clients to reload/reset state where needed
      io.emit('actor:reset_all');
    }
  });

  socket.on('control:rename_global_scene', ({ sceneId, name }) => {
    const scene = db.globalScenes.find(s => s.id === sceneId);
    if (scene) {
      scene.name = name;
      saveDb();
      io.emit('data:update', db);
    }
  });

  socket.on('control:delete_global_scene', (sceneId) => {
    db.globalScenes = db.globalScenes.filter(s => s.id !== sceneId);
    if (db.activeGlobalSceneId === sceneId) db.activeGlobalSceneId = null;
    saveDb();
    io.emit('data:update', db);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

});

// --- REST API ROUTES ---
app.get('/api/data', (req, res) => {
  // Ensure datingScenarios exists in response even if not in DB file yet
  if (!db.datingScenarios) db.datingScenarios = [];
  res.json(db);
});

app.post('/api/control/app-name', (req, res) => {
  const { name } = req.body;
  if (name) {
    console.log(`[REST] Updating App Name to: ${name}`);
    db.datingAppName = name;
    saveDb();
    io.emit('data:update', db);
    res.json({ success: true, name });
  } else {
    res.status(400).json({ error: "Name required" });
  }
});

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client_build', 'index.html'));
});

const PORT = 3000;
const HTTPS_PORT = 3443;

// --- HTTPS SUPPORT ---
const certsDir = '/app/certs';
const keyPath = path.join(certsDir, 'privkey.pem');
const certPath = path.join(certsDir, 'fullchain.pem');

let httpsServer = null;

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    const https = require('https');
    httpsServer = https.createServer(httpsOptions, app);

    // Attach Socket.IO to HTTPS server as well
    io.attach(httpsServer);

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`HTTPS Server is running on port ${HTTPS_PORT}`);
    });
  } catch (e) {
    console.error("Failed to start HTTPS server:", e);
  }
} else {
  console.log("No SSL certificates found, skipping HTTPS.");
}

server.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});
