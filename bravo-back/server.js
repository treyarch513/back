// /bravo-back/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/yourdbname"; // 자신의 MongoDB URI로 설정

// MongoDB 연결
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // useCreateIndex: true, // Mongoose 6부터는 자동으로 처리됨
}).then(() => {
  console.log("✅ MongoDB 연결 성공");
}).catch((error) => {
  console.error("❌ MongoDB 연결 실패:", error);
});

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// 기존 라우터 등록
import spotifyRoutes from './routes/spotify.js';
import youtubeRoutes from './routes/youtube.js';
import googleRoutes from './routes/google.js';

app.use('/api/spotify', spotifyRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/google', googleRoutes);

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
