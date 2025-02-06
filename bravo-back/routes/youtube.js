import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// 여러 개의 YouTube API 키 (라운드 로빈 방식)
const API_KEYS = [
  process.env.YOUTUBE_API_KEY1,
  process.env.YOUTUBE_API_KEY2,
  process.env.YOUTUBE_API_KEY3,
  process.env.YOUTUBE_API_KEY4,
  process.env.YOUTUBE_API_KEY5,
  process.env.YOUTUBE_API_KEY6,
];
let apiKeyIndex = 0;
function getNextApiKey() {
  const apiKey = API_KEYS[apiKeyIndex];
  apiKeyIndex = (apiKeyIndex + 1) % API_KEYS.length;
  return apiKey;
}

// YouTube 검색 엔드포인트
// URL 예시: GET /api/youtube?track=노래제목&artist=아티스트명
router.get('/youtube', async (req, res) => {
  const { track, artist } = req.query;
  if (!track || !artist) return res.status(400).json({ error: "트랙명과 아티스트명을 입력하세요." });
  try {
    const searchQuery = `${track} ${artist} official audio`;
    const apiKey = getNextApiKey();
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(searchQuery)}&key=${apiKey}&maxResults=1`;
    console.log(`🔍 YouTube 검색 요청 (사용 API 키: ${apiKey})`, url);
    const response = await fetch(url);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      res.json({ videoId: data.items[0].id.videoId });
    } else {
      res.status(404).json({ error: "YouTube 영상 없음" });
    }
  } catch (error) {
    console.error("❌ YouTube API 오류:", error);
    res.status(500).json({ error: "YouTube 검색 중 오류 발생" });
  }
});

export default router;
