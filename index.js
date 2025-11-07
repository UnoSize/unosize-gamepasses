const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; 

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

app.use(cors()); // Allows cross-origin requests
app.use(express.json());

app.get('/api/v1/check-ownership', async (req, res) => {
    const { userId, gamePassId } = req.query;

    if (!userId || !gamePassId) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameters: userId and gamePassId.'
        });
    }

    const assetType = 'GamePass';
    const apiUrl = `https://inventory.roblox.com/v1/users/${userId}/items/${assetType}/${gamePassId}/is-owned`;

    try {
        const response = await fetch(apiUrl);
        
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
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error while processing ownership check.',
            error: error.message
        });
    }
});

app.get('/api/v1/list-gamepasses', async (req, res) => {
    const { universeId, passView, pageSize, pageToken } = req.query;

    if (!universeId) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameter: universeId.'
        });
    }

    if (!ROBLOX_API_KEY) {
        // Critical check for the required environment variable
        return res.status(500).json({
            success: false,
            message: 'Server Error: ROBLOX_API_KEY environment variable is not set. This endpoint requires an authenticated Open Cloud API Key.',
            guide: 'Please generate a key on the Creator Dashboard with Game Pass read permissions and set it on Render.'
        });
    }
    
    // Build the query string for the new Roblox API
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
                message: 'Failed to retrieve game passes from Roblox API. Check API Key permissions or Universe ID.',
                robloxStatusCode: response.status,
                robloxError: errorText
            });
        }
        
        const data = await response.json();
        res.json({
            success: true,
            method: 'list-gamepasses',
            universeId: parseInt(universeId, 10),
            data: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error while processing the game pass list request.',
            error: error.message
        });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
