const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Override process.env.PORT if specified in .env to prevent parent shell conflicts
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    if (envConfig.PORT) {
        process.env.PORT = envConfig.PORT;
    }
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// Connect to MongoDB using the URI from .env
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import route modules
const uploadRoutes = require('./routes/upload');
const compareRoutes = require('./routes/compare');
const riskScoreRoutes = require('./routes/riskScore');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount API routes
// The routers handle their own specific paths (e.g., /upload, /compare, /documents)
app.use('/api', uploadRoutes);
app.use('/api', compareRoutes);
app.use('/api', riskScoreRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

const PORT = process.env.PORT || 3008;

app.listen(PORT, () => {
    console.log(`Server is securely running on port ${PORT}`);
});

module.exports = app;
