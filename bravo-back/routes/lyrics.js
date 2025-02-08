// /bravo-back/routes/lyrics.js
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const MUSIXMATCH_API_KEY = process.env.MUSIXMATCH_API_KEY;
const MUSIXMATCH_API_HOST = process.env.MUSIXMATCH_API_HOST || "musixmatch-lyrics-songs.p.rapidapi.com";

router.get('/', async (req, res) => {  // '/' 경로에서 요청을 받도록 설정
    const { song, artist } = req.query;

    if (!song || !artist) {
        return res.status(400).json({ error: "곡명(song)과 아티스트명(artist)을 입력하세요." });
    }

    try {
        const url = "https://musixmatch-lyrics-songs.p.rapidapi.com/songs/lyrics";
        const querystring = new URLSearchParams({ t: song, a: artist, type: "json" });

        const headers = {
            "x-rapidapi-key": MUSIXMATCH_API_KEY,
            "x-rapidapi-host": MUSIXMATCH_API_HOST
        };

        console.log(`🔍 Musixmatch API 요청: ${url}?${querystring}`); // 요청 URL 확인
        const response = await fetch(`${url}?${querystring}`, { headers });
        const data = await response.json();

        console.log("📢 Musixmatch API 응답:", JSON.stringify(data, null, 2)); // 응답 확인

        // 실제 가사 데이터는 data.message.body.lyrics.lyrics_body 경로에 있을 가능성이 높습니다.
        const lyrics = data.message?.body?.lyrics?.lyrics_body;
        if (!lyrics) {
            return res.status(404).json({ error: "가사를 찾을 수 없습니다.", response: data });
        }

        res.json({ song, artist, lyrics });
    } catch (error) {
        console.error("❌ Musixmatch API 호출 오류:", error);
        res.status(500).json({ error: "가사 조회 중 오류 발생" });
    }
});

export default router;
