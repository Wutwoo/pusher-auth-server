// server.js

const express = require('express');
const bodyParser = require('body-parser');
const Pusher = require('pusher');

const app = express();

// --- 配置 ---
// 這些值應該與您 Android 應用中 PusherService.java 裡的值對應
// 強烈建議從環境變數讀取敏感資訊 (特別是 appSecret)
// 但為了簡化，我們先直接寫在這裡。
const PUSHER_APP_ID = "2033994";         // 替換為您的 Pusher App ID
const PUSHER_APP_KEY = "d50a0605a8f25a232af5";      // 替換為您的 Pusher App Key
const PUSHER_APP_SECRET = "d851afb627d11fec7cd4"; // 替換為您的 Pusher App Secret (保密！)
const PUSHER_APP_CLUSTER = "ap1";     // 替換為您的 Pusher App Cluster

const PORT = process.env.PORT || 3000; // 伺服器運行的埠號

// --- 初始化 Pusher 伺服器 SDK ---
const pusher = new Pusher({
  appId: PUSHER_APP_ID,
  key: PUSHER_APP_KEY,
  secret: PUSHER_APP_SECRET,
  cluster: PUSHER_APP_CLUSTER,
  useTLS: true // 建議始終為 true，以使用 HTTPS
});

// --- 中介軟體 (Middleware) ---
// 解析 application/x-www-form-urlencoded 格式的請求主體
app.use(bodyParser.urlencoded({ extended: false }));
// 解析 application/json 格式的請求主體 (雖然 Pusher auth 通常是 x-www-form-urlencoded)
app.use(bodyParser.json());

// --- 路由 (Routes) ---
// 健康檢查端點 (可選，用於測試伺服器是否運行)
app.get('/', (req, res) => {
  res.send('Pusher Auth Server is running!');
});

// Pusher 身份驗證端點
// Android App 中的 PUSHER_AUTH_ENDPOINT_URL 應指向這裡
// 例如: http://<您的伺服器IP或域名>:<PORT>/pusher/auth
app.post('/pusher/auth', (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;

  // 在此處，您可以添加自訂的授權邏輯，例如：
  // 1. 檢查請求中是否包含有效的用戶 token (可能在 HTTP 標頭中)。
  // 2. 根據用戶身份，驗證該用戶是否有權限訂閱 `channel`。
  // 3. 如果是 presence 頻道，還需要提供 `user_data`。

  // 為了這個範例的簡單性，我們直接授權所有請求。
  // **警告：在生產環境中，您必須實現嚴格的授權檢查！**

  if (!socketId || !channel) {
    console.error('Bad request to /pusher/auth: missing socket_id or channel_name');
    return res.status(400).send('Bad Request: socket_id and channel_name are required.');
  }

  console.log(`Authenticating socket ${socketId} for channel ${channel}`);

  try {
    // 對於私有頻道 (private channels)
    const auth = pusher.authenticate(socketId, channel);
    res.send(auth);
    console.log(`Successfully authenticated ${socketId} for ${channel}. Auth response:`, auth);

    // // 如果您將來使用出席頻道 (presence channels)，則需要提供 user_data:
    // const presenceData = {
    //   user_id: `user_${Math.random().toString(36).substr(2, 9)}`, // 必須是唯一的字串 ID
    //   user_info: { // 可選的用戶額外資訊
    //     name: "Test User",
    //     // ... 其他您想包含的資訊
    //   }
    // };
    // const authForPresence = pusher.authenticate(socketId, channel, presenceData);
    // res.send(authForPresence);
    // console.log(`Successfully authenticated ${socketId} for presence channel ${channel}. Auth response:`, authForPresence);

  } catch (error) {
    console.error(`Error authenticating socket ${socketId} for channel ${channel}:`, error);
    res.status(500).send('Internal Server Error during authentication.');
  }
});

// --- 啟動伺服器 ---
app.listen(PORT, () => {
  console.log(`Pusher Auth Server listening on port ${PORT}`);
  console.log(`Pusher App ID: ${PUSHER_APP_ID}`);
  console.log(`Pusher Auth Endpoint will be: /pusher/auth`);
  console.log('Ensure your Android app PUSHER_AUTH_ENDPOINT_URL points to this server and path.');
});

