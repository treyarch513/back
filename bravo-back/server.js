import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// CORS 설정: 프론트엔드(bravo-front) URL에 맞게 설정
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// JSON 파싱 미들웨어
app.use(express.json());

// 기존 라우터 등록
import spotifyRoutes from './routes/spotify.js';
import youtubeRoutes from './routes/youtube.js';
import googleRoutes from './routes/google.js';

// ✅ API 엔드포인트 명확하게 설정
app.use('/api/spotify', spotifyRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/google', googleRoutes);


app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
