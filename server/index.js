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
  actorAvatar: null // URL to image or null
};

// Load DB
let db = { ...INITIAL_DB };
if (fs.existsSync(DB_FILE)) {
  try {
    const fileData = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(fileData);
    // Merge structure updates & Normalize
    if (!db.chats) db.chats = INITIAL_DB.chats;
    if (!db.activeChatId) db.activeChatId = INITIAL_DB.activeChatId;
    if (!db.statusPresets) db.statusPresets = INITIAL_DB.statusPresets; // Init Global Presets
    if (db.actorAvatar === undefined) db.actorAvatar = null;


    // Normalize Presets, Scenarios, and Match Message
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
      saveDb();
      io.emit('data:update', db);
      // Do not reset chat messages, just the setting
    }
  });

  // --- HTTP UPLOAD ENDPOINT (Progress & Resizing) ---
  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const purpose = req.body.purpose; // 'chat' or 'actor'
      const chatId = req.body.chatId;
      const mimeType = req.file.mimetype;
      const ext = mimeType.split('/')[1] || 'png';
      const filename = `${uuidv4()}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);

      // Resize and Save using Sharp
      // Maintain aspect ratio, width 128px
      await sharp(req.file.buffer)
        .resize(128, null, { withoutEnlargement: true })
        .toFile(filePath);

      const publicUrl = `/uploads/${filename}`;

      // Update DB
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client_build', 'index.html'));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
