// 文件：getSessionTokenByQRCode.js
import TapTapHelper from './TapTapHelper.js';
import LCHelper from './LCHelper.js';
import { sleep } from 'util';  // 或自己实现 sleep

/**
 * 通过 TapTap 扫码获取 Phigros 的 sessionToken
 * @param {boolean} useGlobal - 是否使用全球服（默认 false，即国服）
 * @param {number} [timeoutSeconds] - 自定义超时时间（秒），默认使用接口返回的 expires_in
 * @returns {Promise<string>} 返回 sessionToken
 * @throws {Error} 扫码超时或失败时抛出
 */
export async function getSessionTokenViaQRCode(useGlobal = false, timeoutSeconds) {
    // 1. 请求二维码数据
    const partial = await TapTapHelper.requestLoginQrCode(['public_profile'], useGlobal);
    const { device_code, qrcode_url, expires_in, interval } = partial.data;
    const totalTimeout = timeoutSeconds || expires_in;

    console.log(`二维码已生成，有效期 ${totalTimeout} 秒`);
    console.log(`二维码链接：${qrcode_url}`);
    // 如果需要生成图片，可用 qrcode 库转为 Buffer，此处省略

    // 2. 轮询检查扫码结果
    let result = null;
    const startTime = Date.now();
    while (Date.now() - startTime < totalTimeout * 1000) {
        result = await TapTapHelper.checkQRCodeResult(partial, useGlobal);
        if (result && result.success) break;   // 假设返回对象有 success 字段
        await sleep((interval || 2) * 1000);
    }

    if (!result || !result.success) {
        throw new Error('扫码超时或授权失败，请重试');
    }

    // result.data 即为 TapTapTokenData
    const tokenData = result.data;

    // 3. 获取用户公开资料
    const profile = await TapTapHelper.getProfile(tokenData, useGlobal);
    if (!profile || !profile.data) {
        throw new Error('获取用户资料失败');
    }

    // 4. 合并 authData，换取 sessionToken
    const authData = {
        ...profile.data,
        ...tokenData,
    };
    const sessionResponse = await LCHelper.loginAndGetToken(authData, useGlobal);
    if (!sessionResponse || !sessionResponse.sessionToken) {
        throw new Error('换取 sessionToken 失败，返回数据：' + JSON.stringify(sessionResponse));
    }

    return sessionResponse.sessionToken;
}

// 简单 sleep 实现
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}