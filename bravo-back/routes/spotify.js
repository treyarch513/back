import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config(); // ✅ .env 파일 로드

const router = express.Router();

let spotifyToken = null;
let tokenExpiresAt = 0;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error("❌ SPOTIFY_CLIENT_ID 또는 SPOTIFY_CLIENT_SECRET이 설정되지 않았습니다. .env 파일을 확인하세요.");
  process.exit(1);
}

// ✅ Spotify 토큰 요청 함수
async function getSpotifyToken() {
  const currentTime = Date.now();
  if (spotifyToken && currentTime < tokenExpiresAt) {
    console.log("✅ 기존 Spotify 토큰 사용:", spotifyToken);
    return spotifyToken;
  }

  console.log("🔄 새로운 Spotify 토큰 요청 중...");
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    const data = await response.json();

    if (data.access_token) {
      spotifyToken = data.access_token;
      tokenExpiresAt = currentTime + data.expires_in * 1000;
      console.log("✅ 새 Spotify 토큰 발급 완료:", spotifyToken);
      return spotifyToken;
    } else {
      console.error("❌ Spotify 토큰 요청 실패", data);
      throw new Error("Spotify API 토큰을 가져올 수 없습니다.");
    }
  } catch (error) {
    console.error("❌ Spotify API 요청 중 오류 발생:", error);
    throw new Error("Spotify API 요청 실패");
  }
}

// ✅ Spotify 검색 엔드포인트 (기본 한국 리전)
// GET /api/spotify/search?q=<검색어>
router.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Query parameter q is required" });
  }
  try {
    const token = await getSpotifyToken();
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept-Language": "ko-KR", // 한국 리전 우선
        },
      }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: "Spotify API error" });
    }
    const data = await response.json();
    res.json(data.tracks.items || []);
  } catch (error) {
    console.error("❌ Spotify 검색 오류:", error);
    res.status(500).json({ error: "Spotify 검색 중 오류 발생" });
  }
});

// ✅ 특정 트랙 상세 정보 조회 (미국 리전 기본)
// GET /api/spotify/track?trackId=<트랙ID>&market=US
router.get("/track", async (req, res) => {
  const trackId = req.query.trackId;
  const market = req.query.market || "US"; // 기본 시장은 미국(US)
  if (!trackId) {
    return res.status(400).json({ error: "trackId parameter is required" });
  }
  try {
    const token = await getSpotifyToken();
    const response = await fetch(
      `https://api.spotify.com/v1/tracks/${trackId}?market=${market}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: "Spotify API error" });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("❌ Spotify 트랙 조회 오류:", error);
    res.status(500).json({ error: "Spotify 트랙 조회 중 오류 발생" });
  }
});

export default router;
