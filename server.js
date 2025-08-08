// server.js
const Pusher = require("pusher");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// --- 環境變數讀取 ---
const pusherAppId = process.env.PUSHER_APP_ID;
const pusherKey = process.env.PUSHER_APP_KEY;
const pusherSecret = process.env.PUSHER_APP_SECRET; // 請在 Render 環境變數中安全地設定此值
const pusherCluster = process.env.PUSHER_APP_CLUSTER; // 例如 "ap1"

// CORS 設定：從環境變數讀取允許的來源
// 如果未設定 CORS_ALLOWED_ORIGINS，預設允許所有 ('*')
// 在生產環境中，建議將 CORS_ALLOWED_ORIGINS 設定為您的 Android 應用程式可能發出請求的特定來源 (如果適用)
// 例如: "http://localhost:xxxx,https://your-app-domain.com"
const corsAllowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
let corsOptionsOrigin = '*'; // 預設允許所有
if (corsAllowedOriginsEnv) {
    const origins = corsAllowedOriginsEnv.split(',').map(origin => origin.trim());
    // 如果環境變數中設定了具體的來源 (且不是 '*'), 則使用該列表
    if (origins.length > 0 && origins[0] !== '*') {
        corsOptionsOrigin = origins;
    }
}

// --- 中介軟體設定 ---
app.use(cors({
  origin: corsOptionsOrigin, // 可以是 '*', 或者一個來源陣列
  credentials: true // 如果您的客戶端需要發送 cookies 或 authorization headers
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// --- Pusher 實例化 ---
let pusherInstance; // 將 Pusher 實例儲存在變數中

// 檢查所有必要的 Pusher 環境變數是否都已設定
if (pusherAppId && pusherKey && pusherSecret && pusherCluster) {
  pusherInstance = new Pusher({
    appId: pusherAppId,
    key: pusherKey,
    secret: pusherSecret,
    cluster: pusherCluster,
    useTLS: true, // 強烈建議在生產環境中使用 TLS
  });
  console.log("Pusher SDK initialized successfully.");
} else {
  console.error("PUSHER SDK ERROR: Not all Pusher environment variables (PUSHER_APP_ID, PUSHER_APP_KEY, PUSHER_APP_SECRET, PUSHER_APP_CLUSTER) are set.");
  console.error("Pusher SDK will NOT be initialized, and auth endpoints will fail.");
  // 輸出哪些變數已設定 (方便除錯，但不要輸出 Secret 的值)
  console.log(`PUSHER_APP_ID set: ${!!pusherAppId}`);
  console.log(`PUSHER_APP_KEY set: ${!!pusherKey}`);
  console.log(`PUSHER_APP_SECRET set: ${!!pusherSecret}`); // 只顯示是否設定，不顯示值
  console.log(`PUSHER_APP_CLUSTER set: ${!!pusherCluster}`);
}

// --- 路由 ---

// 健康檢查端點 (GET /)
// 可用於 Render 的健康檢查，以確認服務是否正在運行
app.get("/", (req, res) => {
  if (pusherInstance) {
    res.status(200).send("Pusher Auth Server is running and Pusher SDK is configured.");
  } else {
    res.status(503).send("Pusher Auth Server is running, but Pusher SDK is NOT configured due to missing environment variables. Auth will fail.");
  }
});

// Pusher 私有頻道和出席頻道身份驗證端點 (POST /pusher/auth)
app.post("/pusher/auth", (req, res) => {
  // 如果 Pusher SDK 未成功初始化，則返回錯誤
  if (!pusherInstance) {
    console.error("/pusher/auth - ERROR: Attempted auth call, but Pusher SDK is not initialized.");
    return res.status(503).send("Service Unavailable: Pusher service is not configured correctly on the server.");
  }

  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  // 對於 presence channels (出席頻道)，您可能還需要處理 presenceData
  // const presenceData = req.body.presence_data; // 例如: { user_id: "unique_user_id", user_info: { name: "Alice" } }

  console.log(`Received auth request: socket_id='${socketId}', channel_name='${channel}'`);

  if (!socketId || !channel) {
    console.warn("Auth request - BAD REQUEST: Missing socket_id or channel_name.", req.body);
    return res.status(400).send("Bad request: Missing socket_id or channel_name.");
  }

  // 驗證頻道類型是否為 private- 或 presence-
  if (!channel.startsWith("private-") && !channel.startsWith("presence-")) {
     console.warn(`Auth request - FORBIDDEN: Channel '${channel}' is not a private or presence channel.`);
     return res.status(403).send(`Forbidden: Channel '${channel}' is not a private or presence channel.`);
  }

  // 在這裡，您可以加入更嚴格的授權邏輯，
  // 例如：檢查請求者 (通常透過 session cookie 或 token) 是否有權限訂閱此頻道。
  // const user = authenticateUser(req); // 假設的身份驗證函式
  // if (!user || !canUserAccessChannel(user, channel)) {
  //   console.warn(`Auth request - FORBIDDEN: User not authorized for channel '${channel}'.`);
  //   return res.status(403).send("Forbidden: User not authorized for this channel.");
  // }

  try {
    let authResponse;
    if (channel.startsWith("presence-")) {
      // 對於出席頻道，您需要提供 presenceData
      // 這份資料會廣播給頻道中的其他成員
      // 確保 presenceData 是安全的，並且包含您希望公開的用戶資訊
      const defaultPresenceData = { user_id: `user_${socketId}_${Date.now()}` , name: "Anonymous User" }; // 範例
      // authResponse = pusherInstance.authorizeChannel(socketId, channel, presenceDataToUse); // 使用您驗證/準備好的 presenceData
      authResponse = pusherInstance.authorizeChannel(socketId, channel, defaultPresenceData); // 暫時使用預設值
      console.log(`Successfully authenticated PRESENCE socket '${socketId}' for channel '${channel}' with data:`, JSON.stringify(defaultPresenceData));
    } else { // private- 頻道
      authResponse = pusherInstance.authorizeChannel(socketId, channel);
      console.log(`Successfully authenticated PRIVATE socket '${socketId}' for channel '${channel}'`);
    }
    res.send(authResponse);
  } catch (error) {
      console.error(`Error authorizing channel '${channel}' for socket '${socketId}':`, error.message);
      // console.error(error.stack); // 在開發時可以取消註解以獲得更詳細的錯誤堆疊
      res.status(500).send("Internal Server Error during authorization.");
  }
});

// --- 伺服器啟動 ---
// Render 會透過環境變數 process.env.PORT 提供埠號
// 如果在本機開發且未設定 PORT 環境變數，則使用 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Pusher Auth Server listening on port ${port}`);
  console.log("--- Server Configuration Status ---");
  console.log("Pusher App ID:", pusherAppId ? pusherAppId.substring(0, Math.min(3, pusherAppId.length)) + "***" : "NOT SET");
  console.log("Pusher App Key:", pusherKey ? pusherKey.substring(0, Math.min(3, pusherKey.length)) + "***" : "NOT SET");
  console.log("Pusher App Secret:", pusherSecret ? "SET (value hidden for security)" : "NOT SET");
  console.log("Pusher App Cluster:", pusherCluster || "NOT SET");
  console.log("CORS Allowed Origins:", JSON.stringify(corsOptionsOrigin));
  console.log("---------------------------------");
  if (!pusherInstance) {
    console.warn("IMPORTANT WARNING: Pusher SDK is NOT initialized. Authentication endpoints (/pusher/auth) will fail. Please check your Pusher environment variables in Render.");
  } else {
    console.log("Server is ready. Pusher authentication endpoint is active at /pusher/auth");
  }
});
