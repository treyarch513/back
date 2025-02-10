import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// ✅ 여러 개의 YouTube API 키 (라운드 로빈 방식)
const youtubeApiKeys = process.env.YOUTUBE_API_KEYS
  ? process.env.YOUTUBE_API_KEYS.split(",")
  : [
      process.env.YOUTUBE_API_KEY1,
      process.env.YOUTUBE_API_KEY2,
      process.env.YOUTUBE_API_KEY3,
      process.env.YOUTUBE_API_KEY4,
      process.env.YOUTUBE_API_KEY5,
      process.env.YOUTUBE_API_KEY6,
    ].filter(Boolean); // undefined 값 제거

if (!youtubeApiKeys.length) {
  console.error("❌ YouTube API 키가 설정되지 않았습니다. .env 파일을 확인하세요.");
  process.exit(1);
}

let currentApiKeyIndex = 0;
let currentApiKey = youtubeApiKeys[currentApiKeyIndex];

// ✅ API 키 로테이션 (2분마다 변경)
function rotateApiKey() {
  currentApiKeyIndex = (currentApiKeyIndex + 1) % youtubeApiKeys.length;
  currentApiKey = youtubeApiKeys[currentApiKeyIndex];
  console.log(`🔄 ${currentApiKeyIndex + 1}번째 YouTube API 키로 변경됨: ${currentApiKey}`);
}
setInterval(rotateApiKey, 2 * 60 * 1000); // 2분마다 API 키 변경

// ✅ YouTube 검색 엔드포인트
// GET /api/youtube/search?track=노래제목&artist=아티스트명
router.get("/search", async (req, res) => {
  const { trackName, artistName } = req.query;
  if (!trackName || !artistName) {
    return res.status(400).json({ error: "트랙명과 아티스트명을 입력하세요." });
  }

  const searchQuery = `${trackName} ${artistName} official audio`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
    searchQuery
  )}&key=${currentApiKey}&maxResults=1`;

  try {
    console.log(`🔍 YouTube 검색 요청 (API 키: ${currentApiKey})`, url);
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: "YouTube API 에러 발생" });
    }

    const data = await response.json();
    const videoId = data.items?.[0]?.id?.videoId || null;

    if (videoId) {
      res.json({ videoId });
    } else {
      res.status(404).json({ error: "YouTube 영상 없음" });
    }
  } catch (error) {
    console.error("❌ YouTube API 오류:", error);
    res.status(500).json({ error: "YouTube 검색 중 오류 발생" });
  }
});

export default router;
