# Backloggd Games Scraper API Documentation

This API allows you to search for games on Backloggd and retrieve detailed information about them, supporting both **JSON** and **HTML** formats.

---

## 1. Search Games List
Retrieve a list of games matching a search query.

- **Endpoint:** `/api/scrap/games/list`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json`

### Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `query` | String | Yes | - | The search term/game title (e.g., `halo`, `witcher 3`). |
| `type` | String | No | `HTML` | The response format. Either `JSON` or `HTML`. |
| `page` | Number | No | `1` | The page number for paginated search results. |

---

### Responses

#### A. JSON Format (`type=JSON`)
Returns a structured JSON payload containing the parsed search result metadata.

**Request:**
`GET /api/scrap/games/list?query=halo&type=JSON`

**Response Example (Status 200):**
```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "name": "Halo: Combat Evolved",
      "img": "https://images.backloggd.com/covers/...jpg",
      "year": "2001",
      "type": "Main Game",
      "url": "/games/halo-combat-evolved"
    }
  ]
}
```

#### B. HTML Format (`type=HTML` or default)
Returns a pre-rendered HTML grid containing the styled game cards. Perfect for direct rendering into the front-end DOM.

**Request:**
`GET /api/scrap/games/list?query=halo&type=HTML`

**Response Example (Status 200 - HTML snippet):**
```html
<div class="games-grid">
    <div class="game-card" onclick="showGameDetails('/games/halo-combat-evolved')">
        <div class="game-card-image-wrapper">
            <div class="game-card-image">
                <img src="https://images.backloggd.com/covers/...jpg" alt="Halo: Combat Evolved">
                <div class="game-card-badges">
                    <span class="game-card-type">Main Game</span>
                    <span class="game-card-year">2001</span>
                </div>
            </div>
        </div>
        <div class="game-card-content">
            <div class="game-card-title-row">
                <div class="game-card-title">Halo: Combat Evolved</div>
            </div>
        </div>
    </div>
</div>
```

---

## 2. Retrieve Game Details
Retrieve comprehensive information about a specific game based on its Backloggd URL.

- **Endpoint:** `/api/scrap/games/details`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json`

### Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | String | Yes | - | The path of the game relative to Backloggd (e.g., `/games/halo-combat-evolved`). |
| `type` | String | No | `HTML` | The response format. Either `JSON` or `HTML`. |

---

### Responses

#### A. JSON Format (`type=JSON`)
Returns detailed metadata about the game, such as developers, publishers, ratings, play times, and statistics.

**Request:**
`GET /api/scrap/games/details?url=%2Fgames%2Fhalo-combat-evolved&type=JSON`

**Response Example (Status 200):**
```json
{
  "status": "success",
  "data": {
    "title": "Halo: Combat Evolved",
    "gameImage": "https://images.backloggd.com/...",
    "coverImage": "https://images.backloggd.com/...",
    "description": "Halo is a sci-fi shooter...",
    "developers": ["Bungie"],
    "publishers": ["Microsoft Game Studios"],
    "releaseDate": "Nov 15, 2001",
    "genres": ["Shooter", "Adventure"],
    "platforms": ["Xbox", "PC"],
    "rating": 4.2,
    "stats": {
      "plays": "15K",
      "playing": "200",
      "backlogs": "3K",
      "wishlists": "1.5K",
      "ratings": "8K"
    },
    "playTimes": {
      "average": "10h",
      "toFinish": "9h",
      "toMaster": "20h"
    }
  }
}
```

#### B. HTML Format (`type=HTML` or default)
Returns a pre-rendered HTML layout including the back navigation button and full game details card.

**Request:**
`GET /api/scrap/games/details?url=%2Fgames%2Fhalo-combat-evolved&type=HTML`

**Response Example (Status 200 - HTML snippet):**
```html
<button class="back-btn" onclick="hideGameDetails()">
    <i class="fa-solid fa-arrow-left"></i>
    Back to Results
</button>

<div class="game-details">
    <div class="game-details-header">
        <div class="game-details-image">
            <img src="https://images.backloggd.com/..." alt="Halo: Combat Evolved">
        </div>
        <div class="game-details-info">
            <h1 class="game-details-title">Halo: Combat Evolved</h1>
            <div class="game-details-year">Nov 15, 2001</div>
            <div class="game-details-rating" style="margin-bottom: 16px;">
                <span class="rating-stars">★★★★</span>
                <span class="rating-value">4.2/5</span>
            </div>
            ...
        </div>
    </div>
</div>
```

---

## 3. Error Handling

When errors occur during scraping or parsing, the API returns a `500 Internal Server Error` status with a descriptive JSON message.

**Response Structure (Status 500 / 400):**
```json
{
  "status": "error",
  "message": "Error description here"
}
```
Possible causes:
- Target site block (e.g., Cloudflare protection)
- Invalid/missing relative `url` parameter
- Network timeout
