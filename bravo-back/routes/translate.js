import express from 'express';
import puppeteer from 'puppeteer';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { performance } from "perf_hooks";
import dotenv from "dotenv";
import { encode } from "gpt-3-encoder";

dotenv.config();

const router = express.Router();

// AWS Bedrock Client 설정
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * Papago를 이용한 기계번역
 * @param {string} originalLyrics - 원문 영문 가사
 * @returns {Promise<string|null>} - 기계번역 결과(한글) 또는 null
 */
async function translateWithPapago(originalLyrics) {
  console.log("Papago: 기계번역 시작");
  const startTime = performance.now();
  const browser = await puppeteer.launch({ headless: true }); // 배포 시 headless:true 권장
  const page = await browser.newPage();
  try {
    await page.goto('https://papago.naver.com/', { waitUntil: 'networkidle2' });
    const inputSelector = 'textarea#txtSource';
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    
    // 원문 입력
    await page.evaluate((selector, text) => {
      const inputBox = document.querySelector(selector);
      inputBox.value = '';
      inputBox.value = text;
      inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    }, inputSelector, originalLyrics);
    
    await page.keyboard.press('Enter');
    const resultSelector = 'div#txtTarget';
    
    // 번역 결과가 나타날 때까지 대기 (최대 15초)
    await page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.innerText.trim().length > 0 && el.innerText.trim() !== "...";
      },
      { timeout: 15000 },
      resultSelector
    );
    
    let translatedText = await page.evaluate(selector => {
      const element = document.querySelector(selector);
      return element ? element.innerText.trim() : null;
    }, resultSelector);
    
    // 번역 실패 시 재시도
    if (!translatedText || translatedText.trim() === "..." || translatedText.trim().length < 5) {
      console.error("Papago 번역 실패, 재시도 중...");
      await browser.close();
      return await translateWithPapago(originalLyrics);
    }
    
    // 토큰 수 로그 (디버그용)
    const inputTokens = encode(originalLyrics);
    const outputTokens = encode(translatedText);
    console.log(`Papago 입력 토큰: ${inputTokens.length}`);
    console.log(`Papago 출력 토큰: ${outputTokens.length}`);
    
    const endTime = performance.now();
    console.log(`Papago 번역 완료 (소요 시간: ${(endTime - startTime).toFixed(2)}ms)`);
    console.log(translatedText);
    return translatedText;
  } catch (error) {
    console.error("Papago 번역 중 오류 발생:", error);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Claude 3.5 Sonnet을 이용한 번역 보정
 * @param {string} originalLyrics - 원문 영문 가사
 * @param {string} papagoTranslation - Papago 기계번역 결과(한글)
 * @returns {Promise<string|null>} - 보정된 번역 결과 또는 null
 */
async function refineTranslation(originalLyrics, papagoTranslation) {
  console.log("Claude 3.5: 번역 보정 진행");
  const startTime = performance.now();
  if (!papagoTranslation || papagoTranslation.trim().length === 0) {
    console.error("Papago 번역 결과가 없습니다. 보정을 진행할 수 없습니다.");
    return null;
  }
  
  const systemPrompt = `
Please refine the given Korean lyrics for better fluency and natural tone while preserving the original meaning and style.
- Do NOT summarize or omit repeated sections (such as chorus).
- Translate every line exactly as it appears without skipping any parts.
- Maintain the original rhythm and structure.
- Ensure the lyrics sound natural and poetic in Korean.
- Do NOT add additional commentary or explanations.
[Original English Lyrics]
${originalLyrics}
[Initial Korean Translation]
${papagoTranslation}
[Output: Refined Korean Lyrics]
  `;
  
  const inputTokens = encode(systemPrompt);
  console.log(`Claude 입력 토큰: ${inputTokens.length}`);
  
  const inputPayload = {
    modelId: process.env.INFERENCE_PROFILE_ARN,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      messages: [
        { role: "user", content: systemPrompt }
      ],
      max_tokens: 2048,
      temperature: 0.9,
      top_p: 0.8,
      top_k: 250,
      stop_sequences: ["Korean Translation:"]
    })
  };
  
  try {
    const command = new InvokeModelCommand(inputPayload);
    const response = await client.send(command);
    const responseBody = new TextDecoder("utf-8").decode(response.body);
    const responseData = JSON.parse(responseBody);
    const refinedLyrics = responseData?.content?.[0]?.text?.trim();
    
    if (!refinedLyrics) {
      console.error("Claude 응답에서 보정된 번역 결과를 찾을 수 없습니다:", responseData);
      return null;
    }
    
    const outputTokens = encode(refinedLyrics);
    console.log(`Claude 출력 토큰: ${outputTokens.length}`);
    console.log(`총 토큰 수 (입력 + 출력): ${inputTokens.length + outputTokens.length}`);
    
    const endTime = performance.now();
    console.log(`번역 보정 완료 (소요 시간: ${(endTime - startTime).toFixed(2)}ms)`);
    console.log(refinedLyrics);
    return refinedLyrics;
  } catch (error) {
    console.error("Claude 번역 보정 요청 실패:", error);
    return null;
  }
}

/**
 * 전체 번역 프로세스 실행 함수
 * 순서: Papago 기계번역 → Claude 번역 보정
 * @param {string} lyrics - 원문 영문 가사
 * @returns {Promise<string|null>} - 최종 번역 결과 또는 null
 */
async function processTranslation(lyrics) {
  console.log("전체 번역 프로세스 시작");
  
  // 1. Papago 기계번역 실행
  const papagoResult = await translateWithPapago(lyrics);
  if (!papagoResult || papagoResult.trim().length === 0) {
    console.error("Papago 번역 실패: AI 보정 단계로 진행하지 않습니다.");
    return null;
  }
  
  // 2. Claude를 이용한 번역 보정 실행
  const refinedResult = await refineTranslation(lyrics, papagoResult);
  return refinedResult;
}

// Express POST 요청 핸들러
router.post('/', async (req, res) => {
  const { lyrics } = req.body;
  if (!lyrics) {
    return res.status(400).json({ error: "영문 가사를 제공하세요." });
  }
  
  const refinedTranslation = await processTranslation(lyrics);
  if (!refinedTranslation) {
    return res.status(500).json({ error: "번역 프로세스에 실패했습니다." });
  }
  
  res.json({ translatedLyrics: refinedTranslation });
});

export default router;
