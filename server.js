import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = 'rAK3FfdieFob2Nn8Am';

// 生成随机设备 ID
function generateDeviceId() {
    return crypto.randomUUID().replace(/-/g, '');
}

// 1. 获取设备码（二维码）
app.post('/taptap/device_code', async (req, res) => {
    try {
        const deviceId = req.body.deviceId || generateDeviceId();
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: 'device_code',
            scope: 'public_profile',
            version: '2.1',
            platform: 'unity',
            info: JSON.stringify({ device_id: deviceId })
        });
        const resp = await fetch('https://accounts.tapapis.cn/oauth2/v1/device/code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const data = await resp.json();
        res.json({ ...data, deviceId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. 轮询检查扫码结果
app.post('/taptap/check_token', async (req, res) => {
    try {
        const { device_code, deviceId } = req.body;
        const params = new URLSearchParams({
            grant_type: 'device_token',
            client_id: CLIENT_ID,
            secret_type: 'hmac-sha-1',
            code: device_code,
            version: '1.0',
            platform: 'unity',
            info: JSON.stringify({ device_id: deviceId })
        });
        const resp = await fetch('https://accounts.tapapis.cn/oauth2/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const data = await resp.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. 获取用户资料（需要 MAC 签名）
app.post('/taptap/profile', async (req, res) => {
    try {
        const { kid, mac_key, access_token } = req.body;
        const timestamp = Math.floor(Date.now() / 1000).toString().padStart(10, '0');
        const nonce = generateDeviceId().slice(0, 16);
        const method = 'GET';
        const url = new URL('https://open.tapapis.cn/account/profile/v1?client_id=' + CLIENT_ID);
        const uri = url.pathname + url.search;
        const host = url.hostname;
        const port = '443';
        const other = '';
        const signatureBase = `${timestamp}\n${nonce}\n${method}\n${uri}\n${host}\n${port}\n${other}\n`;
        const hmac = crypto.createHmac('sha1', mac_key);
        hmac.update(signatureBase);
        const mac = hmac.digest('base64');
        const authHeader = `MAC id="${kid}", ts="${timestamp}", nonce="${nonce}", mac="${mac}"`;

        const resp = await fetch(url.toString(), {
            headers: { Authorization: authHeader }
        });
        const data = await resp.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. 登录 LeanCloud 换取 sessionToken
app.post('/taptap/login', async (req, res) => {
    try {
        const { profile, tokenData } = req.body;
        const authData = {
            ...profile.data,
            access_token: tokenData.access_token,
            mac_key: tokenData.mac_key,
            mac_algorithm: tokenData.mac_algorithm,
            kid: tokenData.kid,
            token_type: tokenData.token_type,
            scope: tokenData.scope,
        };
        // 这里需要 LeanCloud 的 AppKey 和 ClientId，请从 LCHelper.js 获取
        const APP_KEY = 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0';
        const LC_CLIENT_ID = 'rAK3FfdieFob2Nn8Am';
        const timestamp = Math.floor(Date.now() / 1000);
        const data = `${timestamp}${APP_KEY}`;
        const hash = crypto.createHash('md5').update(data).digest('hex');
        const sign = `${hash},${timestamp}`;

        const resp = await fetch('https://rak3ffdi.cloud.tds1.tapapis.cn/1.1/users', {
            method: 'POST',
            headers: {
                'X-LC-Id': LC_CLIENT_ID,
                'Content-Type': 'application/json',
                'X-LC-Sign': sign
            },
            body: JSON.stringify({ authData })
        });
        const result = await resp.json();
        if (!result.sessionToken) {
            throw new Error('登录失败: ' + JSON.stringify(result));
        }
        res.json({ sessionToken: result.sessionToken });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(3000, () => {
    console.log('✅ TapTap 代理运行在 http://localhost:3000');
    console.log('请保持此服务运行，然后在前端点击“扫码登录”');
});