// server.js
const Pusher = require("pusher");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// --- 環境變數讀取 ---
// 從環境變數讀取 Pusher 配置 (在 Render 上設定這些)
const pusherAppId = process.env.PUSHER_APP_ID;
const pusherKey = process.env.PUSHER_APP_KEY;
const pusherSecret = process.env.PUSHER_APP_SECRET; // 非常重要：確保這個值只在 Render 的環境變數中設定
const pusherCluster = process.env.PUSHER_APP_CLUSTER; // 例如 "ap1"

// 從環境變數讀取 CORS 允許的來源，如果未設定則允許所有 (用於開發階段)
// 生產環境建議明確指定允許的來源，例如 "https://your-android-app-domain.com"
// 如果您的 Android 應用沒有 web origin (直接從 app 連線)，則可能需要更寬鬆的設定或檢查 origin header
const corsAllowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
let allowedOrigins = '*'; // 預設允許所有
if (corsAllowedOriginsEnv) {
    allowedOrigins = corsAllowedOriginsEnv.split(',').map(origin => origin.trim());
}

// --- 中介軟體設定 ---
app.use(cors({
  origin: function (origin, callback) {
    // 允許沒有 origin 的請求 (例如 curl 請求, Postman, 或某些伺服器到伺服器的請求)
    if (!origin) return callback(null, true);

    // 如果 allowedOrigins 是萬用字元 '*'，則允許所有
    if (allowedOrigins === '*' || (Array.isArray(allowedOrigins) && allowedOrigins[0] === '*')) {
        return callback(null, true);
    }
    // 檢查 origin 是否在允許的列表中
    if (Array.isArray(allowedOrigins) && allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS: The origin '${origin}' is not allowed for this site.`;
      console.warn(msg); // 記錄 CORS 拒絕
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // 如果您需要在客戶端發送 cookies 或 authorization headers
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


// --- Pusher 實例化 ---
// 檢查必要的 Pusher 環境變數是否存在
if (!pusherAppId || !pusherKey || !pusherSecret || !pusherCluster) {
  console.error("FATAL ERROR: Pusher environment variables (PUSHER_APP_ID, PUSHER_APP_KEY, PUSHER_APP_SECRET, PUSHER_APP_CLUSTER) are not fully set.");
  // 在實際應用中，您可能希望在這裡拋出錯誤或退出程序
