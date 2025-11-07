const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; 

// Setup Middleware
app.use(cors());
app.use(express.json());

// --- ENDPOINT 1: Check Single GamePass Ownership ---
// (Uses the reliable 'inventory.roblox.com' endpoint)

/**
 * Usage: GET /api/v1/check-ownership?userId={USER_ID}&gamePassId={GAMEPASS_ID}
 */
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


// --- ENDPOINT 2: List All GamePasses for a Universe ---
// (Uses the new, non-deprecated 'apis.roblox.com' endpoint)

/**
 * Usage: GET /api/v1/list-gamepasses?universeId={UNIVERSE_ID}&passView={Optional: Full}
 */
app.get('/api/v1/list-gamepasses', async (req, res) => {
    const { universeId, passView, pageSize, pageToken } = req.query;

    if (!universeId) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameter: universeId.'
        });
    }

    // Build the query string for the new Roblox API
    const params = new URLSearchParams();
    if (passView) params.append('passView', passView);
    if (pageSize) params.append('pageSize', pageSize);
    if (pageToken) params.append('pageToken', pageToken);

    // Use the NEW official endpoint as requested
    const apiUrl = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?${params.toString()}`;

    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            // Forward the Roblox API error status and response text
            const errorText = await response.text();
            return res.status(response.status).json({
                success: false,
                message: 'Failed to retrieve game passes from Roblox API.',
                robloxStatusCode: response.status,
                robloxError: errorText
            });
        }
        
        // Return the full JSON response from the Roblox API
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


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
