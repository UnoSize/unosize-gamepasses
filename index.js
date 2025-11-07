const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    }
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
    res.json({
        name: 'Roblox Gamepass API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            checkOwnership: '/api/v1/check-ownership?userId=USER_ID&gamePassId=GAMEPASS_ID',
            listGamepasses: '/api/v1/list-gamepasses?universeId=UNIVERSE_ID'
        }
    });
});

// Check if a user owns a specific gamepass
app.get('/api/v1/check-ownership', async (req, res) => {
    const { userId, gamePassId } = req.query;

    // Validate required parameters
    if (!userId || !gamePassId) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameters: userId and gamePassId.'
        });
    }

    // Validate that parameters are numbers
    if (isNaN(userId) || isNaN(gamePassId)) {
        return res.status(400).json({
            success: false,
            message: 'userId and gamePassId must be valid numbers.'
        });
    }

    const assetType = 'GamePass';
    const apiUrl = `https://inventory.roblox.com/v1/users/${userId}/items/${assetType}/${gamePassId}/is-owned`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: 'Failed to check ownership via Roblox API.',
                robloxStatusCode: response.status
            });
        }

        const isOwnedText = await response.text();
        const isOwned = isOwnedText.toLowerCase() === 'true';

        res.json({
            success: true,
            method: 'check-ownership',
            userId: parseInt(userId, 10),
            gamePassId: parseInt(gamePassId, 10),
            isOwned: isOwned,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in check-ownership:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while processing ownership check.',
            error: error.message
        });
    }
});

// List all gamepasses for a universe
app.get('/api/v1/list-gamepasses', async (req, res) => {
    const { universeId, passView, pageSize, pageToken } = req.query;

    // Validate required parameter
    if (!universeId) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameter: universeId.'
        });
    }

    // Validate that universeId is a number
    if (isNaN(universeId)) {
        return res.status(400).json({
            success: false,
            message: 'universeId must be a valid number.'
        });
    }

    // Check for API key
    if (!ROBLOX_API_KEY) {
        return res.status(500).json({
            success: false,
            message: 'Server Error: ROBLOX_API_KEY environment variable is not set.',
            guide: 'Please generate a key on the Creator Dashboard with Game Pass read permissions.'
        });
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (passView) params.append('passView', passView);
    if (pageSize) params.append('pageSize', pageSize);
    if (pageToken) params.append('pageToken', pageToken);

    const apiUrl = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?${params.toString()}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'x-api-key': ROBLOX_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                success: false,
                message: 'Failed to retrieve game passes from Roblox API.',
                robloxStatusCode: response.status,
                robloxError: errorText
            });
        }

        const data = await response.json();

        res.json({
            success: true,
            method: 'list-gamepasses',
            universeId: parseInt(universeId, 10),
            data: data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in list-gamepasses:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while processing the game pass list request.',
            error: error.message
        });
    }
});

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: ['/health', '/api/v1/check-ownership', '/api/v1/list-gamepasses']
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Key configured: ${ROBLOX_API_KEY ? 'Yes' : 'No'}`);
});
