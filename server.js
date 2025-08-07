import express from "express";
import multer from "multer";
import { pool } from "./db.js";
import { s3 } from "./s3.js";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ 1. DB 조회 API
app.get("/courses", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM courses LIMIT 10");
    res.json(result.rows);
  } catch (error) {
    console.error("DB 조회 오류:", error);
    res.status(500).json({ error: "DB 조회 실패" });
  }
});

// ✅ 2. PDF 업로드 API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "파일이 필요합니다." });
    }
    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "PDF 파일만 업로드 가능합니다." });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `pdfs/${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: "application/pdf",
    });

    await s3.send(command);

    res.json({ message: "PDF 업로드 성공" });
  } catch (error) {
    console.error("S3 업로드 오류:", error);
    res.status(500).json({ error: "S3 업로드 실패" });
  }
});

// ✅ 3. Presigned URL 생성 API
app.get("/share-link", async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: "key 파라미터 필요" });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5분
    res.json({ url });
  } catch (error) {
    console.error("Presigned URL 생성 오류:", error);
    res.status(500).json({ error: "Presigned URL 생성 실패" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${process.env.PORT}`);
});
