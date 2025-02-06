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

// ✅ Spotify 검색 엔드포인트
router.get("/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "검색어를 입력하세요." });

  try {
    const token = await getSpotifyToken();
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=40`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json();
    res.json(data.tracks.items);
  } catch (error) {
    console.error("❌ Spotify 검색 오류:", error);
    res.status(500).json({ error: "Spotify 검색 중 오류 발생" });
  }
});

export default router;
